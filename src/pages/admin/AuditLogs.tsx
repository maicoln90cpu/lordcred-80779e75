import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Search, Eye, Shield, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  details: any;
  created_at: string;
}

const actionLabels: Record<string, { label: string; className: string }> = {
  profile_created: { label: 'Perfil Criado', className: 'bg-green-500/20 text-green-400' },
  profile_updated: { label: 'Perfil Atualizado', className: 'bg-blue-500/20 text-blue-400' },
  profile_deleted: { label: 'Perfil Excluído', className: 'bg-destructive/20 text-destructive' },
  role_created: { label: 'Role Criada', className: 'bg-green-500/20 text-green-400' },
  role_updated: { label: 'Role Alterada', className: 'bg-orange-500/20 text-orange-400' },
  role_deleted: { label: 'Role Excluída', className: 'bg-destructive/20 text-destructive' },
  chip_created: { label: 'Chip Criado', className: 'bg-green-500/20 text-green-400' },
  chip_deleted: { label: 'Chip Excluído', className: 'bg-destructive/20 text-destructive' },
  settings_updated: { label: 'Config Alterada', className: 'bg-yellow-500/20 text-yellow-400' },
  ticket_created: { label: 'Ticket Criado', className: 'bg-green-500/20 text-green-400' },
  ticket_updated: { label: 'Ticket Atualizado', className: 'bg-blue-500/20 text-blue-400' },
};

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (!error && data) setLogs(data);
    setLoading(false);
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = !searchTerm || 
      (log.user_email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.target_table?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesAction = filterAction === 'all' || log.action === filterAction;
    return matchesSearch && matchesAction;
  });

  const uniqueActions = [...new Set(logs.map(l => l.action))];

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Logs de Auditoria</h1>
            <p className="text-muted-foreground text-sm">Histórico de ações do sistema registradas automaticamente</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por email, ação, tabela..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              {uniqueActions.map(a => (
                <SelectItem key={a} value={a}>
                  {actionLabels[a]?.label || a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="gap-1">
            <Clock className="w-3 h-3" />
            {filteredLogs.length} registros
          </Badge>
        </div>

        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-280px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Tabela</TableHead>
                    <TableHead>ID Alvo</TableHead>
                    <TableHead className="w-20">Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map(log => {
                    const actionInfo = actionLabels[log.action] || { label: log.action, className: 'bg-muted text-muted-foreground' };
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs font-mono whitespace-nowrap">{formatDate(log.created_at)}</TableCell>
                        <TableCell className="text-sm">{log.user_email || '—'}</TableCell>
                        <TableCell>
                          <Badge className={cn('text-xs', actionInfo.className)}>{actionInfo.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{log.target_table || '—'}</TableCell>
                        <TableCell className="text-xs font-mono max-w-[120px] truncate">{log.target_id || '—'}</TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedLog(log)}>
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[80vh]">
                              <DialogHeader>
                                <DialogTitle>Detalhes do Log</DialogTitle>
                              </DialogHeader>
                              <ScrollArea className="max-h-[60vh]">
                                <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto whitespace-pre-wrap">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </ScrollArea>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhum log encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
