import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClipboardPaste, Loader2 } from 'lucide-react';
import { parseClipboardText } from '@/lib/clipboardParser';
import type { ColumnDef } from './CRImportTab';

function cleanCurrency(v: any): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  const s = String(v).trim();
  if (s.includes(',')) {
    const c = s.replace(/[R$\s.]/g, '').replace(',', '.');
    const n = parseFloat(c);
    return isNaN(n) ? null : n;
  }
  const c = s.replace(/[R$\s]/g, '');
  const n = parseFloat(c);
  return isNaN(n) ? null : n;
}

function cleanPercent(v: any): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace('%', '').replace(',', '.').trim();
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

const normalize = (s: string) => s?.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.\-_']/g, ' ').replace(/\s+/g, ' ').trim() || '';

function cleanCPF(v: any): string {
  const s = String(v).trim();
  if (/e\+/i.test(s)) {
    const n = Number(s.replace(',', '.'));
    if (!isNaN(n)) {
      const digits = Math.round(n).toString().padStart(11, '0');
      return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
    }
  }
  return s;
}

function cleanDate(v: any): string | null {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(.*)$/);
  if (m) {
    let [, a, b, y, rest] = m;
    let year = y.length === 2 ? '20' + y : y;
    let day: string, month: string;
    if (parseInt(a) > 12) { day = a.padStart(2, '0'); month = b.padStart(2, '0'); }
    else if (parseInt(b) > 12) { month = a.padStart(2, '0'); day = b.padStart(2, '0'); }
    else { day = a.padStart(2, '0'); month = b.padStart(2, '0'); }
    const time = rest?.trim() || '';
    if (time) {
      const tm = time.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (tm) return `${year}-${month}-${day}T${tm[1].padStart(2,'0')}:${tm[2]}:${tm[3]||'00'}`;
    }
    return `${year}-${month}-${day}`;
  }
  return null;
}

interface CRPasteImportButtonProps {
  module: 'geral' | 'repasse' | 'seguros' | 'relatorio';
  tableName: string;
  columns: ColumnDef[];
  noHeader?: boolean;
  onImported: () => void;
}

export default function CRPasteImportButton({ module, tableName, columns, noHeader, onImported }: CRPasteImportButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [detectedFormat, setDetectedFormat] = useState('');
  const [parseStats, setParseStats] = useState({ rawLines: 0, emptyLines: 0 });
  const [importing, setImporting] = useState(false);
  const [previewPage, setPreviewPage] = useState(0);
  const PREVIEW_PAGE_SIZE = 20;

  // Build positional headers from column labels (for headerless paste)
  const positionalHeaders = columns.map(c => c.label);

  const doParse = (raw: string) => {
    // If noHeader is set, force positional mapping by prepending a fake non-date header row
    let textToParse = raw;
    if (noHeader) {
      // Insert a synthetic header line that won't look like a date, so parser treats row 0 as headers
      // Actually, we pass positionalHeaders so the parser will use them when first cell is not a date.
      // But the issue is first cell IS a number (not a date), so parser thinks it HAS headers.
      // Solution: we manually parse with positionalHeaders by manipulating the result.
      const result = parseClipboardText(raw, positionalHeaders);
      // If the parser detected headers (hasHeaders=true) but we know there are none,
      // re-parse treating all rows as data by prefixing a date-like dummy to trick detection
      // Better approach: just re-parse with a leading date row prefix
      if (!result.format.includes('sem cabeçalho')) {
        // Parser thought first row was headers — re-run by prefixing a fake date line
        const sep = raw.includes('\t') ? '\t' : raw.includes(';') ? ';' : ',';
        const fakeDateRow = '01/01/2000' + (sep + '').repeat(columns.length - 1);
        const reResult = parseClipboardText(fakeDateRow + '\n' + raw, positionalHeaders);
        // Remove the fake first data row
        reResult.rows.shift();
        reResult.rawLineCount = Math.max(0, reResult.rawLineCount - 1);
        setHeaders(reResult.headers);
        setPreview(reResult.rows);
        setDetectedFormat(reResult.format);
        setParseStats({ rawLines: reResult.rawLineCount, emptyLines: reResult.emptyLines });
        setPreviewPage(0);
        return;
      }
      setHeaders(result.headers);
      setPreview(result.rows);
      setDetectedFormat(result.format);
      setParseStats({ rawLines: result.rawLineCount, emptyLines: result.emptyLines });
      setPreviewPage(0);
      return;
    }
    const result = parseClipboardText(raw, positionalHeaders);
    setHeaders(result.headers);
    setPreview(result.rows);
    setDetectedFormat(result.format);
    setParseStats({ rawLines: result.rawLineCount, emptyLines: result.emptyLines });
    setPreviewPage(0);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    setText(pasted);
    doParse(pasted);
  };

  const handleChange = (val: string) => {
    setText(val);
    doParse(val);
  };

  const findColValue = (row: Record<string, string>, col: ColumnDef): string => {
    // Try label match first
    const allAliases = [col.label, ...col.aliases, col.key];
    for (const alias of allAliases) {
      const key = Object.keys(row).find(k => normalize(k) === normalize(alias));
      if (key && row[key] !== undefined) return row[key];
    }
    return '';
  };

  const handleImport = async () => {
    if (preview.length === 0 || !user) return;
    setImporting(true);
    try {
      const payloads: Record<string, any>[] = [];
      let skipped = 0;

      for (const row of preview) {
        const mapped: Record<string, any> = {};
        let hasAnyValue = false;

        for (const col of columns) {
          const raw = findColValue(row, col);
          switch (col.type) {
            case 'currency': mapped[col.key] = cleanCurrency(raw); break;
            case 'percent': mapped[col.key] = cleanPercent(raw); break;
            case 'integer': mapped[col.key] = raw ? parseInt(String(raw)) || null : null; break;
            case 'date': mapped[col.key] = cleanDate(raw); break;
            default: mapped[col.key] = raw != null ? String(raw) : '';
          }
          if (mapped[col.key] != null && mapped[col.key] !== '' && mapped[col.key] !== 0) hasAnyValue = true;
        }

        if (!hasAnyValue) { skipped++; continue; }
        payloads.push(mapped);
      }

      if (payloads.length === 0) {
        toast({ title: 'Nenhum registro válido encontrado', variant: 'destructive' });
        setImporting(false);
        return;
      }

      // Create import batch
      const { data: batch, error: batchErr } = await supabase.from('import_batches' as any).insert({
        module: 'relatorios', sheet_name: module,
        file_name: `colagem_${module}_${new Date().toISOString().slice(0, 10)}`,
        row_count: payloads.length, imported_by: user.id, status: 'active',
      } as any).select('id').single();
      if (batchErr) throw batchErr;
      const batchId = (batch as any).id;

      let errors = 0;
      for (let i = 0; i < payloads.length; i += 100) {
        const chunk = payloads.slice(i, i + 100).map(row => ({ ...row, batch_id: batchId }));
        const { error } = await supabase.from(tableName as any).insert(chunk as any);
        if (error) { console.error('Batch insert error:', error); errors += chunk.length; }
      }

      if (errors > 0) {
        await supabase.from('import_batches' as any).update({ row_count: payloads.length - errors } as any).eq('id', batchId);
      }

      toast({
        title: 'Importação concluída',
        description: `${payloads.length - errors} registros importados${skipped > 0 ? `, ${skipped} ignorados` : ''}${errors > 0 ? `, ${errors} com erro` : ''}`
      });
      setOpen(false); setText(''); setPreview([]); setHeaders([]);
      onImported();
    } catch (err: any) {
      toast({ title: 'Erro na importação', description: err.message, variant: 'destructive' });
    } finally { setImporting(false); }
  };

  const totalPages = Math.ceil(preview.length / PREVIEW_PAGE_SIZE);
  const pagedRows = preview.slice(previewPage * PREVIEW_PAGE_SIZE, (previewPage + 1) * PREVIEW_PAGE_SIZE);

  const moduleLabels: Record<string, string> = { geral: 'Geral', repasse: 'Repasse', seguros: 'Seguros', relatorio: 'Relatório' };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => { setOpen(true); setText(''); setPreview([]); setHeaders([]); setPreviewPage(0); }}>
        <ClipboardPaste className="w-4 h-4 mr-1" /> Colar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] w-[1200px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardPaste className="w-5 h-5" /> Colar Dados — {moduleLabels[module]}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Cole dados copiados do Excel, Google Sheets ou LibreOffice (Ctrl+V).
            {columns.length} colunas esperadas: {columns.map(c => c.label).join(', ')}.
          </p>
          <textarea
            className="flex min-h-[100px] max-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-mono"
            placeholder="Cole os dados aqui (Ctrl+V)..."
            value={text}
            onChange={e => handleChange(e.target.value)}
            onPaste={handlePaste}
          />
          {preview.length > 0 && (
            <div className="space-y-2 flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-xs">{detectedFormat}</Badge>
                  <span className="text-sm font-medium">{preview.length} registro(s) válido(s)</span>
                  {parseStats.emptyLines > 0 && <span className="text-xs text-muted-foreground">({parseStats.emptyLines} linhas vazias ignoradas)</span>}
                </div>
                <span className="text-xs text-muted-foreground">{headers.length} colunas detectadas</span>
              </div>
              <div className="border rounded-lg overflow-auto flex-1 min-h-0" style={{ maxHeight: '350px' }}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs text-muted-foreground w-10">#</TableHead>
                      {headers.map(h => <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedRows.map((row, i) => (
                      <TableRow key={previewPage * PREVIEW_PAGE_SIZE + i}>
                        <TableCell className="text-xs text-muted-foreground py-1">{previewPage * PREVIEW_PAGE_SIZE + i + 1}</TableCell>
                        {headers.map(h => <TableCell key={h} className="text-xs py-1 whitespace-nowrap max-w-[200px] truncate">{row[h]}</TableCell>)}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-1">
                  <Button variant="outline" size="sm" disabled={previewPage === 0} onClick={() => setPreviewPage(p => p - 1)}>Anterior</Button>
                  <span className="text-xs text-muted-foreground">Página {previewPage + 1} de {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={previewPage >= totalPages - 1} onClick={() => setPreviewPage(p => p + 1)}>Próxima</Button>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleImport} disabled={importing || preview.length === 0}>
              {importing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importando...</> : `Importar ${preview.length} registro(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
