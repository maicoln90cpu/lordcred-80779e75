import { useState, useEffect, lazy, Suspense } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Play, Pause, Trash2, Eye, Send, CheckCircle2, XCircle, Radio, Image, FileText, CalendarIcon, Ban, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const BroadcastCreateDialog = lazy(() => import('@/components/broadcasts/BroadcastCreateDialog'));
const BlacklistManager = lazy(() => import('@/components/broadcasts/BlacklistManager'));
const BroadcastReports = lazy(() => import('@/components/broadcasts/BroadcastReports'));

interface Campaign {
  id: string;
  name: string;
  message_content: string;
  chip_id: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  rate_per_minute: number;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  media_type: string | null;
  source_type: string | null;
  scheduled_date: string | null;
  owner_user_id: string | null;
}

interface ChipInfo {
  id: string;
  instance_name: string;
  nickname: string | null;
  provider: string;
  user_id: string;
}

interface ProfileInfo {
  user_id: string;
  name: string | null;
  email: string;
}

const statusMap: Record<string, { label: string; className: string }> = {
  draft: { label: 'Rascunho', className: 'bg-muted text-muted-foreground' },
  scheduled: { label: 'Agendado', className: 'bg-blue-500/20 text-blue-400' },
  running: { label: 'Enviando', className: 'bg-green-500/20 text-green-400' },
  paused: { label: 'Pausado', className: 'bg-orange-500/20 text-orange-400' },
  completed: { label: 'Concluído', className: 'bg-primary/20 text-primary' },
  cancelled: { label: 'Cancelado', className: 'bg-destructive/20 text-destructive' },
};

export default function Broadcasts() {
  const { toast } = useToast();
  const { canSee, loading: accessLoading } = (require('@/hooks/useFeatureAccess') as typeof import('@/hooks/useFeatureAccess')).useFeatureAccess('broadcasts');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [chips, setChips] = useState<ChipInfo[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileInfo>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<Campaign | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ action: string; id: string } | null>(null);
  const [showBlacklist, setShowBlacklist] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    const [campRes, chipRes, profileRes] = await Promise.all([
      supabase.from('broadcast_campaigns').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('chips').select('id, instance_name, nickname, provider, user_id'),
      supabase.rpc('get_visible_profiles'),
    ]);
    if (campRes.data) setCampaigns(campRes.data as any);
    if (chipRes.data) setChips(chipRes.data as any);
    if (profileRes.data) {
      const pMap: Record<string, ProfileInfo> = {};
      profileRes.data.forEach(p => { pMap[p.user_id] = p; });
      setProfiles(pMap);
    }
    setLoading(false);
  };

  const handleAction = async (action: string, id: string) => {
    try {
      if (action === 'start') {
        await supabase.from('broadcast_campaigns').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', id);
        supabase.functions.invoke('broadcast-sender', { body: { campaign_id: id } });
      } else if (action === 'pause') {
        await supabase.from('broadcast_campaigns').update({ status: 'paused' }).eq('id', id);
      } else if (action === 'resume') {
        await supabase.from('broadcast_campaigns').update({ status: 'running' }).eq('id', id);
        supabase.functions.invoke('broadcast-sender', { body: { campaign_id: id } });
      } else if (action === 'cancel') {
        await supabase.from('broadcast_campaigns').update({ status: 'cancelled' }).eq('id', id);
      } else if (action === 'delete') {
        await supabase.from('broadcast_campaigns').delete().eq('id', id);
      }
      toast({ title: 'Ação realizada com sucesso' });
      setConfirmAction(null);
      loadData();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const getChipName = (chipId: string) => {
    const chip = chips.find(c => c.id === chipId);
    return chip?.nickname || chip?.instance_name || chipId.slice(0, 8);
  };

  const getChipProvider = (chipId: string) => {
    const chip = chips.find(c => c.id === chipId);
    return chip?.provider || 'uazapi';
  };

  const getOwnerName = (c: Campaign) => {
    const userId = c.owner_user_id;
    if (!userId) return '—';
    const p = profiles[userId];
    return p?.name || p?.email || '—';
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

  const sourceLabel = (t: string | null) => {
    if (t === 'leads') return 'Leads';
    if (t === 'csv') return 'CSV';
    return 'Manual';
  };

  const stats = {
    total: campaigns.length,
    running: campaigns.filter(c => c.status === 'running').length,
    completed: campaigns.filter(c => c.status === 'completed').length,
    totalSent: campaigns.reduce((s, c) => s + c.sent_count, 0),
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Disparos em Massa</h1>
            <p className="text-muted-foreground text-sm">Campanhas de envio com controle de taxa anti-bloqueio</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowBlacklist(true)} className="gap-2">
              <Ban className="w-4 h-4" /> Blacklist
            </Button>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Nova Campanha
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Campanhas', value: stats.total, icon: Radio, color: 'text-primary' },
            { label: 'Em Andamento', value: stats.running, icon: Play, color: 'text-green-400' },
            { label: 'Concluídas', value: stats.completed, icon: CheckCircle2, color: 'text-blue-400' },
            { label: 'Total Enviados', value: stats.totalSent, icon: Send, color: 'text-yellow-400' },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <s.icon className={cn('w-5 h-5', s.color)} />
                <div>
                  <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="campanhas" className="space-y-3">
          <TabsList>
            <TabsTrigger value="campanhas" className="gap-1.5"><Radio className="w-3.5 h-3.5" /> Campanhas</TabsTrigger>
            <TabsTrigger value="relatorio" className="gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Relatório</TabsTrigger>
          </TabsList>

          <TabsContent value="campanhas">
            {/* Table */}
            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-400px)]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Chip</TableHead>
                        <TableHead>Proprietário</TableHead>
                        <TableHead className="text-center">Dest.</TableHead>
                        <TableHead className="text-center">Enviados</TableHead>
                        <TableHead className="text-center">Erros</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Taxa</TableHead>
                        <TableHead>Criado</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns.map(c => {
                        const st = statusMap[c.status] || statusMap.draft;
                        return (
                          <TableRow key={c.id}>
                            <TableCell><Badge className={cn('text-xs', st.className)}>{st.label}</Badge></TableCell>
                            <TableCell className="font-medium text-sm">
                              <div className="flex items-center gap-1.5">
                                {c.name}
                                {c.media_type === 'image' && <Image className="w-3 h-3 text-muted-foreground" />}
                                {c.media_type === 'document' && <FileText className="w-3 h-3 text-muted-foreground" />}
                                {c.scheduled_date && <CalendarIcon className="w-3 h-3 text-blue-400" />}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="flex items-center gap-1">
                                {getChipName(c.chip_id)}
                                <Badge variant="outline" className="text-[10px] px-1 py-0">{getChipProvider(c.chip_id) === 'meta' ? 'META' : 'UazAPI'}</Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">{getOwnerName(c)}</TableCell>
                            <TableCell className="text-center text-sm">{c.total_recipients}</TableCell>
                            <TableCell className="text-center text-sm text-green-400">{c.sent_count}</TableCell>
                            <TableCell className="text-center text-sm text-destructive">{c.failed_count}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{sourceLabel(c.source_type)}</Badge></TableCell>
                            <TableCell className="text-xs">{c.rate_per_minute}/min</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">{formatDate(c.created_at)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {c.status === 'draft' && (
                                  <Button size="icon" variant="ghost" onClick={() => handleAction('start', c.id)} title="Iniciar">
                                    <Play className="w-4 h-4 text-green-400" />
                                  </Button>
                                )}
                                {c.status === 'running' && (
                                  <Button size="icon" variant="ghost" onClick={() => handleAction('pause', c.id)} title="Pausar">
                                    <Pause className="w-4 h-4 text-orange-400" />
                                  </Button>
                                )}
                                {c.status === 'paused' && (
                                  <Button size="icon" variant="ghost" onClick={() => handleAction('resume', c.id)} title="Retomar">
                                    <Play className="w-4 h-4 text-green-400" />
                                  </Button>
                                )}
                                {['draft', 'running', 'paused'].includes(c.status) && (
                                  <Button size="icon" variant="ghost" onClick={() => setConfirmAction({ action: 'cancel', id: c.id })} title="Cancelar">
                                    <XCircle className="w-4 h-4 text-destructive" />
                                  </Button>
                                )}
                                {['completed', 'cancelled'].includes(c.status) && (
                                  <Button size="icon" variant="ghost" onClick={() => setConfirmAction({ action: 'delete', id: c.id })} title="Excluir">
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                )}
                                <Button size="icon" variant="ghost" onClick={() => setShowDetail(c)} title="Detalhes">
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {campaigns.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center text-muted-foreground py-12">
                            <Radio className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            <p>Nenhuma campanha criada</p>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="relatorio">
            <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
              <BroadcastReports />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Dialog */}
      <Suspense fallback={null}>
        <BroadcastCreateDialog open={showCreate} onOpenChange={setShowCreate} onCreated={loadData} />
      </Suspense>

      {/* Blacklist Dialog */}
      <Suspense fallback={null}>
        <BlacklistManager open={showBlacklist} onOpenChange={setShowBlacklist} />
      </Suspense>

      {/* Detail Dialog */}
      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{showDetail?.name}</DialogTitle>
          </DialogHeader>
          {showDetail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Status:</span> <Badge className={cn('text-xs', statusMap[showDetail.status]?.className)}>{statusMap[showDetail.status]?.label}</Badge></div>
                <div><span className="text-muted-foreground">Chip:</span> {getChipName(showDetail.chip_id)}</div>
                <div><span className="text-muted-foreground">Taxa:</span> {showDetail.rate_per_minute}/min</div>
                <div><span className="text-muted-foreground">Total:</span> {showDetail.total_recipients}</div>
                <div><span className="text-muted-foreground">Enviados:</span> <span className="text-green-400">{showDetail.sent_count}</span></div>
                <div><span className="text-muted-foreground">Erros:</span> <span className="text-destructive">{showDetail.failed_count}</span></div>
                <div><span className="text-muted-foreground">Início:</span> {formatDate(showDetail.started_at)}</div>
                <div><span className="text-muted-foreground">Fim:</span> {formatDate(showDetail.completed_at)}</div>
                <div><span className="text-muted-foreground">Origem:</span> <Badge variant="outline" className="text-xs">{sourceLabel(showDetail.source_type)}</Badge></div>
                {showDetail.media_type && (
                  <div><span className="text-muted-foreground">Mídia:</span> {showDetail.media_type === 'image' ? 'Imagem' : 'Documento'}</div>
                )}
                {showDetail.scheduled_date && (
                  <div><span className="text-muted-foreground">Agendado:</span> {formatDate(showDetail.scheduled_date)}</div>
                )}
              </div>
              {showDetail.total_recipients > 0 && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Progresso</span>
                    <span>{Math.round(((showDetail.sent_count + showDetail.failed_count) / showDetail.total_recipients) * 100)}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${Math.round(((showDetail.sent_count + showDetail.failed_count) / showDetail.total_recipients) * 100)}%` }} />
                  </div>
                </div>
              )}
              <div>
                <p className="text-muted-foreground mb-1">Mensagem:</p>
                <div className="bg-muted/50 rounded p-3 text-xs whitespace-pre-wrap">{showDetail.message_content}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action === 'cancel' ? 'Cancelar esta campanha?' : 'Excluir esta campanha e todos os destinatários?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmAction && handleAction(confirmAction.action, confirmAction.id)}>Sim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
