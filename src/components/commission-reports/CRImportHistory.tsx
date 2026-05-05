import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Trash2, ClipboardList, AlertTriangle, Download, RotateCcw } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TSHead, applySortToData } from './CRSortUtils';
import { useTableState } from '@/hooks/useTableState';
import { TablePagination } from '@/components/common/TablePagination';
import { getSpreadsheetUrl } from '@/lib/storageUpload';

interface ImportBatch {
  id: string;
  module: string;
  sheet_name: string;
  file_name: string;
  row_count: number;
  imported_by: string;
  created_at: string;
  status: string;
  file_path?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deleted_reason?: string | null;
}
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
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const table = useTableState<ImportBatch>({ pageSize: 15, resetPageOn: [moduleFilter, showDeleted] });
  const { sort, toggleSort: toggle, page, setPage } = table;

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-for-batches'],
    queryFn: async () => { const { data } = await supabase.rpc('get_visible_profiles'); return (data || []) as unknown as Profile[]; }
  });

  const { data: batches = [], isLoading, refetch } = useQuery({
    queryKey: ['cr-import-batches', moduleFilter, showDeleted],
    queryFn: async () => {
      let q = supabase.from('import_batches' as any).select('*').eq('module', moduleFilter);
      if (!showDeleted) q = q.is('deleted_at', null);
      const { data, error } = await q.order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      return (data || []) as unknown as ImportBatch[];
    }
  });

  const getName = (userId: string | null | undefined) => {
    if (!userId) return '—';
    const p = profiles.find(pr => pr.user_id === userId);
    return p?.name || p?.email || userId.slice(0, 8);
  };
  const sheetLabel = (s: string) => ({ geral: 'Geral', repasse: 'Repasse', seguros: 'Seguros', base: 'Base' }[s] || s);

  const handleDownload = async (batch: ImportBatch) => {
    if (!batch.file_path) {
      toast({ title: 'Arquivo não disponível', description: 'Este lote foi importado antes do armazenamento de arquivos.', variant: 'destructive' });
      return;
    }
    const url = await getSpreadsheetUrl(batch.file_path);
    if (url) window.open(url, '_blank');
    else toast({ title: 'Erro ao gerar link de download', variant: 'destructive' });
  };

  const handleSoftDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // 1. Soft-delete das linhas de dados (apenas marca status; mantém os registros)
      const targetTable = mapSheetToTable(moduleFilter, deleteTarget.sheet_name);
      if (targetTable) {
        const { error: dataErr } = await supabase.from(targetTable as any).delete().eq('batch_id', deleteTarget.id);
        if (dataErr) throw dataErr;
      }
      // 2. Soft-delete do lote (com auditoria automática via RPC)
      const { error } = await supabase.rpc('soft_delete_import_batch' as any, {
        _batch_id: deleteTarget.id,
        _reason: deleteReason.trim() || null,
      });
      if (error) throw error;

      toast({ title: 'Lote excluído', description: `"${deleteTarget.file_name}" foi removido. Pode ser restaurado por 30 dias.` });
      setDeleteTarget(null);
      setDeleteReason('');
      refetch();
      queryClient.invalidateQueries({ queryKey: [`cr-${deleteTarget.sheet_name}`] });
    } catch (error: any) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async (batch: ImportBatch) => {
    try {
      const { error } = await supabase.rpc('restore_import_batch' as any, { _batch_id: batch.id });
      if (error) throw error;
      toast({
        title: 'Lote restaurado',
        description: `Cabeçalho de "${batch.file_name}" restaurado. ATENÇÃO: as linhas de dados não voltam — reimporte a planilha original.`,
      });
      refetch();
    } catch (error: any) {
      toast({ title: 'Erro ao restaurar', description: error.message, variant: 'destructive' });
    }
  };

  const { paged: paginated, totalPages, total: sortedTotal } = table.apply(batches, (b, k) => {
    if (k === 'imported_by') return getName(b.imported_by);
    return (b as any)[k];
  });
  const deletedCount = batches.filter(b => b.deleted_at).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2"><ClipboardList className="w-5 h-5" /> Histórico de Importações</span>
          <div className="flex items-center gap-2">
            <Label htmlFor="show-deleted" className="text-xs text-muted-foreground cursor-pointer">
              Mostrar excluídos {deletedCount > 0 && showDeleted && <Badge variant="secondary" className="ml-1 text-xs">{deletedCount}</Badge>}
            </Label>
            <Switch id="show-deleted" checked={showDeleted} onCheckedChange={setShowDeleted} />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {showDeleted && deletedCount > 0 && (
          <p className="text-xs text-muted-foreground mb-3 px-2 py-1.5 rounded bg-muted/40 border">
            ℹ️ <strong>Restaurar</strong> traz o cabeçalho do lote de volta, mas <strong>NÃO recupera as linhas excluídas</strong>. Para repor os dados, reimporte a planilha original.
          </p>
        )}
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : batches.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma importação encontrada.</p>
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
                    <TSHead label="Status" sortKey="deleted_at" sort={sort} toggle={toggle} tooltip="Ativo = dados existem; Excluído = soft-delete" />
                    <th className="w-12"></th>
                  </tr>
                </TableHeader>
                <TableBody>
                  {paginated.map(batch => {
                    const isDeleted = !!batch.deleted_at;
                    return (
                      <TableRow key={batch.id} className={isDeleted ? 'opacity-60 bg-muted/30' : ''}>
                        <TableCell className="font-medium text-sm">
                          {batch.file_name}
                          {isDeleted && batch.deleted_reason && (
                            <div className="text-xs text-muted-foreground mt-1 italic">"{batch.deleted_reason}"</div>
                          )}
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{sheetLabel(batch.sheet_name)}</Badge></TableCell>
                        <TableCell className="text-center">{batch.row_count}</TableCell>
                        <TableCell className="text-sm">
                          {getName(batch.imported_by)}
                          {isDeleted && batch.deleted_by && (
                            <div className="text-xs text-destructive mt-0.5">excluído por {getName(batch.deleted_by)}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(batch.created_at).toLocaleDateString('pt-BR')} {new Date(batch.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          {isDeleted && batch.deleted_at && (
                            <div className="text-xs text-destructive mt-0.5">excluído em {new Date(batch.deleted_at).toLocaleDateString('pt-BR')}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isDeleted ? 'destructive' : 'default'} className="text-xs">
                            {isDeleted ? 'Excluído' : 'Ativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="flex gap-1">
                          {batch.file_path ? (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleDownload(batch)} title="Baixar arquivo original"><Download className="w-4 h-4" /></Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/40 cursor-not-allowed" disabled title="Arquivo não arquivado (importação anterior ao armazenamento)"><Download className="w-4 h-4" /></Button>
                          )}
                          {isDeleted ? (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:text-primary" onClick={() => handleRestore(batch)} title="Restaurar lote (cabeçalho)"><RotateCcw className="w-4 h-4" /></Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(batch)} title="Excluir (soft-delete, restaurável por 30 dias)"><Trash2 className="w-4 h-4" /></Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <TablePagination page={page} totalPages={totalPages} total={sortedTotal} label="lotes" onChange={setPage} />

          </>
        )}
      </CardContent>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" /> Excluir Lote de Importação</DialogTitle>
            <DialogDescription className="pt-2">
              Esta ação remove o lote <strong>"{deleteTarget?.file_name}"</strong> ({deleteTarget?.row_count} registros) da listagem.
              <br /><br />
              <span className="text-xs">
                ✅ <strong>Recuperável por 30 dias</strong> via "Mostrar excluídos".<br />
                ⚠️ As linhas de dados são removidas permanentemente — restaurar volta apenas o cabeçalho.<br />
                📝 A ação fica registrada no log de auditoria.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-reason" className="text-xs">Motivo da exclusão (opcional, recomendado)</Label>
            <Textarea
              id="delete-reason"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Ex.: Importação duplicada / arquivo errado / dados de teste"
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteReason(''); }}>Cancelar</Button>
            <Button variant="destructive" onClick={handleSoftDelete} disabled={deleting}>
              {deleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Excluindo...</> : 'Excluir lote'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
