import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Smartphone, 
  MessageSquare, 
  Wifi, 
  WifiOff, 
  Activity, 
  TrendingUp,
  Play,
  Pause,
  Zap,
  RefreshCw,
  Loader2,
  Flame,
  Sprout,
  TreeDeciduous
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { cn } from '@/lib/utils';
import { useRealtimeChips } from '@/hooks/useRealtimeChips';
import { MessagesChart } from '@/components/charts/MessagesChart';
import { ChipsStatusChart } from '@/components/charts/ChipsStatusChart';
import { useToast } from '@/hooks/use-toast';

interface ChipStats {
  total: number;
  connected: number;
  disconnected: number;
}

interface MessageStats {
  today: number;
  week: number;
  month: number;
}

interface Chip {
  id: string;
  slot_number: number;
  instance_name: string;
  phone_number: string | null;
  status: string;
  activated_at: string | null;
  messages_sent_today?: number;
  user_id?: string;
  warming_phase?: string;
}

interface Message {
  id: string;
  created_at: string;
  direction: string;
}

interface SystemSettings {
  id: string;
  is_warming_active: boolean;
  messages_day_novo: number;
  messages_day_1_3: number;
  messages_day_4_7: number;
  messages_day_aquecido: number;
  messages_day_8_plus: number;
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [chipStats, setChipStats] = useState<ChipStats>({ total: 0, connected: 0, disconnected: 0 });
  const [messageStats, setMessageStats] = useState<MessageStats>({ today: 0, week: 0, month: 0 });
  const [chips, setChips] = useState<Chip[]>([]);
  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isTogglingWarming, setIsTogglingWarming] = useState(false);
  const [isRunningManual, setIsRunningManual] = useState(false);
  const [queueCount, setQueueCount] = useState(0);

  const updateChipsFromRealtime = useCallback((updatedChips: Chip[]) => {
    const filteredChips = updatedChips.filter(c => c.user_id === user?.id);
    
    setChips(filteredChips);
    setChipStats({
      total: filteredChips.length,
      connected: filteredChips.filter(c => c.status === 'connected').length,
      disconnected: filteredChips.filter(c => c.status !== 'connected').length,
    });
  }, [user?.id]);

  // Subscribe to realtime chip updates
  useRealtimeChips(updateChipsFromRealtime, user?.id);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch chips
      const chipQuery = supabase
        .from('chips')
        .select('*')
        .eq('user_id', user.id)
        .order('slot_number');

      const { data: chipsData } = await chipQuery;

      if (chipsData) {
        setChips(chipsData);
        setChipStats({
          total: chipsData.length,
          connected: chipsData.filter(c => c.status === 'connected').length,
          disconnected: chipsData.filter(c => c.status !== 'connected').length,
        });
      }

      // Fetch system settings
      const { data: settingsData } = await supabase
        .from('system_settings')
        .select('id, is_warming_active, messages_day_novo, messages_day_1_3, messages_day_4_7, messages_day_aquecido, messages_day_8_plus')
        .maybeSingle();

      if (settingsData) {
        setSettings(settingsData);
      }

      // Fetch queue count
      const chipIds = chipsData?.map(c => c.id) || [];
      if (chipIds.length > 0) {
        const { count: queueCountRes } = await supabase
          .from('message_queue')
          .select('id', { count: 'exact', head: true })
          .in('chip_id', chipIds)
          .eq('status', 'pending');
        
        setQueueCount(queueCountRes || 0);
      }

      // Fetch message stats
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      if (chipIds.length > 0) {
        const [todayRes, weekRes, monthRes, recentRes] = await Promise.all([
          supabase.from('message_history').select('id', { count: 'exact' }).in('chip_id', chipIds).gte('created_at', todayStart),
          supabase.from('message_history').select('id', { count: 'exact' }).in('chip_id', chipIds).gte('created_at', weekStart),
          supabase.from('message_history').select('id', { count: 'exact' }).in('chip_id', chipIds).gte('created_at', monthStart),
          supabase.from('message_history').select('id, created_at, direction').in('chip_id', chipIds).gte('created_at', weekStart).order('created_at', { ascending: false }),
        ]);

        setMessageStats({
          today: todayRes.count || 0,
          week: weekRes.count || 0,
          month: monthRes.count || 0,
        });

        setRecentMessages(recentRes.data || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDaysActive = (activatedAt: string | null) => {
    if (!activatedAt) return 0;
    const diff = Date.now() - new Date(activatedAt).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const getMessageLimit = (phase: string) => {
    if (!settings) return 50;
    switch (phase) {
      case 'novo': return settings.messages_day_novo;
      case 'iniciante': return settings.messages_day_1_3;
      case 'crescimento': return settings.messages_day_4_7;
      case 'aquecido': return settings.messages_day_aquecido;
      case 'maduro': return settings.messages_day_8_plus;
      default: return settings.messages_day_novo;
    }
  };

  const getWarmupPhase = (phase: string) => {
    switch (phase) {
      case 'novo': return { phase: 0, name: 'Novo', icon: Sprout, color: 'text-gray-400', bgColor: 'bg-gray-400/10' };
      case 'iniciante': return { phase: 1, name: 'Iniciante', icon: Sprout, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' };
      case 'crescimento': return { phase: 2, name: 'Crescimento', icon: Flame, color: 'text-orange-500', bgColor: 'bg-orange-500/10' };
      case 'aquecido': return { phase: 3, name: 'Aquecido', icon: TreeDeciduous, color: 'text-primary', bgColor: 'bg-primary/10' };
      case 'maduro': return { phase: 4, name: 'Maduro', icon: TreeDeciduous, color: 'text-primary', bgColor: 'bg-primary/10' };
      default: return { phase: 1, name: 'Iniciante', icon: Sprout, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' };
    }
  };

  const toggleWarming = async () => {
    if (!settings?.id) {
      console.error('toggleWarming: settings not loaded or missing id', settings);
      toast({
        title: 'Configurações não encontradas',
        description: 'As configurações do sistema ainda não foram carregadas. Aguarde um momento e tente novamente, ou recarregue a página.',
        variant: 'destructive',
      });
      return;
    }

    if (chipStats.connected === 0) {
      toast({
        title: 'Nenhum chip conectado',
        description: 'Conecte pelo menos um chip antes de iniciar o aquecimento. Acesse "Meus Chips" para conectar.',
        variant: 'destructive',
      });
      return;
    }

    setIsTogglingWarming(true);

    try {
      const newState = !settings.is_warming_active;
      console.log('toggleWarming: updating settings id=', settings.id, 'to', newState);
      
      const { error, data } = await supabase
        .from('system_settings')
        .update({ is_warming_active: newState } as any)
        .eq('id', settings.id)
        .select('id, is_warming_active')
        .maybeSingle();

      console.log('toggleWarming result:', { error, data });

      if (error) {
        if (error.code === '42501' || error.message?.includes('permission') || error.message?.includes('policy')) {
          throw new Error('Você não tem permissão para alterar esta configuração. Apenas administradores master podem controlar o aquecimento.');
        }
        throw error;
      }

      if (!data) {
        throw new Error('Não foi possível atualizar. Verifique suas permissões ou recarregue a página.');
      }

      setSettings({ ...settings, is_warming_active: newState });
      toast({
        title: newState ? '✅ Aquecimento ativado' : '⏸️ Aquecimento pausado',
        description: newState
          ? 'O sistema começará a enviar mensagens automaticamente para os chips conectados.'
          : 'O envio automático foi pausado. Nenhuma mensagem será enviada até reativar.',
      });
    } catch (error: any) {
      console.error('Error toggling warming:', error);
      toast({
        title: 'Não foi possível alterar o aquecimento',
        description: error?.message || 'Ocorreu um erro inesperado. Tente novamente ou entre em contato com o suporte.',
        variant: 'destructive',
      });
    } finally {
      setIsTogglingWarming(false);
    }
  };

  const runManualWarming = async () => {
    if (chipStats.connected === 0) {
      toast({
        title: 'Nenhum chip conectado',
        description: 'Conecte pelo menos um chip antes de executar o aquecimento.',
        variant: 'destructive',
      });
      return;
    }

    setIsRunningManual(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        toast({ title: 'Sessão expirada', description: 'Faça login novamente para continuar.', variant: 'destructive' });
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/warming-engine`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('Warming engine error:', response.status, errorBody);
        if (response.status === 403 || response.status === 401) {
          throw new Error('Sem permissão para executar o aquecimento. Apenas administradores podem usar esta função.');
        }
        throw new Error(`Erro do servidor (${response.status}). Tente novamente em alguns minutos.`);
      }

      const result = await response.json();

      if (result.messagesSent > 0) {
        toast({
          title: '✅ Aquecimento executado',
          description: `${result.messagesSent} mensagem(ns) enviada(s) com sucesso.`,
        });
        fetchData();
      } else {
        toast({
          title: 'Nenhuma mensagem enviada',
          description: result.message || 'Possíveis razões: todos os chips atingiram o limite diário, horário fora da janela configurada, ou não há números disponíveis.',
        });
      }
    } catch (error: any) {
      console.error('Error running manual warming:', error);
      toast({
        title: 'Erro ao executar aquecimento',
        description: error?.message || 'Não foi possível executar. Verifique sua conexão e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsRunningManual(false);
    }
  };

  // Generate sparkline data from recent messages
  const sparklineData = useMemo(() => {
    if (recentMessages.length === 0) return [];
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days[d.toISOString().slice(0, 10)] = 0;
    }
    recentMessages.forEach(m => {
      const key = m.created_at.slice(0, 10);
      if (days[key] !== undefined) days[key]++;
    });
    return Object.entries(days).map(([date, count]) => ({ date, count }));
  }, [recentMessages]);

  const statCards = [
    {
      title: 'Chips Ativos',
      value: chipStats.total,
      icon: Smartphone,
      description: `${chipStats.connected} online`,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      sparkColor: 'hsl(var(--primary))',
    },
    {
      title: 'Mensagens Hoje',
      value: messageStats.today,
      icon: MessageSquare,
      description: 'enviadas e recebidas',
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10',
      sparkColor: '#60a5fa',
    },
    {
      title: 'Esta Semana',
      value: messageStats.week,
      icon: TrendingUp,
      description: 'mensagens trocadas',
      color: 'text-amber-400',
      bgColor: 'bg-amber-400/10',
      sparkColor: '#fbbf24',
    },
    {
      title: 'Este Mês',
      value: messageStats.month,
      icon: Activity,
      description: 'total de mensagens',
      color: 'text-purple-400',
      bgColor: 'bg-purple-400/10',
      sparkColor: '#c084fc',
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral dos seus chips
          </p>
        </div>

        {/* Automation Control Panel */}
        <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center",
                  settings?.is_warming_active ? "bg-primary/20" : "bg-muted"
                )}>
                  <Zap className={cn(
                    "w-6 h-6",
                    settings?.is_warming_active ? "text-primary" : "text-muted-foreground"
                  )} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Controle de Automação</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <Badge variant={settings?.is_warming_active ? "default" : "secondary"}>
                      {settings?.is_warming_active ? "Ativo" : "Pausado"}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Chips conectados: {chipStats.connected}/{chipStats.total}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Na fila: {queueCount}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={settings?.is_warming_active ? "outline" : "default"}
                  onClick={toggleWarming}
                  disabled={isTogglingWarming}
                >
                  {isTogglingWarming ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : settings?.is_warming_active ? (
                    <Pause className="w-4 h-4 mr-2" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  {settings?.is_warming_active ? 'Pausar' : 'Iniciar'}
                </Button>
                <Button
                  variant="outline"
                  onClick={runManualWarming}
                  disabled={isRunningManual || !settings?.is_warming_active}
                >
                  {isRunningManual ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Executar Agora
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.08 }}
            >
              <Card className="border-border/50 overflow-hidden group hover:border-primary/30 transition-colors duration-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.title}</p>
                      <p className="text-3xl font-bold mt-1">{stat.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                    </div>
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200", stat.bgColor)}>
                      <stat.icon className={cn("w-6 h-6", stat.color)} />
                    </div>
                  </div>
                  {sparklineData.length > 0 && (
                    <div className="mt-3 h-8 -mx-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sparklineData}>
                          <defs>
                            <linearGradient id={`spark-${index}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={stat.sparkColor} stopOpacity={0.3} />
                              <stop offset="100%" stopColor={stat.sparkColor} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <Area
                            type="monotone"
                            dataKey="count"
                            stroke={stat.sparkColor}
                            strokeWidth={1.5}
                            fill={`url(#spark-${index})`}
                            dot={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <MessagesChart messages={recentMessages} />
          </div>
          <ChipsStatusChart chips={chips} />
        </div>

        {/* Chips Status with Warm-up Phase */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Status dos Chips</CardTitle>
            <CardDescription>
              Seus chips cadastrados
              <span className="ml-2 text-xs text-primary">(atualização em tempo real)</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chips.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum chip cadastrado ainda</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {chips.map((chip) => {
                  const daysActive = getDaysActive(chip.activated_at);
                  const messageLimit = getMessageLimit(chip.warming_phase || 'novo');
                  const isConnected = chip.status === 'connected';
                  const messagesSent = chip.messages_sent_today || 0;
                  const progressPercent = Math.min((messagesSent / messageLimit) * 100, 100);
                  const warmupPhase = getWarmupPhase(chip.warming_phase || 'novo');
                  const PhaseIcon = warmupPhase.icon;

                  return (
                    <div 
                      key={chip.id} 
                      className={cn(
                        "p-4 rounded-xl border transition-colors",
                        isConnected 
                          ? "border-primary/30 bg-primary/5" 
                          : "border-border bg-secondary/30"
                      )}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            isConnected ? "bg-primary/20" : "bg-muted"
                          )}>
                            <Smartphone className={cn(
                              "w-4 h-4",
                              isConnected ? "text-primary" : "text-muted-foreground"
                            )} />
                          </div>
                          <span className="font-medium">{(chip as any).nickname || `Slot ${chip.slot_number}`}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isConnected ? (
                            <Wifi className="w-4 h-4 text-primary" />
                          ) : (
                            <WifiOff className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className={cn(
                            "text-xs font-medium",
                            isConnected ? "text-primary" : "text-muted-foreground"
                          )}>
                            {isConnected ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </div>

                      {/* Warm-up Phase Badge */}
                      <div className={cn(
                        "flex items-center gap-2 px-2 py-1 rounded-md mb-3",
                        warmupPhase.bgColor
                      )}>
                        <PhaseIcon className={cn("w-4 h-4", warmupPhase.color)} />
                        <span className={cn("text-xs font-medium", warmupPhase.color)}>
                          Fase {warmupPhase.phase}: {warmupPhase.name}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {daysActive} dias
                        </span>
                      </div>

                      <div className="space-y-2 text-sm">
                        <p className="text-muted-foreground truncate">
                          {chip.phone_number || 'Número não conectado'}
                        </p>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Msgs hoje:</span>
                          <span className="font-medium">{messagesSent}/{messageLimit}</span>
                        </div>
                        {/* Progress bar */}
                        <Progress 
                          value={progressPercent} 
                          className={cn(
                            "h-1.5",
                            progressPercent >= 90 ? "[&>div]:bg-destructive" : 
                            progressPercent >= 70 ? "[&>div]:bg-amber-500" : ""
                          )}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
