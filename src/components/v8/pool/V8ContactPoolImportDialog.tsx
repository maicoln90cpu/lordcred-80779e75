import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Loader2, Upload, CheckCircle2, AlertTriangle, Server } from 'lucide-react';
import { toast } from 'sonner';
import { loadXLSX } from '@/lib/xlsx-lazy';
import { supabase } from '@/integrations/supabase/client';

/** Converte serial date Excel (1899-12-30 epoch + bug 1900) — substitui excelSerialToParts
 *  para evitar carregar a lib xlsx só para parsing de data. */
function excelSerialToParts(serial: number): { y: number; m: number; d: number; H: number; M: number } | null {
  if (!isFinite(serial)) return null;
  const date = new Date(Date.UTC(1899, 11, 30) + Math.round(serial * 86400 * 1000));
  if (isNaN(date.getTime())) return null;
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate(), H: date.getUTCHours(), M: date.getUTCMinutes() };
}


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

const CHUNK_SIZE = 1000;            // upsert frontend
const WORKER_THRESHOLD_BYTES = 8 * 1024 * 1024;  // > 8MB → worker
const WORKER_THRESHOLD_ROWS = 30000;             // > 30k linhas → worker

const EXTRA_FIELDS = ['genero', 'sexo', 'banco', 'agencia', 'conta', 'mae', 'observacao', 'idade', 'origem'];

function cleanCpf(v: any): string {
  return String(v ?? '').replace(/\D/g, '');
}
function isValidCpf(cpf: string): boolean {
  return cpf.length === 11 && !/^(\d)\1+$/.test(cpf);
}
function parseDate(v: any): string | null {
  if (!v) return null;
  if (typeof v === 'number') {
    const d = excelSerialToParts(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const yy = y.length === 2 ? '19' + y : y;
    return `${yy}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  return null;
}
function pickField(row: any, names: string[]): any {
  const keys = Object.keys(row);
  for (const n of names) {
    const target = n.toLowerCase().replace(/[_\s]/g, '');
    const k = keys.find(k => k.toLowerCase().trim().replace(/[_\s]/g, '') === target);
    if (k && row[k] !== undefined && row[k] !== '' && row[k] !== null) return row[k];
  }
  return null;
}
function buildExtra(row: any): Record<string, any> {
  const extra: Record<string, any> = {};
  for (const k of Object.keys(row)) {
    const norm = k.toLowerCase().trim().replace(/[_\s]/g, '');
    if (EXTRA_FIELDS.some(f => norm.includes(f))) extra[k] = row[k];
  }
  return extra;
}

export default function V8ContactPoolImportDialog({ open, onOpenChange, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [invalidCount, setInvalidCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ inserted: number; duplicates: number } | null>(null);
  const [useWorker, setUseWorker] = useState(false);
  const [workerImportId, setWorkerImportId] = useState<string | null>(null);
  const [workerStatus, setWorkerStatus] = useState<{
    status: string; processed: number; inserted: number; duplicates: number; total: number; pct: number;
  } | null>(null);

  const reset = () => {
    setFile(null); setParsed([]); setInvalidCount(0); setProgress(0); setResult(null);
    setUseWorker(false); setWorkerImportId(null); setWorkerStatus(null);
  };

  // Realtime do progresso quando rodando no worker
  useEffect(() => {
    if (!workerImportId) return;
    const ch = supabase
      .channel(`pool-import-${workerImportId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'v8_contact_pool_imports',
        filter: `id=eq.${workerImportId}`,
      }, (payload: any) => {
        const r = payload.new;
        setWorkerStatus({
          status: r.status,
          processed: r.processed_count || 0,
          inserted: r.inserted_count || 0,
          duplicates: r.duplicate_count || 0,
          total: r.row_count || 0,
          pct: r.progress_percent || 0,
        });
        if (r.status === 'completed') {
          setResult({ inserted: r.inserted_count || 0, duplicates: r.duplicate_count || 0 });
          setImporting(false);
          toast.success(`Importação concluída: ${r.inserted_count} novos, ${r.duplicate_count} duplicados`);
          onImported();
        } else if (r.status === 'failed') {
          setImporting(false);
          toast.error('Importação falhou: ' + (r.error_message || 'erro desconhecido'));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [workerImportId, onImported]);

  const handleFile = async (f: File) => {
    setFile(f); setParsed([]); setResult(null); setWorkerStatus(null);

    // Decide modo: worker se grande, frontend se pequeno
    const bigBySize = f.size > WORKER_THRESHOLD_BYTES;
    if (bigBySize) {
      setUseWorker(true);
      toast.info(`Arquivo grande (${(f.size / 1024 / 1024).toFixed(1)} MB) — será processado em background.`);
      return;
    }

    setParsing(true);
    try {
      const XLSX = await loadXLSX();
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: false });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      // Se tem MUITAS linhas, força worker (evita travar o navegador)
      if (json.length > WORKER_THRESHOLD_ROWS) {
        setUseWorker(true);
        setParsed([]);
        toast.info(`${json.length.toLocaleString('pt-BR')} linhas — usando processamento em background.`);
        return;
      }

      const out: ParsedRow[] = [];
      let invalid = 0;
      const seen = new Set<string>();

      for (const row of json) {
        const cpf = cleanCpf(pickField(row, ['cpf', 'documento', 'document']));
        if (!isValidCpf(cpf)) { invalid++; continue; }
        if (seen.has(cpf)) continue;
        seen.add(cpf);

        const name = pickField(row, ['nome', 'name', 'fullname', 'nomecompleto']);
        const phone = pickField(row, ['telefone', 'phone', 'celular', 'fone']);
        const birth = pickField(row, ['datanascimento', 'birthdate', 'nascimento', 'dtnasc']);

        out.push({
          cpf,
          full_name: name ? String(name).trim().slice(0, 200) : null,
          phone: phone ? cleanCpf(phone) : null,
          birth_date: parseDate(birth),
          extra: buildExtra(row),  // enxuto: só campos úteis
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

  const handleImportFrontend = async () => {
    if (!file || parsed.length === 0) return;
    setImporting(true); setProgress(0);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const ts = Date.now();
      const path = `${userId}/${ts}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from('v8-contact-pool')
        .upload(path, file, { upsert: false });
      if (upErr) console.warn('Storage upload falhou:', upErr.message);

      const { data: imp, error: impErr } = await supabase
        .from('v8_contact_pool_imports')
        .insert({
          file_name: file.name,
          storage_path: upErr ? null : path,
          row_count: parsed.length,
          invalid_count: invalidCount,
          status: 'processing',
          imported_by: userId,
          mode: 'frontend',
        } as any)
        .select('id')
        .single();
      if (impErr) throw impErr;

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
          for (const p of payload) {
            const { error: e1 } = await supabase.from('v8_contact_pool')
              .upsert(p, { onConflict: 'cpf', ignoreDuplicates: true });
            if (!e1) inserted++; else duplicates++;
          }
        } else {
          const ic = ins?.length || 0;
          inserted += ic;
          duplicates += chunk.length - ic;
        }
        setProgress(Math.round(((i + chunk.length) / parsed.length) * 100));
      }

      await supabase.from('v8_contact_pool_imports')
        .update({
          inserted_count: inserted,
          duplicate_count: duplicates,
          status: 'completed',
          completed_at: new Date().toISOString(),
          progress_percent: 100,
          processed_count: parsed.length,
        } as any)
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

  const handleImportWorker = async () => {
    if (!file) return;
    setImporting(true); setProgress(0);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      // 1) Converter XLSX/XLSM/XLS -> CSV no navegador (worker só lê CSV em streaming)
      let uploadBlob: Blob;
      let uploadName: string;
      const ext = file.name.toLowerCase().split('.').pop() || '';
      if (ext === 'csv') {
        uploadBlob = file;
        uploadName = file.name;
      } else {
        toast.info('Convertendo planilha para CSV (pode levar 30s para arquivos grandes)...');
        const XLSX = await loadXLSX();
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array', cellDates: false });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ',' });
        uploadBlob = new Blob([csv], { type: 'text/csv' });
        uploadName = file.name.replace(/\.(xlsx|xlsm|xls)$/i, '.csv');
        toast.success(`Convertido: ${(uploadBlob.size / 1024 / 1024).toFixed(1)} MB CSV`);
      }

      // 2) Upload CSV
      const ts = Date.now();
      const path = `${userId}/${ts}-${uploadName}`;
      const { error: upErr } = await supabase.storage
        .from('v8-contact-pool')
        .upload(path, uploadBlob, { upsert: false, contentType: 'text/csv' });
      if (upErr) throw new Error('Falha no upload: ' + upErr.message);

      // 3) Cria registro queued
      const { data: imp, error: impErr } = await supabase
        .from('v8_contact_pool_imports')
        .insert({
          file_name: uploadName,
          storage_path: path,
          row_count: 0,
          invalid_count: 0,
          status: 'queued',
          imported_by: userId,
          mode: 'worker',
        } as any)
        .select('id')
        .single();
      if (impErr) throw impErr;

      setWorkerImportId(imp.id);

      // 4) Dispara o worker (responde imediatamente, processa em background)
      supabase.functions.invoke('v8-pool-import-worker', {
        body: { import_id: imp.id },
      }).catch((e) => console.error('worker invoke err:', e));

      toast.success('Importação iniciada em background. Você pode fechar esta janela.');
    } catch (e: any) {
      toast.error('Erro ao iniciar: ' + e.message);
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!importing) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar contatos para o pool</DialogTitle>
          <DialogDescription>
            Aceita <strong>XLSX, XLSM, XLS ou CSV</strong>. Colunas reconhecidas (qualquer ordem):{' '}
            <strong>cpf</strong>, <strong>nome</strong>, <strong>telefone</strong>, <strong>data_nascimento</strong>.
            CPFs duplicados são ignorados. Arquivos grandes (&gt;8MB ou &gt;30k linhas) são processados em background.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Arquivo</Label>
            <Input
              type="file"
              accept=".xlsx,.xlsm,.xls,.csv"
              disabled={importing}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {parsing && <div className="text-xs text-muted-foreground mt-2 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Lendo arquivo...</div>}
          </div>

          {useWorker && file && !workerStatus && !result && (
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3 text-sm space-y-1">
              <div className="flex items-center gap-2 font-medium"><Server className="w-4 h-4 text-blue-600" /> Modo background ativado</div>
              <div className="text-xs text-muted-foreground">
                Arquivo: <strong>{file.name}</strong> ({(file.size / 1024 / 1024).toFixed(1)} MB).
                Será enviado e processado no servidor — você pode fechar esta janela e acompanhar no histórico.
              </div>
            </div>
          )}

          {!useWorker && parsed.length > 0 && !result && (
            <div className="rounded-lg bg-muted/30 p-3 text-sm space-y-1">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600" /> <strong>{parsed.length.toLocaleString('pt-BR')}</strong> contatos válidos prontos para importar</div>
              {invalidCount > 0 && (
                <div className="flex items-center gap-2 text-amber-600"><AlertTriangle className="w-4 h-4" /> {invalidCount} linhas com CPF inválido serão ignoradas</div>
              )}
            </div>
          )}

          {/* Progresso frontend */}
          {importing && !useWorker && (
            <div className="space-y-2">
              <Progress value={progress} />
              <div className="text-xs text-center text-muted-foreground">{progress}% — importando em blocos de {CHUNK_SIZE.toLocaleString('pt-BR')}</div>
            </div>
          )}

          {/* Progresso worker (realtime) */}
          {useWorker && workerStatus && !result && (
            <div className="space-y-2">
              <Progress value={workerStatus.pct} />
              <div className="text-xs text-center text-muted-foreground">
                {workerStatus.status === 'queued' && 'Aguardando worker iniciar...'}
                {workerStatus.status === 'processing' && (
                  <>
                    {workerStatus.pct}% — {workerStatus.processed.toLocaleString('pt-BR')}
                    {workerStatus.total > 0 ? ` / ${workerStatus.total.toLocaleString('pt-BR')}` : ''} processados
                    {' · '}
                    {workerStatus.inserted.toLocaleString('pt-BR')} novos / {workerStatus.duplicates.toLocaleString('pt-BR')} duplicados
                  </>
                )}
              </div>
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
          <Button variant="outline" disabled={importing && !useWorker} onClick={() => { onOpenChange(false); reset(); }}>
            {result ? 'Fechar' : useWorker && importing ? 'Fechar (continua em background)' : 'Cancelar'}
          </Button>
          {!result && !useWorker && (
            <Button onClick={handleImportFrontend} disabled={importing || parsed.length === 0} className="gap-2">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Importar {parsed.length > 0 ? `(${parsed.length.toLocaleString('pt-BR')})` : ''}
            </Button>
          )}
          {!result && useWorker && (
            <Button onClick={handleImportWorker} disabled={importing || !file} className="gap-2">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
              Iniciar em background
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
