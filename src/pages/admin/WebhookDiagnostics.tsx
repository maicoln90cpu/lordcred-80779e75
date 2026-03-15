import { useState, useEffect } from 'react';
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
import { Loader2, Search, Eye, Webhook, RefreshCw, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [chips, setChips] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEvent, setFilterEvent] = useState('all');
  const [filterChip, setFilterChip] = useState('all');
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [logsRes, chipsRes] = await Promise.all([
      supabase.from('webhook_logs').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('chips').select('id, instance_name, nickname'),
    ]);
    if (logsRes.data) setLogs(logsRes.data);
    if (chipsRes.data) {
      const map: Record<string, string> = {};
      chipsRes.data.forEach(c => { map[c.id] = c.nickname || c.instance_name; });
      setChips(map);
    }
    setLoading(false);
  };

  const filteredLogs = logs.filter(log => {
    if (filterEvent !== 'all' && log.event_type !== filterEvent) return false;
    if (filterChip !== 'all' && log.chip_id !== filterChip) return false;
    if (searchTerm && !log.instance_name?.toLowerCase().includes(searchTerm.toLowerCase()) && !log.processing_result?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const uniqueEvents = [...new Set(logs.map(l => l.event_type))];
  const uniqueChipIds = [...new Set(logs.filter(l => l.chip_id).map(l => l.chip_id!))];

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </DashboardLayout>
    );
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

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar instância ou resultado..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterEvent} onValueChange={setFilterEvent}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os eventos</SelectItem>
              {uniqueEvents.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterChip} onValueChange={setFilterChip}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os chips</SelectItem>
              {uniqueChipIds.map(id => (
                <SelectItem key={id} value={id}>{chips[id] || id.slice(0, 8)}</SelectItem>
              ))}
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
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Instância</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead className="w-16">Payload</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs font-mono whitespace-nowrap">{formatDate(log.created_at)}</TableCell>
                      <TableCell className="text-xs">{log.instance_name || '—'}</TableCell>
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
                  ))}
                  {filteredLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum log de webhook</TableCell>
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
