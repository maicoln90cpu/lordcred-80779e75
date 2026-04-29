import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Loader2, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: () => void;
}

interface ParsedRow {
  cpf: string;
  full_name: string | null;
  phone: string | null;
  birth_date: string | null;
  extra: Record<string, any>;
}

const CHUNK_SIZE = 1000; // upsert por blocos de 1000

function cleanCpf(v: any): string {
  return String(v ?? '').replace(/\D/g, '');
}

function isValidCpf(cpf: string): boolean {
  return cpf.length === 11 && !/^(\d)\1+$/.test(cpf);
}

function parseDate(v: any): string | null {
  if (!v) return null;
  if (typeof v === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  const s = String(v).trim();
  // dd/mm/yyyy
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const yy = y.length === 2 ? '19' + y : y;
    return `${yy}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  // ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  return null;
}

function pickField(row: any, names: string[]): any {
  const keys = Object.keys(row);
  for (const n of names) {
    const k = keys.find(k => k.toLowerCase().trim().replace(/[_\s]/g, '') === n.toLowerCase().replace(/[_\s]/g, ''));
    if (k && row[k] !== undefined && row[k] !== '') return row[k];
  }
  return null;
}

export default function V8ContactPoolImportDialog({ open, onOpenChange, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [invalidCount, setInvalidCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ inserted: number; duplicates: number } | null>(null);

  const reset = () => {
    setFile(null); setParsed([]); setInvalidCount(0); setProgress(0); setResult(null);
  };

  const handleFile = async (f: File) => {
    setFile(f); setParsing(true); setParsed([]); setResult(null);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: false });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      const out: ParsedRow[] = [];
      let invalid = 0;
      const seen = new Set<string>();

      for (const row of json) {
        const cpfRaw = pickField(row, ['cpf', 'documento', 'document']);
        const cpf = cleanCpf(cpfRaw);
        if (!isValidCpf(cpf)) { invalid++; continue; }
        if (seen.has(cpf)) continue; // dedup intra-arquivo
        seen.add(cpf);

        const name = pickField(row, ['nome', 'name', 'fullname', 'nomecompleto']);
        const phone = pickField(row, ['telefone', 'phone', 'celular', 'fone']);
        const birth = pickField(row, ['datanascimento', 'birthdate', 'nascimento', 'dtnasc']);

        out.push({
          cpf,
          full_name: name ? String(name).trim() : null,
          phone: phone ? cleanCpf(phone) : null,
          birth_date: parseDate(birth),
          extra: row,
        });
      }

      setParsed(out);
      setInvalidCount(invalid);
      toast.success(`${out.length.toLocaleString('pt-BR')} contatos válidos | ${invalid} inválidos`);
    } catch (e: any) {
      toast.error('Erro ao ler arquivo: ' + e.message);
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!file || parsed.length === 0) return;
    setImporting(true); setProgress(0);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      // 1) Upload original
      const ts = Date.now();
      const path = `${userId}/${ts}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from('v8-contact-pool')
        .upload(path, file, { upsert: false });
      if (upErr) console.warn('Storage upload falhou:', upErr.message);

      // 2) Cria registro de import
      const { data: imp, error: impErr } = await supabase
        .from('v8_contact_pool_imports')
        .insert({
          file_name: file.name,
          storage_path: upErr ? null : path,
          row_count: parsed.length,
          invalid_count: invalidCount,
          status: 'processing',
          imported_by: userId,
        })
        .select('id')
        .single();
      if (impErr) throw impErr;

      // 3) Upsert por chunks
      let inserted = 0;
      let duplicates = 0;
      for (let i = 0; i < parsed.length; i += CHUNK_SIZE) {
        const chunk = parsed.slice(i, i + CHUNK_SIZE);
        const payload = chunk.map(c => ({
          cpf: c.cpf,
          full_name: c.full_name,
          phone: c.phone,
          birth_date: c.birth_date,
          extra: c.extra,
          source_file: file.name,
          source_batch_id: imp.id,
          imported_by: userId,
        }));

        const { data: ins, error: insErr } = await supabase
          .from('v8_contact_pool')
          .upsert(payload, { onConflict: 'cpf', ignoreDuplicates: true })
          .select('id');

        if (insErr) {
          console.error('Chunk error:', insErr);
          // tenta inserir um a um para não perder o lote inteiro
          for (const p of payload) {
            const { error: e1 } = await supabase.from('v8_contact_pool')
              .upsert(p, { onConflict: 'cpf', ignoreDuplicates: true });
            if (!e1) inserted++;
            else duplicates++;
          }
        } else {
          const insertedNow = ins?.length || 0;
          inserted += insertedNow;
          duplicates += chunk.length - insertedNow;
        }

        setProgress(Math.round(((i + chunk.length) / parsed.length) * 100));
      }

      // 4) Finaliza registro
      await supabase.from('v8_contact_pool_imports')
        .update({
          inserted_count: inserted,
          duplicate_count: duplicates,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', imp.id);

      setResult({ inserted, duplicates });
      toast.success(`Importação concluída: ${inserted} novos, ${duplicates} duplicados`);
      onImported();
    } catch (e: any) {
      toast.error('Erro na importação: ' + e.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!importing) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar contatos para o pool</DialogTitle>
          <DialogDescription>
            Aceita XLSX ou CSV. Colunas reconhecidas (qualquer ordem): <strong>cpf</strong>, <strong>nome</strong>, <strong>telefone</strong>, <strong>data_nascimento</strong>.
            CPFs duplicados são ignorados automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Arquivo</Label>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={importing}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {parsing && <div className="text-xs text-muted-foreground mt-2 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Lendo arquivo...</div>}
          </div>

          {parsed.length > 0 && !result && (
            <div className="rounded-lg bg-muted/30 p-3 text-sm space-y-1">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600" /> <strong>{parsed.length.toLocaleString('pt-BR')}</strong> contatos válidos prontos para importar</div>
              {invalidCount > 0 && (
                <div className="flex items-center gap-2 text-amber-600"><AlertTriangle className="w-4 h-4" /> {invalidCount} linhas com CPF inválido serão ignoradas</div>
              )}
            </div>
          )}

          {importing && (
            <div className="space-y-2">
              <Progress value={progress} />
              <div className="text-xs text-center text-muted-foreground">{progress}% — importando em blocos de {CHUNK_SIZE.toLocaleString('pt-BR')}</div>
            </div>
          )}

          {result && (
            <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3 text-sm">
              ✅ Importação concluída! <br />
              <strong>{result.inserted.toLocaleString('pt-BR')}</strong> novos contatos · <strong>{result.duplicates.toLocaleString('pt-BR')}</strong> já existiam (ignorados)
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={importing} onClick={() => { onOpenChange(false); reset(); }}>
            {result ? 'Fechar' : 'Cancelar'}
          </Button>
          {!result && (
            <Button onClick={handleImport} disabled={importing || parsed.length === 0} className="gap-2">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Importar {parsed.length > 0 ? `(${parsed.length.toLocaleString('pt-BR')})` : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
