import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Wifi,
  WifiOff,
  Smartphone,
  Activity,
  RefreshCw,
  Loader2,
  Flame,
  Sprout,
  TreeDeciduous,
  AlertTriangle,
  Clock,
  MessageSquare,
  Zap,
  Signal,
  SignalZero,
  User,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface ChipMonitorData {
  id: string;
  instance_name: string;
  phone_number: string | null;
  status: string;
  warming_phase: string;
  messages_sent_today: number;
  activated_at: string | null;
  last_message_at: string | null;
  last_connection_attempt: string | null;
  nickname: string | null;
  user_id: string;
  slot_number: number;
  chip_type: string;
}

interface LifecycleLog {
  id: string;
  chip_id: string;
  event: string;
  details: string | null;
  created_at: string;
}

interface WarmingChartData {
  date: string;
  sent: number;
  received: number;
  errors: number;
}

interface SystemSettings {
  messages_day_novo: number;
  messages_day_1_3: number;
  messages_day_4_7: number;
  messages_day_aquecido: number;
  messages_day_8_plus: number;
}

const PHASE_CONFIG: Record<string, { label: string; icon: typeof Sprout; color: string; bgColor: string; order: number }> = {
  novo: { label: 'Novo', icon: Sprout, color: 'text-blue-400', bgColor: 'bg-blue-400/10', order: 0 },
  iniciante: { label: 'Iniciante', icon: Sprout, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', order: 1 },
  crescimento: { label: 'Crescimento', icon: Flame, color: 'text-orange-500', bgColor: 'bg-orange-500/10', order: 2 },
  aquecido: { label: 'Aquecido', icon: TreeDeciduous, color: 'text-red-500', bgColor: 'bg-red-500/10', order: 3 },
  maduro: { label: 'Maduro', icon: TreeDeciduous, color: 'text-primary', bgColor: 'bg-primary/10', order: 4 },
};

const STATUS_COLORS: Record<string, string> = {
  connected: 'bg-green-500',
  disconnected: 'bg-red-500',
  connecting: 'bg-yellow-500',
};

const PIE_COLORS = ['hsl(var(--primary))', '#ef4444', '#eab308', '#3b82f6', '#8b5cf6'];

export default function ChipMonitor() {
  const { user, isAdmin, isSupport } = useAuth();
  const { toast } = useToast();
  const [chips, setChips] = useState<ChipMonitorData[]>([]);
  const [lifecycleLogs, setLifecycleLogs] = useState<LifecycleLog[]>([]);
  const [warmingData, setWarmingData] = useState<WarmingChartData[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isHealthChecking, setIsHealthChecking] = useState(false);
  const [selectedChipId, setSelectedChipId] = useState<string | null>(null);
  const [profilesMap, setProfilesMap] = useState<Record<string, { email: string; name: string | null }>>({});
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterUserId, setFilterUserId] = useState<string>('all');
  const [chipTypeTab, setChipTypeTab] = useState<'warming' | 'whatsapp'>('whatsapp');

  const canManage = isAdmin || isSupport;

  const fetchAllData = useCallback(async () => {
    if (!user) return;
    try {
      // Fetch all chips (admin/support see all)
      const { data: chipsData } = await supabase
        .from('chips')
        .select('*')
        .order('slot_number');

      setChips((chipsData || []) as unknown as ChipMonitorData[]);

      // Fetch profiles for user name mapping - use RPC fallback for reliability
      const { data: rpcProfiles } = await supabase.rpc('get_all_chat_profiles');
      const pMap: Record<string, { email: string; name: string | null }> = {};
      if (rpcProfiles) {
        rpcProfiles.forEach((p: any) => { pMap[p.user_id] = { email: p.email, name: p.name }; });
      } else {
        // Fallback to direct query
        const { data: profilesData } = await supabase.from('profiles').select('user_id, email, name');
        (profilesData || []).forEach(p => { pMap[p.user_id] = { email: p.email, name: p.name }; });
      }
      setProfilesMap(pMap);

      const { data: settingsData } = await supabase
        .from('system_settings')
        .select('messages_day_novo, messages_day_1_3, messages_day_4_7, messages_day_aquecido, messages_day_8_plus')
        .maybeSingle();
      if (settingsData) setSettings(settingsData as unknown as SystemSettings);

      // Fetch recent lifecycle logs
      const { data: logsData } = await supabase
        .from('chip_lifecycle_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setLifecycleLogs((logsData || []) as LifecycleLog[]);

      // Fetch warming data (last 14 days of message_history)
      const chipIds = (chipsData || []).map(c => c.id);
      if (chipIds.length > 0) {
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const { data: messagesData } = await supabase
          .from('message_history')
          .select('created_at, direction, status')
          .in('chip_id', chipIds)
          .gte('created_at', fourteenDaysAgo)
          .order('created_at');

        // Aggregate by day
        const dayMap: Record<string, { sent: number; received: number; errors: number }> = {};
        (messagesData || []).forEach(msg => {
          const day = new Date(msg.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          if (!dayMap[day]) dayMap[day] = { sent: 0, received: 0, errors: 0 };
          if (msg.status === 'error' || msg.status === 'failed') {
            dayMap[day].errors++;
          } else if (msg.direction === 'outgoing' || msg.direction === 'sent') {
            dayMap[day].sent++;
          } else {
            dayMap[day].received++;
          }
        });

        const chartData = Object.entries(dayMap).map(([date, data]) => ({ date, ...data }));
        setWarmingData(chartData);
      }
    } catch (error) {
      console.error('Error fetching chip monitor data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Realtime subscription for chip updates
  useEffect(() => {
    const channel = supabase
      .channel('chip-monitor-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chips' }, () => {
        fetchAllData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAllData]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchAllData, 30000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  const handleHealthCheck = async () => {
    if (isHealthChecking) return;
    setIsHealthChecking(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Sessão expirada');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chip-health-check`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Erro no health check');

      toast({
        title: '✅ Health Check concluído',
        description: `${result.checked} chips verificados — ${result.connected} online, ${result.disconnected} offline`,
      });
      fetchAllData();
    } catch (error: any) {
      toast({ title: 'Erro no Health Check', description: error.message, variant: 'destructive' });
    } finally {
      setIsHealthChecking(false);
    }
  };

  const getMessageLimit = (phase: string) => {
    if (!settings) return 50;
    const map: Record<string, number> = {
      novo: settings.messages_day_novo,
      iniciante: settings.messages_day_1_3,
      crescimento: settings.messages_day_4_7,
      aquecido: settings.messages_day_aquecido,
      maduro: settings.messages_day_8_plus,
    };
    return map[phase] || settings.messages_day_novo;
  };

  const getDaysActive = (activatedAt: string | null) => {
    if (!activatedAt) return 0;
    return Math.floor((Date.now() - new Date(activatedAt).getTime()) / (1000 * 60 * 60 * 24));
  };

  const getTimeSince = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Agora';
    if (mins < 60) return `${mins}min atrás`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    return `${days}d atrás`;
  };

  // KPIs
  const totalChips = chips.length;
  const connectedChips = chips.filter(c => c.status === 'connected').length;
  const disconnectedChips = chips.filter(c => c.status !== 'connected').length;
  const totalMsgToday = chips.reduce((sum, c) => sum + (c.messages_sent_today || 0), 0);

  // Phase distribution for pie chart
  const phaseDistribution = Object.entries(PHASE_CONFIG).map(([key, config]) => ({
    name: config.label,
    value: chips.filter(c => c.warming_phase === key).length,
  })).filter(d => d.value > 0);

  // Per-chip warming data for selected chip
  const selectedChipLogs = selectedChipId
    ? lifecycleLogs.filter(l => l.chip_id === selectedChipId)
    : lifecycleLogs;

  // Unique users for filter dropdown
  const uniqueUsers = useMemo(() => {
    const userIds = [...new Set(chips.map(c => c.user_id))];
    return userIds.map(uid => ({
      user_id: uid,
      label: profilesMap[uid]?.name || profilesMap[uid]?.email || uid.slice(0, 8),
    }));
  }, [chips, profilesMap]);

  // Filtered chips
  const filteredChips = useMemo(() => {
    return chips.filter(c => {
      if (c.chip_type !== chipTypeTab) return false;
      if (filterStatus === 'connected' && c.status !== 'connected') return false;
      if (filterStatus === 'disconnected' && c.status === 'connected') return false;
      if (filterUserId !== 'all' && c.user_id !== filterUserId) return false;
      return true;
    });
  }, [chips, filterStatus, filterUserId, chipTypeTab]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Monitor de Chips</h1>
            <p className="text-muted-foreground">
              Monitoramento em tempo real de todos os chips do sistema
              <span className="ml-2 text-xs text-primary">(auto-refresh 30s)</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleHealthCheck}
              disabled={isHealthChecking}
            >
              {isHealthChecking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Activity className="w-4 h-4 mr-2" />}
              Health Check
            </Button>
            <Button
              variant="outline"
              onClick={() => { setIsRefreshing(true); fetchAllData().finally(() => setIsRefreshing(false)); }}
              disabled={isRefreshing}
            >
              {isRefreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Atualizar
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Chips</p>
                  <p className="text-3xl font-bold">{totalChips}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Conectados</p>
                  <p className="text-3xl font-bold text-green-500">{connectedChips}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <Wifi className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Desconectados</p>
                  <p className="text-3xl font-bold text-destructive">{disconnectedChips}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <WifiOff className="w-6 h-6 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Mensagens Hoje</p>
                  <p className="text-3xl font-bold">{totalMsgToday}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-400/10 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="status" className="space-y-4">
          <TabsList>
            <TabsTrigger value="status">Status dos Chips</TabsTrigger>
            <TabsTrigger value="warming">Relatórios de Aquecimento</TabsTrigger>
            <TabsTrigger value="logs">Logs de Atividade</TabsTrigger>
          </TabsList>

          <TabsContent value="status" className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-wrap gap-3">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-3.5 h-3.5 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="connected">Conectados</SelectItem>
                  <SelectItem value="disconnected">Desconectados</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterUserId} onValueChange={setFilterUserId}>
                <SelectTrigger className="w-[220px]">
                  <User className="w-3.5 h-3.5 mr-2" />
                  <SelectValue placeholder="Usuário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os usuários</SelectItem>
                  {uniqueUsers.map(u => (
                    <SelectItem key={u.user_id} value={u.user_id}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(filterStatus !== 'all' || filterUserId !== 'all') && (
                <Button variant="ghost" size="sm" onClick={() => { setFilterStatus('all'); setFilterUserId('all'); }}>
                  Limpar filtros
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                Carregando chips...
              </div>
            ) : filteredChips.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum chip encontrado</CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredChips.map(chip => {
                  const phase = PHASE_CONFIG[chip.warming_phase] || PHASE_CONFIG.novo;
                  const PhaseIcon = phase.icon;
                  const limit = getMessageLimit(chip.warming_phase);
                  const progress = limit > 0 ? Math.min(100, (chip.messages_sent_today / limit) * 100) : 0;
                  const daysActive = getDaysActive(chip.activated_at);

                  return (
                    <Card
                      key={chip.id}
                      className={cn(
                        "border-border/50 transition-all hover:border-border cursor-pointer",
                        selectedChipId === chip.id && "ring-2 ring-primary"
                      )}
                      onClick={() => setSelectedChipId(selectedChipId === chip.id ? null : chip.id)}
                    >
                      <CardContent className="p-5 space-y-4">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-3 h-3 rounded-full", STATUS_COLORS[chip.status] || 'bg-muted')} />
                            <div>
                              <p className="font-semibold text-sm">
                                {chip.nickname || chip.instance_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {chip.phone_number ? `+${chip.phone_number}` : 'Sem número'}
                              </p>
                              <p className="text-[10px] text-primary/70 flex items-center gap-1">
                                <User className="w-2.5 h-2.5" />
                                {profilesMap[chip.user_id]?.name || profilesMap[chip.user_id]?.email || 'Desconhecido'}
                              </p>
                            </div>
                          </div>
                          <Badge variant={chip.status === 'connected' ? 'default' : 'destructive'} className="text-[10px]">
                            {chip.status === 'connected' ? 'Online' : chip.status === 'connecting' ? 'Conectando' : 'Offline'}
                          </Badge>
                        </div>

                        {/* Phase & Progress */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <PhaseIcon className={cn("w-3.5 h-3.5", phase.color)} />
                              <span className={phase.color}>{phase.label}</span>
                            </div>
                            <span className="text-muted-foreground">
                              {chip.messages_sent_today}/{limit} msgs
                            </span>
                          </div>
                          <Progress value={progress} className="h-1.5" />
                        </div>

                        {/* Meta info */}
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{daysActive}d ativo</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            <span>Última: {getTimeSince(chip.last_message_at)}</span>
                          </div>
                          <div className="flex items-center gap-1 col-span-2">
                            <Signal className="w-3 h-3" />
                            <span>Slot {chip.slot_number} • Último check: {getTimeSince(chip.last_connection_attempt)}</span>
                          </div>
                        </div>

                        {/* Alert for disconnected */}
                        {chip.status !== 'connected' && daysActive > 0 && (
                          <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>Chip desconectado — aquecimento pausado</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Warming Reports Tab */}
          <TabsContent value="warming" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Messages over time chart */}
              <Card className="lg:col-span-2 border-border/50">
                <CardHeader>
                  <CardTitle className="text-base">Mensagens nos Últimos 14 Dias</CardTitle>
                  <CardDescription>Enviadas, recebidas e erros por dia</CardDescription>
                </CardHeader>
                <CardContent>
                  {warmingData.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">Sem dados de mensagens no período</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={warmingData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            color: 'hsl(var(--foreground))',
                          }}
                        />
                        <Legend />
                        <Bar dataKey="sent" name="Enviadas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="received" name="Recebidas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="errors" name="Erros" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Phase distribution */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-base">Distribuição por Fase</CardTitle>
                  <CardDescription>Chips por fase de aquecimento</CardDescription>
                </CardHeader>
                <CardContent>
                  {phaseDistribution.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">Sem chips</div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={phaseDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            dataKey="value"
                            paddingAngle={2}
                          >
                            {phaseDistribution.map((_, idx) => (
                              <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1 mt-2">
                        {phaseDistribution.map((d, idx) => (
                          <div key={d.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                              <span>{d.name}</span>
                            </div>
                            <span className="font-medium">{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Per-chip warming stats */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Progresso de Aquecimento por Chip</CardTitle>
                <CardDescription>Desempenho diário e progressão de fase</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {chips.map(chip => {
                    const phase = PHASE_CONFIG[chip.warming_phase] || PHASE_CONFIG.novo;
                    const limit = getMessageLimit(chip.warming_phase);
                    const progress = limit > 0 ? Math.min(100, (chip.messages_sent_today / limit) * 100) : 0;
                    const phaseProgress = ((phase.order + 1) / 5) * 100;

                    return (
                      <div key={chip.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                        <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", STATUS_COLORS[chip.status] || 'bg-muted')} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium truncate">
                              {chip.nickname || chip.instance_name}
                              {chip.phone_number && <span className="text-muted-foreground ml-2 text-xs">+{chip.phone_number}</span>}
                            </span>
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {phase.label}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-[10px] text-muted-foreground mb-0.5">Msgs hoje ({chip.messages_sent_today}/{limit})</p>
                              <Progress value={progress} className="h-1" />
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground mb-0.5">Fase ({phase.order + 1}/5)</p>
                              <Progress value={phaseProgress} className="h-1" />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Logs de Ciclo de Vida</CardTitle>
                <CardDescription>
                  Últimos 50 eventos
                  {selectedChipId && (
                    <Button variant="ghost" size="sm" className="ml-2 h-5 text-xs" onClick={() => setSelectedChipId(null)}>
                      Limpar filtro
                    </Button>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedChipLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">Nenhum log encontrado</div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {selectedChipLogs.map(log => {
                      const chip = chips.find(c => c.id === log.chip_id);
                      return (
                        <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg bg-muted/20 text-sm">
                          <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{log.event}</span>
                              {chip && (
                                <span className="text-xs text-muted-foreground">
                                  ({chip.nickname || chip.instance_name})
                                </span>
                              )}
                            </div>
                            {log.details && <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.details}</p>}
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {new Date(log.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
