import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Search, Eye, Shield, Clock, Send, Terminal, CheckCircle2, XCircle, Info, Cpu, User } from 'lucide-react';
import { useSortState, applySortToData } from '@/components/commission-reports/CRSortUtils';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { JsonTreeView } from '@/components/admin/JsonTreeView';

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

type AuditCategory =
  | 'whatsapp'
  | 'broadcasts'
  | 'leads'
  | 'commissions'
  | 'corban'
  | 'contracts'
  | 'simulator'
  | 'hr'
  | 'users'
  | 'settings'
  | 'system';

const categoryLabels: Record<AuditCategory | 'all', string> = {
  all: 'Todas as categorias',
  whatsapp: 'WhatsApp / Chips',
  broadcasts: 'Disparos (Broadcasts)',
  leads: 'Leads',
  commissions: 'Comissões',
  corban: 'Corban',
  contracts: 'Contratos (ClickSign)',
  simulator: 'Simulador V8',
  hr: 'RH',
  users: 'Usuários',
  settings: 'Configurações',
  system: 'Sistema',
};

const actionLabels: Record<string, { label: string; className: string; category: AuditCategory }> = {
  // Users / profiles
  profile_created: { label: 'Perfil Criado', className: 'bg-green-500/20 text-green-400', category: 'users' },
  profile_updated: { label: 'Perfil Atualizado', className: 'bg-blue-500/20 text-blue-400', category: 'users' },
  profile_deleted: { label: 'Perfil Excluído', className: 'bg-destructive/20 text-destructive', category: 'users' },
  role_created: { label: 'Role Criada', className: 'bg-green-500/20 text-green-400', category: 'users' },
  role_updated: { label: 'Role Alterada', className: 'bg-orange-500/20 text-orange-400', category: 'users' },
  role_deleted: { label: 'Role Excluída', className: 'bg-destructive/20 text-destructive', category: 'users' },
  user_created: { label: 'Usuário Criado', className: 'bg-green-500/20 text-green-400', category: 'users' },
  user_deleted: { label: 'Usuário Excluído', className: 'bg-destructive/20 text-destructive', category: 'users' },
  user_role_updated: { label: 'Role Atualizada', className: 'bg-orange-500/20 text-orange-400', category: 'users' },
  user_password_reset: { label: 'Senha Redefinida', className: 'bg-yellow-500/20 text-yellow-400', category: 'users' },
  user_email_updated: { label: 'E-mail Atualizado', className: 'bg-blue-500/20 text-blue-400', category: 'users' },
  // WhatsApp / chips
  chip_created: { label: 'Chip Criado', className: 'bg-green-500/20 text-green-400', category: 'whatsapp' },
  chip_deleted: { label: 'Chip Excluído', className: 'bg-destructive/20 text-destructive', category: 'whatsapp' },
  // Settings
  settings_updated: { label: 'Config Alterada', className: 'bg-yellow-500/20 text-yellow-400', category: 'settings' },
  // Tickets (system / ops)
  ticket_created: { label: 'Ticket Criado', className: 'bg-green-500/20 text-green-400', category: 'system' },
  ticket_updated: { label: 'Ticket Atualizado', className: 'bg-blue-500/20 text-blue-400', category: 'system' },
  // Contracts (ClickSign)
  clicksign_contract_generated: { label: 'Contrato Gerado', className: 'bg-green-500/20 text-green-400', category: 'contracts' },
  clicksign_resend_notification: { label: 'Contrato Reenviado', className: 'bg-orange-500/20 text-orange-400', category: 'contracts' },
  clicksign_webhook_signed: { label: 'Contrato Assinado', className: 'bg-green-500/20 text-green-400', category: 'contracts' },
  clicksign_preview: { label: 'Contrato — Pré-visualização', className: 'bg-muted text-muted-foreground', category: 'contracts' },
  clicksign_get_status: { label: 'Contrato — Status', className: 'bg-muted text-muted-foreground', category: 'contracts' },
  clicksign_get_signed_url: { label: 'Contrato — Link Assinado', className: 'bg-blue-500/20 text-blue-400', category: 'contracts' },
  clicksign_download_pdf: { label: 'Contrato — Download PDF', className: 'bg-blue-500/20 text-blue-400', category: 'contracts' },
  // Partners (commissions area)
  partner_created: { label: 'Parceiro Criado', className: 'bg-green-500/20 text-green-400', category: 'commissions' },
  partner_updated: { label: 'Parceiro Atualizado', className: 'bg-blue-500/20 text-blue-400', category: 'commissions' },
  partner_deleted: { label: 'Parceiro Excluído', className: 'bg-destructive/20 text-destructive', category: 'commissions' },
  // Simulator V8
  v8_get_configs: { label: 'V8 — Atualizar Tabelas', className: 'bg-blue-500/20 text-blue-400', category: 'simulator' },
  v8_simulate_one: { label: 'V8 — Simulação', className: 'bg-green-500/20 text-green-400', category: 'simulator' },
  v8_create_batch: { label: 'V8 — Lote Criado', className: 'bg-green-500/20 text-green-400', category: 'simulator' },
  // HR
  hr_notifications_run: { label: 'RH — Disparo Notificações', className: 'bg-blue-500/20 text-blue-400', category: 'hr' },
  // Broadcasts
  broadcast_run: { label: 'Disparo Executado', className: 'bg-blue-500/20 text-blue-400', category: 'broadcasts' },
  // Corban (NewCorban API proxy)
  corban_getPropostas: { label: 'Corban — Buscar Propostas', className: 'bg-muted text-muted-foreground', category: 'corban' },
  corban_getAssets: { label: 'Corban — Listar Assets', className: 'bg-muted text-muted-foreground', category: 'corban' },
  corban_listLogins: { label: 'Corban — Listar Logins', className: 'bg-muted text-muted-foreground', category: 'corban' },
  corban_listQueueFGTS: { label: 'Corban — Fila FGTS', className: 'bg-muted text-muted-foreground', category: 'corban' },
  corban_insertQueueFGTS: { label: 'Corban — Inserir Fila FGTS', className: 'bg-blue-500/20 text-blue-400', category: 'corban' },
  corban_createProposta: { label: 'Corban — Criar Proposta', className: 'bg-green-500/20 text-green-400', category: 'corban' },
  corban_testConnection: { label: 'Corban — Teste de Conexão', className: 'bg-muted text-muted-foreground', category: 'corban' },
  corban_rawProxy: { label: 'Corban — Proxy Bruto', className: 'bg-orange-500/20 text-orange-400', category: 'corban' },
  // WhatsApp Gateway (administrative actions)
  whatsapp_create_instance: { label: 'WhatsApp — Criar Instância', className: 'bg-green-500/20 text-green-400', category: 'whatsapp' },
  whatsapp_delete_instance: { label: 'WhatsApp — Excluir Instância', className: 'bg-destructive/20 text-destructive', category: 'whatsapp' },
  whatsapp_disconnect_instance: { label: 'WhatsApp — Desconectar', className: 'bg-orange-500/20 text-orange-400', category: 'whatsapp' },
  whatsapp_get_qrcode: { label: 'WhatsApp — Gerar QR Code', className: 'bg-blue-500/20 text-blue-400', category: 'whatsapp' },
  whatsapp_sync_templates: { label: 'WhatsApp — Sincronizar Templates', className: 'bg-blue-500/20 text-blue-400', category: 'whatsapp' },
  whatsapp_set_profile_name: { label: 'WhatsApp — Alterar Nome', className: 'bg-blue-500/20 text-blue-400', category: 'whatsapp' },
  whatsapp_set_profile_picture: { label: 'WhatsApp — Alterar Foto', className: 'bg-blue-500/20 text-blue-400', category: 'whatsapp' },
  whatsapp_set_privacy: { label: 'WhatsApp — Privacidade', className: 'bg-blue-500/20 text-blue-400', category: 'whatsapp' },
  whatsapp_update_business_profile: { label: 'WhatsApp — Perfil Comercial', className: 'bg-blue-500/20 text-blue-400', category: 'whatsapp' },
  whatsapp_block_contact: { label: 'WhatsApp — Bloquear Contato', className: 'bg-orange-500/20 text-orange-400', category: 'whatsapp' },
  whatsapp_delete_chat: { label: 'WhatsApp — Excluir Conversa', className: 'bg-destructive/20 text-destructive', category: 'whatsapp' },
};

function getCategory(log: AuditLog): AuditCategory {
  // Prefer explicit category from edge function helper
  const fromDetails = log.details?.category as AuditCategory | undefined;
  if (fromDetails && fromDetails in categoryLabels) return fromDetails;
  // Fallback to action mapping
  return actionLabels[log.action]?.category ?? 'system';
}

type LogStatus = 'success' | 'error' | 'info';

function getLogStatus(log: AuditLog): LogStatus {
  if (log.details?.success === true) return 'success';
  if (log.details?.success === false || log.details?.error || log.details?.error_message) return 'error';
  if (log.action.includes('_created') || log.action.includes('_updated') || log.action.includes('contract_generated') || log.action.includes('contrato')) return 'success';
  if (log.action.includes('_deleted')) return 'info';
  return 'info';
}

const statusConfig: Record<LogStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  success: { label: 'Sucesso', icon: CheckCircle2, className: 'bg-green-500/20 text-green-400' },
  error: { label: 'Erro', icon: XCircle, className: 'bg-destructive/20 text-destructive' },
  info: { label: 'Info', icon: Info, className: 'bg-muted text-muted-foreground' },
};

type LogOrigin = 'system' | 'user';

function getOrigin(log: AuditLog): LogOrigin {
  // Sem user_id = ação automática (cron, webhook, edge function sem usuário)
  return log.user_id ? 'user' : 'system';
}

const originConfig: Record<LogOrigin, { label: string; icon: typeof Cpu; className: string }> = {
  system: { label: 'Sistema', icon: Cpu, className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  user: { label: 'Usuário', icon: User, className: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
};

function extractFallbackRequest(details: any): Record<string, any> | null {
  if (!details || details.request_payload) return null;
  const keys = ['partner_id', 'partner_name', 'partner_email', 'envelope_id', 'action', 'file_name', 'signer_email'];
  const result: Record<string, any> = {};
  for (const k of keys) {
    if (details[k] !== undefined) result[k] = details[k];
  }
  if (details.old) result.dados_anteriores = details.old;
  return Object.keys(result).length > 0 ? result : null;
}

function extractFallbackResponse(details: any): Record<string, any> | null {
  if (!details || details.response_payload) return null;
  const keys = ['document_id', 'signer_id', 'status', 'notified', 'signers_total', 'envelope_id'];
  const result: Record<string, any> = {};
  for (const k of keys) {
    if (details[k] !== undefined) result[k] = details[k];
  }
  if (details.new) result.dados_novos = details.new;
  return Object.keys(result).length > 0 ? result : null;
}

const PAYLOAD_PLACEHOLDER = `{
  "auth": {
    "username": "SEU_USUARIO",
    "password": "SUA_SENHA",
    "empresa": "SUA_EMPRESA"
  },
  "requestType": "getPropostas",
  "filters": {
    "searchString": "CPF_AQUI",
    "data": {
      "startDate": "2026-03-01",
      "endDate": "2026-03-26",
      "tipo": "cadastro"
    }
  }
}`;

const PAGE_SIZE = 500;

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterCategory, setFilterCategory] = useState<'all' | AuditCategory>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | LogStatus>('all');
  const [filterOrigin, setFilterOrigin] = useState<'all' | LogOrigin>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const { sort, toggle: toggleSort } = useSortState();

  // API Tester state
  const [apiUrl, setApiUrl] = useState('https://api.newcorban.com.br/api/propostas/');
  const [apiPayload, setApiPayload] = useState('');
  const [apiResponse, setApiResponse] = useState('');
  const [apiSending, setApiSending] = useState(false);

  useEffect(() => {
    loadLogs(true);
  }, []);

  const loadLogs = async (reset = false) => {
    if (reset) {
      setLoading(true);
      setLogs([]);
    } else {
      setLoadingMore(true);
    }
    const from = reset ? 0 : logs.length;
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (!error && data) {
      setLogs(prev => reset ? data : [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
    setLoadingMore(false);
  };

  const filteredBase = logs.filter(log => {
    const matchesSearch = !searchTerm || 
      (log.user_email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.target_table?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesAction = filterAction === 'all' || log.action === filterAction;
    const matchesStatus = filterStatus === 'all' || getLogStatus(log) === filterStatus;
    const matchesCategory = filterCategory === 'all' || getCategory(log) === filterCategory;
    const matchesOrigin = filterOrigin === 'all' || getOrigin(log) === filterOrigin;
    return matchesSearch && matchesAction && matchesStatus && matchesCategory && matchesOrigin;
  });
  const filteredLogs = useMemo(() => applySortToData(filteredBase, sort), [filteredBase, sort]);

  const uniqueActions = [...new Set(logs.map(l => l.action))];

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const handleSendRequest = async () => {
    if (!apiUrl.trim()) {
      toast.error('URL é obrigatória');
      return;
    }

    let parsedBody: any;
    try {
      parsedBody = apiPayload.trim() ? JSON.parse(apiPayload) : {};
    } catch {
      toast.error('Payload JSON inválido');
      return;
    }

    setApiSending(true);
    setApiResponse('Enviando...');

    try {
      const { data, error } = await supabase.functions.invoke('corban-api', {
        body: {
          action: 'rawProxy',
          params: {
            url: apiUrl.trim(),
            body: parsedBody,
          },
        },
      });

      if (error) {
        setApiResponse(`ERRO: ${error.message}`);
      } else {
        const statusCode = data?.status_code || '?';
        let responseBody = data?.data || '';
        // Try to pretty-print if it's JSON
        try {
          const parsed = JSON.parse(responseBody);
          responseBody = JSON.stringify(parsed, null, 2);
        } catch {
          // keep as-is
        }
        setApiResponse(`HTTP ${statusCode}\n\n${responseBody}`);
      }
    } catch (err: any) {
      setApiResponse(`ERRO: ${err.message}`);
    } finally {
      setApiSending(false);
    }
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

        <Tabs defaultValue="logs">
          <TabsList>
            <TabsTrigger value="logs" className="gap-1.5">
              <Clock className="w-4 h-4" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="api-tester" className="gap-1.5">
              <Terminal className="w-4 h-4" />
              API Tester
            </TabsTrigger>
          </TabsList>

          {/* --- LOGS TAB --- */}
          <TabsContent value="logs" className="space-y-4">
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
              <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v as 'all' | AuditCategory)}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Filtrar categoria" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(categoryLabels) as Array<keyof typeof categoryLabels>).map(k => (
                    <SelectItem key={k} value={k}>{categoryLabels[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrar ação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ações</SelectItem>
                  {[...uniqueActions].sort((a, b) => (actionLabels[a]?.label || a).localeCompare(actionLabels[b]?.label || b, 'pt-BR')).map(a => (
                    <SelectItem key={a} value={a}>
                      {actionLabels[a]?.label || a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as 'all' | LogStatus)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filtrar status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="success">
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-400" /> Sucesso</span>
                  </SelectItem>
                  <SelectItem value="error">
                    <span className="flex items-center gap-1.5"><XCircle className="w-3 h-3 text-destructive" /> Erro</span>
                  </SelectItem>
                  <SelectItem value="info">
                    <span className="flex items-center gap-1.5"><Info className="w-3 h-3 text-muted-foreground" /> Info</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterOrigin} onValueChange={(v) => setFilterOrigin(v as 'all' | LogOrigin)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filtrar origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toda origem</SelectItem>
                  <SelectItem value="system">
                    <span className="flex items-center gap-1.5"><Cpu className="w-3 h-3 text-blue-400" /> Sistema</span>
                  </SelectItem>
                  <SelectItem value="user">
                    <span className="flex items-center gap-1.5"><User className="w-3 h-3 text-purple-400" /> Usuário</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="outline" className="gap-1">
                <Clock className="w-3 h-3" />
                {filteredLogs.length} de {logs.length} registros
                {hasMore && ' (mais disponíveis)'}
              </Badge>
            </div>

            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-340px)]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {[
                          { key: 'created_at', label: 'Data/Hora' },
                          { key: 'user_email', label: 'Usuário' },
                          { key: 'action', label: 'Ação' },
                          { key: '_status', label: 'Status' },
                          { key: '_origin', label: 'Origem' },
                          { key: 'target_table', label: 'Tabela' },
                          { key: 'target_id', label: 'ID Alvo' },
                        ].map(col => {
                          const Icon = sort.key === col.key ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
                          return (
                            <TableHead
                              key={col.key}
                              className="cursor-pointer select-none hover:bg-muted/50"
                              onClick={() => toggleSort(col.key)}
                            >
                              <span className="inline-flex items-center gap-1">
                                {col.label}
                                <Icon className={`w-3 h-3 ${sort.key === col.key ? 'text-foreground' : 'text-muted-foreground/50'}`} />
                              </span>
                            </TableHead>
                          );
                        })}
                        <TableHead className="w-20">Detalhes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map(log => {
                        const actionInfo = actionLabels[log.action] || { label: log.action, className: 'bg-muted text-muted-foreground' };
                        const logStatus = getLogStatus(log);
                        const statusInfo = statusConfig[logStatus];
                        const StatusIcon = statusInfo.icon;
                        const origin = getOrigin(log);
                        const originInfo = originConfig[origin];
                        const OriginIcon = originInfo.icon;
                        return (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs font-mono whitespace-nowrap">{formatDate(log.created_at)}</TableCell>
                            <TableCell className="text-sm">{log.user_email || <span className="text-muted-foreground italic">automático</span>}</TableCell>
                            <TableCell>
                              <Badge className={cn('text-xs', actionInfo.className)}>{actionInfo.label}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={cn('text-xs gap-1', statusInfo.className)}>
                                <StatusIcon className="w-3 h-3" />
                                {statusInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn('text-xs gap-1', originInfo.className)}>
                                <OriginIcon className="w-3 h-3" />
                                {originInfo.label}
                              </Badge>
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
                                <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
                                  <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                      Detalhes do Log
                                      <Badge className={cn('text-xs', actionInfo.className)}>{actionInfo.label}</Badge>
                                    </DialogTitle>
                                  </DialogHeader>
                                  <Tabs defaultValue="resumo" className="w-full">
                                    <TabsList className="w-full">
                                      <TabsTrigger value="resumo" className="flex-1">Resumo</TabsTrigger>
                                      <TabsTrigger value="request" className="flex-1">Request (Ida)</TabsTrigger>
                                      <TabsTrigger value="response" className="flex-1">Response (Volta)</TabsTrigger>
                                      <TabsTrigger value="raw" className="flex-1">JSON Completo</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="resumo">
                                      <ScrollArea className="h-[55vh]">
                                        <div className="space-y-3 p-1">
                                          <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div><span className="text-muted-foreground">Usuário:</span> <span className="font-medium">{log.user_email || '—'}</span></div>
                                            <div><span className="text-muted-foreground">Data/Hora:</span> <span className="font-mono text-xs">{formatDate(log.created_at)}</span></div>
                                            <div><span className="text-muted-foreground">Ação:</span> <span className="font-medium">{log.action}</span></div>
                                            <div><span className="text-muted-foreground">Tabela:</span> <span className="font-mono text-xs">{log.target_table || '—'}</span></div>
                                            <div><span className="text-muted-foreground">ID Alvo:</span> <span className="font-mono text-xs">{log.target_id || '—'}</span></div>
                                            <div>
                                              <span className="text-muted-foreground">Resultado:</span>{' '}
                                              {log.details?.success === true ? (
                                                <Badge className="bg-green-500/20 text-green-400 text-xs">Sucesso</Badge>
                                              ) : log.details?.success === false ? (
                                                <Badge className="bg-destructive/20 text-destructive text-xs">Erro</Badge>
                                              ) : (
                                                <span className="text-xs">—</span>
                                              )}
                                            </div>
                                          </div>
                                          {log.details?.error_message && (
                                            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
                                              <strong>Erro:</strong> {log.details.error_message}
                                            </div>
                                          )}
                                          {/* Show remaining details as tree excluding known keys */}
                                          {log.details && (() => {
                                            const { success, error_message, request_payload, response_payload, ...rest } = log.details;
                                            return Object.keys(rest).length > 0 ? (
                                              <div className="mt-3 bg-muted/50 rounded-lg p-3">
                                                <p className="text-xs text-muted-foreground mb-2 font-medium">Dados adicionais:</p>
                                                <JsonTreeView data={rest} maxDepth={4} />
                                              </div>
                                            ) : null;
                                          })()}
                                        </div>
                                      </ScrollArea>
                                    </TabsContent>
                                    <TabsContent value="request">
                                      <ScrollArea className="h-[55vh]">
                                        {(() => {
                                          const reqData = log.details?.request_payload || extractFallbackRequest(log.details);
                                          return reqData ? (
                                            <div className="bg-muted/50 rounded-lg p-3">
                                              {!log.details?.request_payload && (
                                                <p className="text-xs text-muted-foreground mb-2 italic">⚠ Dados extraídos automaticamente (log legado)</p>
                                              )}
                                              <JsonTreeView data={reqData} maxDepth={5} />
                                            </div>
                                          ) : (
                                            <div className="text-center text-muted-foreground py-8 text-sm">
                                              Payload de ida não disponível para este log.
                                              <br />
                                              <span className="text-xs">(Logs antigos não possuem esta informação separada)</span>
                                            </div>
                                          );
                                        })()}
                                      </ScrollArea>
                                    </TabsContent>
                                    <TabsContent value="response">
                                      <ScrollArea className="h-[55vh]">
                                        {(() => {
                                          const resData = log.details?.response_payload || extractFallbackResponse(log.details);
                                          if (resData) {
                                            const displayData = (() => {
                                              if (typeof resData.body === 'string') {
                                                try { return { ...resData, body: JSON.parse(resData.body) }; } catch { /* keep */ }
                                              }
                                              return resData;
                                            })();
                                            return (
                                              <div className="bg-muted/50 rounded-lg p-3">
                                                {!log.details?.response_payload && (
                                                  <p className="text-xs text-muted-foreground mb-2 italic">⚠ Dados extraídos automaticamente (log legado)</p>
                                                )}
                                                <JsonTreeView data={displayData} maxDepth={5} />
                                              </div>
                                            );
                                          }
                                          return (
                                            <div className="text-center text-muted-foreground py-8 text-sm">
                                              Payload de resposta não disponível para este log.
                                              <br />
                                              <span className="text-xs">(Logs antigos não possuem esta informação separada)</span>
                                            </div>
                                          );
                                        })()}
                                      </ScrollArea>
                                    </TabsContent>
                                    <TabsContent value="raw">
                                      <ScrollArea className="h-[55vh]">
                                        <div className="bg-muted/50 rounded-lg p-3">
                                          <JsonTreeView data={log.details} maxDepth={5} />
                                        </div>
                                      </ScrollArea>
                                    </TabsContent>
                                  </Tabs>
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
              {hasMore && (
                <div className="flex justify-center p-3 border-t">
                  <Button variant="outline" size="sm" onClick={() => loadLogs(false)} disabled={loadingMore}>
                    {loadingMore ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Carregar mais registros
                  </Button>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* --- API TESTER TAB --- */}
          <TabsContent value="api-tester" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Terminal className="w-5 h-5" />
                  Testador Manual da API Corban
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Envie payloads completos diretamente para a API e veja a resposta bruta.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* URL */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">URL</label>
                  <Input
                    value={apiUrl}
                    onChange={e => setApiUrl(e.target.value)}
                    placeholder="https://api.newcorban.com.br/api/propostas/"
                  />
                </div>

                {/* Payload */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Payload (JSON completo)</label>
                  <Textarea
                    value={apiPayload}
                    onChange={e => setApiPayload(e.target.value)}
                    placeholder={PAYLOAD_PLACEHOLDER}
                    className="font-mono text-xs min-h-[260px]"
                  />
                </div>

                {/* Send button */}
                <Button onClick={handleSendRequest} disabled={apiSending} className="gap-2">
                  {apiSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enviar Requisição
                </Button>

                {/* Response */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Resposta</label>
                  <Textarea
                    value={apiResponse}
                    readOnly
                    className="font-mono text-xs min-h-[300px] bg-muted"
                    placeholder="A resposta da API aparecerá aqui..."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
