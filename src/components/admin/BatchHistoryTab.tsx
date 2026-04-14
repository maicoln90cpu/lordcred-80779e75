import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, Trash2, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface BatchHistoryTabProps {
  allLeads: any[];
  getSellerName: (userId: string) => string;
}

type SortField = 'batch' | 'seller' | 'total' | 'pct' | 'created';

export default function BatchHistoryTab({ allLeads, getSellerName }: BatchHistoryTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deletingBatch, setDeletingBatch] = useState<string | null>(null);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);
  const [batchPage, setBatchPage] = useState(1);
  const [batchSortField, setBatchSortField] = useState<SortField>('created');
  const [batchSortDir, setBatchSortDir] = useState<'asc' | 'desc'>('desc');
  const BATCH_PAGE_SIZE = 15;

  const batchHistory = useMemo(() => {
    const map = new Map<string, { batch: string; seller: string; total: number; contacted: number; created: string }>();
    allLeads.forEach((l: any) => {
      const batchName = l.batch_name || 'Sem lote';
      const key = `${batchName}::${l.assigned_to}`;
      if (!map.has(key)) map.set(key, { batch: batchName, seller: l.assigned_to, total: 0, contacted: 0, created: l.created_at });
      const entry = map.get(key)!;
      entry.total++;
      if (l.status !== 'pendente') entry.contacted++;
      if (l.created_at < entry.created) entry.created = l.created_at;
    });
    return Array.from(map.values());
  }, [allLeads]);

  const sortedBatchHistory = useMemo(() => {
    return [...batchHistory].sort((a, b) => {
      let cmp = 0;
      switch (batchSortField) {
        case 'batch': cmp = a.batch.localeCompare(b.batch); break;
        case 'seller': cmp = getSellerName(a.seller).localeCompare(getSellerName(b.seller)); break;
        case 'total': cmp = a.total - b.total; break;
        case 'pct': cmp = (a.total > 0 ? a.contacted / a.total : 0) - (b.total > 0 ? b.contacted / b.total : 0); break;
        case 'created': cmp = a.created.localeCompare(b.created); break;
      }
      return batchSortDir === 'asc' ? cmp : -cmp;
    });
  }, [batchHistory, batchSortField, batchSortDir, getSellerName]);

  const batchTotalPages = Math.max(1, Math.ceil(sortedBatchHistory.length / BATCH_PAGE_SIZE));
  const paginatedBatch = sortedBatchHistory.slice((batchPage - 1) * BATCH_PAGE_SIZE, batchPage * BATCH_PAGE_SIZE);

  const toggleSort = (field: SortField) => {
    if (batchSortField === field) setBatchSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setBatchSortField(field); setBatchSortDir(field === 'created' ? 'desc' : 'asc'); }
    setBatchPage(1);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (batchSortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return batchSortDir === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const handleDeleteBatch = async () => {
    if (!deletingBatch) return;
    setIsDeletingBatch(true);
    try {
      let deleted = 0;
      while (true) {
        const { data, error } = await supabase.from('client_leads').delete().eq('batch_name', deletingBatch).select('id').limit(1000);
        if (error) throw error;
        if (!data || data.length === 0) break;
        deleted += data.length;
      }
      toast({ title: `Lote "${deletingBatch}" excluído`, description: `${deleted} leads removidos` });
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
      queryClient.invalidateQueries({ queryKey: ['admin-leads-metrics'] });
      setDeletingBatch(null);
    } catch (e: any) {
      toast({ title: 'Erro ao excluir lote', description: e.message, variant: 'destructive' });
    } finally {
      setIsDeletingBatch(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader><CardTitle>Histórico de Importações</CardTitle></CardHeader>
        <CardContent>
          {batchHistory.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhum lote importado.</p>
          ) : (
            <>
              <div className="border rounded-lg overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('batch')}><span className="flex items-center">Lote<SortIcon field="batch" /></span></TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('seller')}><span className="flex items-center">Vendedor<SortIcon field="seller" /></span></TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('total')}><span className="flex items-center">Qtd Leads<SortIcon field="total" /></span></TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('pct')}><span className="flex items-center">% Contatados<SortIcon field="pct" /></span></TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('created')}><span className="flex items-center">Data<SortIcon field="created" /></span></TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedBatch.map((b) => {
                      const pct = b.total > 0 ? Math.round((b.contacted / b.total) * 100) : 0;
                      return (
                        <TableRow key={`${b.batch}::${b.seller}`}>
                          <TableCell className="font-medium">{b.batch}</TableCell>
                          <TableCell>{getSellerName(b.seller)}</TableCell>
                          <TableCell>{b.total}</TableCell>
                          <TableCell><div className="flex items-center gap-2"><Progress value={pct} className="h-2 w-20" /><span className="text-xs text-muted-foreground">{pct}%</span></div></TableCell>
                          <TableCell className="text-sm text-muted-foreground">{new Date(b.created).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell><Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeletingBatch(b.batch)}><Trash2 className="w-4 h-4" /></Button></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {batchTotalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-muted-foreground">{sortedBatchHistory.length} lotes • Página {batchPage} de {batchTotalPages}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={batchPage <= 1} onClick={() => setBatchPage(p => p - 1)}><ChevronLeft className="w-4 h-4 mr-1" /> Anterior</Button>
                    <Button variant="outline" size="sm" disabled={batchPage >= batchTotalPages} onClick={() => setBatchPage(p => p + 1)}>Próximo <ChevronRight className="w-4 h-4 ml-1" /></Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deletingBatch} onOpenChange={(open) => !open && setDeletingBatch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lote "{deletingBatch}"?</AlertDialogTitle>
            <AlertDialogDescription>Todos os leads deste lote serão permanentemente excluídos. Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingBatch}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBatch} disabled={isDeletingBatch} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeletingBatch ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
