import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Pause, Play, Trash2, RefreshCw, Clock, CheckCircle2, XCircle, AlertCircle, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TSHead } from '@/components/commission-reports/CRSortUtils';
import { useTableState } from '@/hooks/useTableState';
import { TablePagination } from '@/components/common/TablePagination';
import SharedChipManager from '@/components/admin/SharedChipManager';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { EmptyStateNoAccess } from '@/components/common/EmptyStateNoAccess';
import { MenuOnlyScopeBanner } from '@/components/common/MenuOnlyScopeBanner';

interface QueueItem {
  id: string;
  chip_id: string;
  recipient_phone: string;
  message_content: string;
  status: string;
  priority: number;
  attempts: number;
  max_attempts: number;
  error_message: string | null;
  scheduled_at: string;
  processed_at: string | null;
  created_at: string;
  chip_name?: string;
}

const statusConfig: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  pending: { label: 'Pendente', className: 'bg-yellow-500/20 text-yellow-400', icon: Clock },
  processing: { label: 'Processando', className: 'bg-blue-500/20 text-blue-400', icon: RefreshCw },
  sent: { label: 'Enviado', className: 'bg-green-500/20 text-green-400', icon: CheckCircle2 },
  failed: { label: 'Erro', className: 'bg-destructive/20 text-destructive', icon: XCircle },
  paused: { label: 'Pausado', className: 'bg-orange-500/20 text-orange-400', icon: Pause },
  cancelled: { label: 'Cancelado', className: 'bg-muted text-muted-foreground', icon: XCircle },
};

export default function QueueManagement() {
  const { toast } = useToast();
  const [items, setItems] = useState<QueueItem[]>([]);
  const table = useTableState<QueueItem>({ pageSize: 50 });
  const { sort, toggleSort: toggle, page, setPage } = table;
  const [chips, setChips] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterChip, setFilterChip] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<{ action: string; ids: string[] } | null>(null);
  const { canSee, loading: accessLoading, isMenuOnly } = useFeatureAccess('queue');

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    const [queueRes, chipsRes] = await Promise.all([
      supabase.from('message_queue').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('chips').select('id, instance_name, nickname'),
    ]);
    if (queueRes.data) setItems(queueRes.data);
    if (chipsRes.data) {
      const map: Record<string, string> = {};
      chipsRes.data.forEach(c => { map[c.id] = c.nickname || c.instance_name; });
      setChips(map);
    }
    setLoading(false);
  };

  const handleBulkAction = async (action: string, ids: string[]) => {
    if (ids.length === 0) return;
    try {
      if (action === 'pause') {
        await supabase.from('message_queue').update({ status: 'paused' }).in('id', ids).eq('status', 'pending');
      } else if (action === 'resume') {
        await supabase.from('message_queue').update({ status: 'pending' }).in('id', ids).eq('status', 'paused');
      } else if (action === 'cancel') {
        await supabase.from('message_queue').update({ status: 'cancelled' }).in('id', ids).in('status', ['pending', 'paused']);
      } else if (action === 'delete') {
        await supabase.from('message_queue').delete().in('id', ids);
      } else if (action === 'retry') {
        await supabase.from('message_queue').update({ status: 'pending', attempts: 0, error_message: null }).in('id', ids).eq('status', 'failed');
      }
      toast({ title: `${ids.length} item(s) ${action === 'pause' ? 'pausados' : action === 'resume' ? 'retomados' : action === 'cancel' ? 'cancelados' : action === 'delete' ? 'excluídos' : 'reprocessados'}` });
      setSelectedItems(new Set());
      setConfirmAction(null);
      loadData();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(i => i.id)));
    }
  };

  const filteredItems = items.filter(item => {
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    if (filterChip !== 'all' && item.chip_id !== filterChip) return false;
    if (searchTerm && !item.recipient_phone.includes(searchTerm) && !item.message_content.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });
  useEffect(() => { setPage(0); }, [filterStatus, filterChip, searchTerm]);
  const { paged: pagedItems, totalPages, total: totalFiltered } = table.apply(filteredItems);

  const stats = {
    pending: items.filter(i => i.status === 'pending').length,
    processing: items.filter(i => i.status === 'processing').length,
    paused: items.filter(i => i.status === 'paused').length,
    failed: items.filter(i => i.status === 'failed').length,
    sent: items.filter(i => i.status === 'sent').length,
  };

  const formatDate = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const uniqueChipIds = [...new Set(items.map(i => i.chip_id))];

  if (loading || accessLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </DashboardLayout>
    );
  }
  if (!canSee) {
    return <DashboardLayout><EmptyStateNoAccess feature="Fila de Mensagens" /></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Fila & Atendimento</h1>
          <p className="text-muted-foreground text-sm">Gerencie filas de mensagens e atendimento compartilhado</p>
        </div>

        {isMenuOnly && <MenuOnlyScopeBanner feature="Fila" />}

        <Tabs defaultValue="queue">
          <TabsList>
            <TabsTrigger value="queue">Fila de Mensagens</TabsTrigger>
            <TabsTrigger value="shared" className="flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5" />
              Atendimento Compartilhado
            </TabsTrigger>
          </TabsList>

          <TabsContent value="shared" className="mt-4">
            <SharedChipManager />
          </TabsContent>

          <TabsContent value="queue" className="mt-4 space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Pendentes', value: stats.pending, color: 'text-yellow-400' },
            { label: 'Processando', value: stats.processing, color: 'text-blue-400' },
            { label: 'Pausadas', value: stats.paused, color: 'text-orange-400' },
            { label: 'Com Erro', value: stats.failed, color: 'text-destructive' },
            { label: 'Enviadas', value: stats.sent, color: 'text-green-400' },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4 text-center">
                <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters + Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar telefone ou conteúdo..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="paused">Pausados</SelectItem>
              <SelectItem value="failed">Com Erro</SelectItem>
              <SelectItem value="sent">Enviados</SelectItem>
              <SelectItem value="cancelled">Cancelados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterChip} onValueChange={setFilterChip}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Chip" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os chips</SelectItem>
              {uniqueChipIds.map(id => (
                <SelectItem key={id} value={id}>{chips[id] || id.slice(0, 8)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedItems.size > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="outline">{selectedItems.size} selecionados</Badge>
              <Button size="sm" variant="outline" onClick={() => setConfirmAction({ action: 'pause', ids: [...selectedItems] })}>
                <Pause className="w-3.5 h-3.5 mr-1" />Pausar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmAction({ action: 'resume', ids: [...selectedItems] })}>
                <Play className="w-3.5 h-3.5 mr-1" />Retomar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmAction({ action: 'retry', ids: [...selectedItems] })}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" />Reprocessar
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setConfirmAction({ action: 'cancel', ids: [...selectedItems] })}>
                <XCircle className="w-3.5 h-3.5 mr-1" />Cancelar
              </Button>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={loadData} title="Atualizar">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-380px)]">
              <Table>
                <TableHeader>
                  <tr>
                    <th className="w-10 px-4 py-2">
                      <input type="checkbox" checked={selectedItems.size === filteredItems.length && filteredItems.length > 0} onChange={toggleSelectAll} className="rounded" />
                    </th>
                    <TSHead label="Status" sortKey="status" sort={sort} toggle={toggle} className="text-xs" />
                    <TSHead label="Chip" sortKey="chip_id" sort={sort} toggle={toggle} className="text-xs" />
                    <TSHead label="Destinatário" sortKey="recipient_phone" sort={sort} toggle={toggle} className="text-xs" />
                    <TSHead label="Mensagem" sortKey="message_content" sort={sort} toggle={toggle} className="text-xs" />
                    <TSHead label="Tentativas" sortKey="attempts" sort={sort} toggle={toggle} className="text-xs" />
                    <TSHead label="Agendado" sortKey="scheduled_at" sort={sort} toggle={toggle} className="text-xs" />
                    <TSHead label="Erro" sortKey="error_message" sort={sort} toggle={toggle} className="text-xs" />
                  </tr>
                </TableHeader>
                <TableBody>
                  {pagedItems.map(item => {
                    const st = statusConfig[item.status] || statusConfig.pending;
                    const StIcon = st.icon;
                    return (
                      <TableRow key={item.id} className={cn(selectedItems.has(item.id) && 'bg-primary/5')}>
                        <TableCell>
                          <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => toggleSelect(item.id)} className="rounded" />
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('text-xs gap-1', st.className)}>
                            <StIcon className="w-3 h-3" />{st.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{chips[item.chip_id] || item.chip_id.slice(0, 8)}</TableCell>
                        <TableCell className="font-mono text-xs">{item.recipient_phone}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs">{item.message_content}</TableCell>
                        <TableCell className="text-xs">{item.attempts}/{item.max_attempts}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{formatDate(item.scheduled_at)}</TableCell>
                        <TableCell className="max-w-[150px] truncate text-xs text-destructive">{item.error_message || '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-12"><Clock className="w-8 h-8 mx-auto mb-2 opacity-40" /><p>Nenhum item na fila</p></TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
            <TablePagination page={page} totalPages={totalPages} total={totalFiltered} label="itens" onChange={setPage} />
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar ação</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action === 'cancel' ? 'Cancelar' : confirmAction?.action === 'pause' ? 'Pausar' : confirmAction?.action === 'resume' ? 'Retomar' : 'Reprocessar'} {confirmAction?.ids.length} item(s)?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmAction && handleBulkAction(confirmAction.action, confirmAction.ids)}>Sim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
