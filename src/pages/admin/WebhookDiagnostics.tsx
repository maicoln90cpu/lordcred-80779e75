import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Search, Eye, Webhook, RefreshCw, Clock, Flame, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TSHead } from '@/components/commission-reports/CRSortUtils';
import { useTableState } from '@/hooks/useTableState';
import { TablePagination } from '@/components/common/TablePagination';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { EmptyStateNoAccess } from '@/components/common/EmptyStateNoAccess';
import { MenuOnlyScopeBanner } from '@/components/common/MenuOnlyScopeBanner';

interface WebhookLog {
  id: string;
  chip_id: string | null;
  instance_name: string | null;
  event_type: string;
  payload: any;
  status_code: number;
  processing_result: string | null;
  created_at: string;
}

const eventColors: Record<string, string> = {
  messages: 'bg-green-500/20 text-green-400',
  chats: 'bg-blue-500/20 text-blue-400',
  messages_update: 'bg-yellow-500/20 text-yellow-400',
  'connection.update': 'bg-purple-500/20 text-purple-400',
  'qrcode.updated': 'bg-orange-500/20 text-orange-400',
};

export default function WebhookDiagnostics() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const table = useTableState<WebhookLog>({ pageSize: 50 });
  const { sort, toggleSort: toggle, page, setPage } = table;
  const [chipsMap, setChipsMap] = useState<Record<string, { name: string; chipType: string }>>({});
  const [connectedChips, setConnectedChips] = useState<number>(0);
  const [totalChips, setTotalChips] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEvent, setFilterEvent] = useState('all');
  const [filterChip, setFilterChip] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
  const { canSee, loading: accessLoading, isMenuOnly } = useFeatureAccess('webhooks');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [logsRes, chipsRes] = await Promise.all([
      supabase.from('webhook_logs').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('chips').select('id, instance_name, nickname, chip_type, status'),
    ]);
    if (logsRes.data) setLogs(logsRes.data);
    if (chipsRes.data) {
      const map: Record<string, { name: string; chipType: string }> = {};
      chipsRes.data.forEach(c => {
        map[c.id] = { name: c.nickname || c.instance_name, chipType: c.chip_type || 'warming' };
      });
      setChipsMap(map);
      setTotalChips(chipsRes.data.length);
      setConnectedChips(chipsRes.data.filter((c: any) => c.status === 'connected').length);
    }
    setLoading(false);
  };

  const getSource = (chipId: string | null): 'warming' | 'chat' | 'unknown' => {
    if (!chipId || !chipsMap[chipId]) return 'unknown';
    return chipsMap[chipId].chipType === 'whatsapp' ? 'chat' : 'warming';
  };

  const filteredLogs = logs.filter(log => {
    if (filterEvent !== 'all' && log.event_type !== filterEvent) return false;
    if (filterChip !== 'all' && log.chip_id !== filterChip) return false;
    if (filterSource !== 'all') {
      const source = getSource(log.chip_id);
      if (filterSource === 'warming' && source !== 'warming') return false;
      if (filterSource === 'chat' && source !== 'chat') return false;
    }
    if (searchTerm && !log.instance_name?.toLowerCase().includes(searchTerm.toLowerCase()) && !log.processing_result?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const uniqueEvents = [...new Set(logs.map(l => l.event_type))];
  const uniqueChipIds = [...new Set(logs.filter(l => l.chip_id).map(l => l.chip_id!))];

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (loading || accessLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </DashboardLayout>
    );
  }
  if (!canSee) {
    return <DashboardLayout><EmptyStateNoAccess feature="Diagnóstico de Webhooks" /></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Webhook className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Diagnóstico de Webhooks</h1>
            <p className="text-muted-foreground text-sm">Histórico de eventos recebidos da UazAPI</p>
          </div>
        </div>

        {isMenuOnly && <MenuOnlyScopeBanner feature="Webhooks" />}

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar instância ou resultado..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterEvent} onValueChange={setFilterEvent}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os eventos</SelectItem>
              {[...uniqueEvents].sort((a, b) => a.localeCompare(b, 'pt-BR')).map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterChip} onValueChange={setFilterChip}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os chips</SelectItem>
              {[...uniqueChipIds].sort((a, b) => (chipsMap[a]?.name || a).localeCompare(chipsMap[b]?.name || b, 'pt-BR')).map(id => (
                <SelectItem key={id} value={id}>{chipsMap[id]?.name || id.slice(0, 8)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as origens</SelectItem>
              <SelectItem value="warming">🔥 Aquecimento</SelectItem>
              <SelectItem value="chat">💬 Chat Vendedores</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="gap-1">
            <Clock className="w-3 h-3" />{filteredLogs.length} registros
          </Badge>
          <Button variant="ghost" size="icon" onClick={loadData}><RefreshCw className="w-4 h-4" /></Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-280px)]">
              <Table>
                <TableHeader>
                  <tr>
                    <TSHead label="Data/Hora" sortKey="created_at" sort={sort} toggle={toggle} className="text-xs" />
                    <TSHead label="Instância" sortKey="instance_name" sort={sort} toggle={toggle} className="text-xs" />
                    <TSHead label="Origem" sortKey="chip_id" sort={sort} toggle={toggle} className="text-xs" />
                    <TSHead label="Evento" sortKey="event_type" sort={sort} toggle={toggle} className="text-xs" />
                    <TSHead label="Status" sortKey="status_code" sort={sort} toggle={toggle} className="text-xs" />
                    <TSHead label="Resultado" sortKey="processing_result" sort={sort} toggle={toggle} className="text-xs" />
                    <th className="w-16 px-4 py-2 text-sm font-medium">Payload</th>
                  </tr>
                </TableHeader>
                <TableBody>
                  {applySortToData(filteredLogs, sort).map(log => {
                    const source = getSource(log.chip_id);
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs font-mono whitespace-nowrap">{formatDate(log.created_at)}</TableCell>
                        <TableCell className="text-xs">{log.instance_name || '—'}</TableCell>
                        <TableCell>
                          {source === 'warming' ? (
                            <Badge className="text-xs bg-orange-500/20 text-orange-400 gap-1">
                              <Flame className="w-3 h-3" />Aquecimento
                            </Badge>
                          ) : source === 'chat' ? (
                            <Badge className="text-xs bg-blue-500/20 text-blue-400 gap-1">
                              <MessageSquare className="w-3 h-3" />Chat
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">—</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('text-xs', eventColors[log.event_type] || 'bg-muted text-muted-foreground')}>
                            {log.event_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.status_code === 200 ? 'outline' : 'destructive'} className="text-xs">
                            {log.status_code}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{log.processing_result || '—'}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedLog(log)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                        <Webhook className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="font-medium">Nenhum log de webhook encontrado</p>
                        <div className="text-xs mt-3 space-y-1 max-w-md mx-auto">
                          <p>
                            <strong>Chips conectados:</strong>{' '}
                            <span className={connectedChips === 0 ? 'text-destructive font-semibold' : 'text-emerald-600 font-semibold'}>
                              {connectedChips} de {totalChips}
                            </span>
                          </p>
                          <p className="opacity-80">
                            Os logs são apagados automaticamente após <strong>3 dias</strong> (rotina <code>cleanup_webhook_logs</code> roda às 04h).
                          </p>
                          {connectedChips === 0 ? (
                            <p className="opacity-80 text-amber-600">
                              ⚠️ Nenhum chip está conectado. Conecte ao menos 1 chip em <code>/chips</code> para começar a receber webhooks.
                            </p>
                          ) : (
                            <p className="opacity-80">
                              Há chips conectados, mas nenhuma mensagem chegou nos últimos 3 dias. Verifique se os webhooks da UazAPI estão apontando para esta plataforma em <code>/admin/integrations</code>.
                            </p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Payload do Webhook — {selectedLog?.event_type}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto whitespace-pre-wrap">
              {JSON.stringify(selectedLog?.payload, null, 2)}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}