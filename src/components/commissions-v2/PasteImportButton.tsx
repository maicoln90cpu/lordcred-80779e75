import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ClipboardPaste, Loader2 } from 'lucide-react';
import { parseClipboardText } from '@/lib/clipboardParser';
import type { Profile } from './commissionUtils';
import { parseExcelDate, cleanCurrency } from './commissionUtils';

const POSITIONAL_HEADERS_11 = ['Data Pago', 'Produto', 'Banco', 'Prazo', 'Valor Liberado', 'Seguro', 'Telefone', 'Nome', 'CPF', 'Vendedor', 'ID'];

interface PasteImportButtonProps {
  profiles: Profile[];
  userId: string;
  onImported: () => void;
}

export default function PasteImportButton({ profiles, userId, onImported }: PasteImportButtonProps) {
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

  const findSellerByName = (name: string): string | null => {
    if (!name) return null;
    const q = name.toLowerCase().trim();
    const p = profiles.find(pr => pr.name?.toLowerCase().trim() === q || pr.email.toLowerCase() === q);
    return p?.user_id || null;
  };

  const doParse = (raw: string) => {
    const result = parseClipboardText(raw, POSITIONAL_HEADERS_11);
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

  const handleChange = (val: string) => { setText(val); doParse(val); };

  const handleImport = async () => {
    if (preview.length === 0) return;
    setImporting(true);
    try {
      const normalize = (s: string) => s?.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() || '';
      const findCol = (row: Record<string, string>, aliases: string[]) => {
        for (const alias of aliases) {
          const key = Object.keys(row).find(k => normalize(k) === normalize(alias));
          if (key && row[key]) return row[key];
        }
        return undefined;
      };

      let skipped = 0;
      const payloads: any[] = [];
      for (const row of preview) {
        const saleDate = parseExcelDate(findCol(row, ['Data Pago', 'data_pago', 'Data', 'data pago']));
        if (!saleDate) { skipped++; continue; }
        const bank = findCol(row, ['Banco', 'banco']) || '';
        const releasedValue = cleanCurrency(findCol(row, ['Valor Liberado', 'valor_liberado', 'Valor', 'valor liberado']));
        if (!bank || releasedValue <= 0) { skipped++; continue; }
        const sellerName = findCol(row, ['Vendedor', 'vendedor']) || '';
        payloads.push({
          sale_date: saleDate, product: findCol(row, ['Produto', 'produto']) || 'FGTS', bank,
          term: parseInt(findCol(row, ['Prazo', 'prazo']) || '') || null, released_value: releasedValue,
          has_insurance: (findCol(row, ['Seguro', 'seguro']) || '').toLowerCase().trim() === 'sim',
          client_cpf: findCol(row, ['CPF', 'cpf']) || null,
          client_name: findCol(row, ['Nome', 'nome', 'Cliente']) || null,
          client_phone: findCol(row, ['Telefone', 'telefone', 'Fone']) || null,
          seller_id: findSellerByName(sellerName) || userId,
          external_proposal_id: findCol(row, ['id', 'ID', 'Id Proposta']) || null,
          table_name: findCol(row, ['Tabela', 'tabela', 'Table']) || null,
          client_birth_date: findCol(row, ['Data Nascimento', 'data_nascimento', 'Nascimento']) || null,
          created_by: userId,
        });
      }
      if (payloads.length === 0) { toast({ title: 'Nenhum registro válido', variant: 'destructive' }); setImporting(false); return; }

      const { data: batchRecord, error: batchErr } = await supabase.from('import_batches' as any).insert({
        file_name: `colagem_${new Date().toISOString().slice(0, 10)}`, module: 'parceiros', sheet_name: 'base',
        row_count: payloads.length, imported_by: userId, status: 'active',
      } as any).select('id').single();
      const batchId = batchErr ? null : (batchRecord as any)?.id;
      if (batchId) payloads.forEach(p => { p.batch_id = batchId; });

      let errors = 0;
      for (let i = 0; i < payloads.length; i += 50) {
        const batch = payloads.slice(i, i + 50);
        const { error } = await supabase.from('commission_sales').insert(batch as any);
        if (error) { console.error('Batch error:', error); errors += batch.length; }
      }
      if (batchId && errors > 0) await supabase.from('import_batches' as any).update({ row_count: payloads.length - errors } as any).eq('id', batchId);

      toast({ title: 'Importação concluída', description: `${payloads.length - errors} registros${skipped > 0 ? `, ${skipped} ignorados` : ''}${errors > 0 ? `, ${errors} com erro` : ''}` });
      setOpen(false); setText(''); setPreview([]); setHeaders([]);
      onImported();
    } catch (err: any) {
      toast({ title: 'Erro na importação', description: err.message, variant: 'destructive' });
    } finally { setImporting(false); }
  };

  const totalPages = Math.ceil(preview.length / PREVIEW_PAGE_SIZE);
  const pagedRows = preview.slice(previewPage * PREVIEW_PAGE_SIZE, (previewPage + 1) * PREVIEW_PAGE_SIZE);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => { setOpen(true); setText(''); setPreview([]); setHeaders([]); setPreviewPage(0); }}>
        <ClipboardPaste className="w-4 h-4 mr-1" /> Colar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] w-[1200px] max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ClipboardPaste className="w-5 h-5" /> Importar Dados Colados</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Cole dados copiados do Excel, Google Sheets ou LibreOffice (Ctrl+V).</p>
          <textarea
            className="flex min-h-[100px] max-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-mono"
            placeholder="Cole os dados aqui (Ctrl+V)..."
            value={text} onChange={e => handleChange(e.target.value)} onPaste={handlePaste}
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
