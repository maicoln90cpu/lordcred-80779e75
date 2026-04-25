import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Trash2, ClipboardList, AlertTriangle, Download } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TSHead, useSortState, applySortToData } from './CRSortUtils';
import { getSpreadsheetUrl } from '@/lib/storageUpload';

interface ImportBatch { id: string; module: string; sheet_name: string; file_name: string; row_count: number; imported_by: string; created_at: string; status: string; file_path?: string | null; }
interface Profile { user_id: string; name: string | null; email: string; }

export type CRImportModule = 'relatorios' | 'parceiros' | 'parceiros_v2';

interface CRImportHistoryProps { moduleFilter: CRImportModule; }

/**
 * Mapeia (módulo, aba) → tabela física que armazena as linhas importadas.
 * IMPORTANTE: V1 (parceiros) → commission_sales; V2 (parceiros_v2) → commission_sales_v2.
 * Misturar isso causa exclusão cruzada de dados (bug crítico já visto em produção).
 */
export function mapSheetToTable(moduleFilter: CRImportModule, sheetName: string): string | null {
  if (moduleFilter === 'parceiros_v2' && sheetName === 'base') return 'commission_sales_v2';
  if (moduleFilter === 'parceiros' && sheetName === 'base') return 'commission_sales';
  const tableMap: Record<string, string> = { geral: 'cr_geral', repasse: 'cr_repasse', seguros: 'cr_seguros', relatorio: 'cr_relatorio' };
  return tableMap[sheetName] || null;
}

export default function CRImportHistory({ moduleFilter }: CRImportHistoryProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<ImportBatch | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 15;
  const { sort, toggle } = useSortState();

  const { data: profiles = [] } = useQuery({ queryKey: ['profiles-for-batches'], queryFn: async () => { const { data } = await supabase.rpc('get_visible_profiles'); return (data || []) as unknown as Profile[]; } });
  const { data: batches = [], isLoading, refetch } = useQuery({
    queryKey: ['cr-import-batches', moduleFilter],
    queryFn: async () => { const { data, error } = await supabase.from('import_batches' as any).select('*').eq('module', moduleFilter).order('created_at', { ascending: false }).limit(500); if (error) throw error; return (data || []) as unknown as ImportBatch[]; }
  });

  const getName = (userId: string) => { const p = profiles.find(pr => pr.user_id === userId); return p?.name || p?.email || userId.slice(0, 8); };
  const sheetLabel = (s: string) => ({ geral: 'Geral', repasse: 'Repasse', seguros: 'Seguros', base: 'Base' }[s] || s);

  const handleDownload = async (batch: ImportBatch) => {
    if (!batch.file_path) {
      toast({ title: 'Arquivo não disponível', description: 'Este lote foi importado antes do armazenamento de arquivos.', variant: 'destructive' });
      return;
    }
    const url = await getSpreadsheetUrl(batch.file_path);
    if (url) {
      window.open(url, '_blank');
    } else {
      toast({ title: 'Erro ao gerar link de download', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const targetTable = mapSheetToTable(moduleFilter, deleteTarget.sheet_name);
      if (targetTable) { const { error: dataErr } = await supabase.from(targetTable as any).delete().eq('batch_id', deleteTarget.id); if (dataErr) throw dataErr; }
      const { error } = await supabase.from('import_batches' as any).delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast({ title: `Lote "${deleteTarget.file_name}" excluído com sucesso` });
      setDeleteTarget(null); refetch();
      queryClient.invalidateQueries({ queryKey: [`cr-${deleteTarget.sheet_name}`] });
    } catch (error: any) { toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' }); }
    finally { setDeleting(false); }
  };

  const sorted = applySortToData(batches, sort, (b, k) => {
    if (k === 'imported_by') return getName(b.imported_by);
    return (b as any)[k];
  });
  const paginated = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(sorted.length / pageSize);

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ClipboardList className="w-5 h-5" /> Histórico de Importações</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : batches.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma importação realizada.</p>
        ) : (
          <>
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <tr>
                    <TSHead label="Arquivo" sortKey="file_name" sort={sort} toggle={toggle} tooltip="Nome do arquivo Excel importado" />
                    <TSHead label="Aba" sortKey="sheet_name" sort={sort} toggle={toggle} tooltip="Módulo/aba de destino dos dados" />
                    <TSHead label="Registros" sortKey="row_count" sort={sort} toggle={toggle} tooltip="Quantidade de linhas importadas" className="text-center" />
                    <TSHead label="Importado por" sortKey="imported_by" sort={sort} toggle={toggle} tooltip="Usuário que realizou a importação" />
                    <TSHead label="Data" sortKey="created_at" sort={sort} toggle={toggle} tooltip="Data e hora da importação" />
                    <TSHead label="Status" sortKey="status" sort={sort} toggle={toggle} tooltip="Ativo = dados existem; Excluído = removido" />
                    <th className="w-12"></th>
                  </tr>
                </TableHeader>
                <TableBody>
                  {paginated.map(batch => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium text-sm">{batch.file_name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{sheetLabel(batch.sheet_name)}</Badge></TableCell>
                      <TableCell className="text-center">{batch.row_count}</TableCell>
                      <TableCell className="text-sm">{getName(batch.imported_by)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(batch.created_at).toLocaleDateString('pt-BR')} {new Date(batch.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</TableCell>
                      <TableCell><Badge variant={batch.status === 'active' ? 'default' : 'secondary'} className="text-xs">{batch.status === 'active' ? 'Ativo' : 'Excluído'}</Badge></TableCell>
                      <TableCell className="flex gap-1">
                        {batch.file_path && <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleDownload(batch)} title="Baixar arquivo original"><Download className="w-4 h-4" /></Button>}
                        {batch.status === 'active' && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(batch)}><Trash2 className="w-4 h-4" /></Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-muted-foreground">Página {page + 1} de {totalPages}</span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Próxima</Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" /> Excluir Lote de Importação</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Esta ação excluirá permanentemente o lote <strong>"{deleteTarget?.file_name}"</strong> e todos os <strong>{deleteTarget?.row_count}</strong> registros associados.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Excluindo...</> : 'Excluir'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
