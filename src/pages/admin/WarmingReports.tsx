import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Smartphone,
  Loader2,
  Flame,
  Sprout,
  TreeDeciduous,
  MessageSquare,
  RefreshCw,
  User
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface ChipData {
  id: string;
  instance_name: string;
  phone_number: string | null;
  status: string;
  warming_phase: string;
  messages_sent_today: number;
  activated_at: string | null;
  nickname: string | null;
  user_id: string;
  chip_type: string;
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

const PHASE_CONFIG: Record<string, { label: string; icon: typeof Sprout; color: string; order: number }> = {
  novo: { label: 'Novo', icon: Sprout, color: 'text-blue-400', order: 0 },
  iniciante: { label: 'Iniciante', icon: Sprout, color: 'text-yellow-500', order: 1 },
  crescimento: { label: 'Crescimento', icon: Flame, color: 'text-orange-500', order: 2 },
  aquecido: { label: 'Aquecido', icon: TreeDeciduous, color: 'text-red-500', order: 3 },
  maduro: { label: 'Maduro', icon: TreeDeciduous, color: 'text-primary', order: 4 },
};

const STATUS_COLORS: Record<string, string> = {
  connected: 'bg-green-500',
  disconnected: 'bg-red-500',
  connecting: 'bg-yellow-500',
};

const PIE_COLORS = ['hsl(var(--primary))', '#ef4444', '#eab308', '#3b82f6', '#8b5cf6'];

export default function WarmingReports() {
  const { user } = useAuth();
  const [chips, setChips] = useState<ChipData[]>([]);
  const [warmingData, setWarmingData] = useState<WarmingChartData[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [profilesMap, setProfilesMap] = useState<Record<string, { email: string; name: string | null }>>({});
  const [filterUserId, setFilterUserId] = useState<string>('all');

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const { data: chipsData } = await supabase.from('chips').select('*').order('slot_number');
      setChips((chipsData || []) as unknown as ChipData[]);

      const { data: rpcProfiles } = await supabase.rpc('get_all_chat_profiles');
      const pMap: Record<string, { email: string; name: string | null }> = {};
      if (rpcProfiles) {
        rpcProfiles.forEach((p: any) => { pMap[p.user_id] = { email: p.email, name: p.name }; });
      }
      setProfilesMap(pMap);

      const { data: settingsData } = await supabase
        .from('system_settings')
        .select('messages_day_novo, messages_day_1_3, messages_day_4_7, messages_day_aquecido, messages_day_8_plus')
        .maybeSingle();
      if (settingsData) setSettings(settingsData as unknown as SystemSettings);

      const chipIds = (chipsData || []).map(c => c.id);
      if (chipIds.length > 0) {
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const { data: messagesData } = await supabase
          .from('message_history')
          .select('created_at, direction, status')
          .in('chip_id', chipIds)
          .gte('created_at', fourteenDaysAgo)
          .order('created_at');

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
        setWarmingData(Object.entries(dayMap).map(([date, data]) => ({ date, ...data })));
      }
    } catch (error) {
      console.error('Error fetching warming reports:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  const phaseDistribution = Object.entries(PHASE_CONFIG).map(([key, config]) => ({
    name: config.label,
    value: chips.filter(c => c.warming_phase === key).length,
  })).filter(d => d.value > 0);

  const uniqueUsers = useMemo(() => {
    const userIds = [...new Set(chips.map(c => c.user_id))];
    return userIds.map(uid => ({
      user_id: uid,
      label: profilesMap[uid]?.name || profilesMap[uid]?.email || uid.slice(0, 8),
    }));
  }, [chips, profilesMap]);

  const filteredChips = useMemo(() => {
    return chips.filter(c => {
      if (filterUserId !== 'all' && c.user_id !== filterUserId) return false;
      return true;
    });
  }, [chips, filterUserId]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Relatórios de Aquecimento</h1>
            <p className="text-muted-foreground">Análise de desempenho e progressão dos chips</p>
          </div>
          <div className="flex gap-2">
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
            <Button
              variant="outline"
              onClick={() => { setIsRefreshing(true); fetchData().finally(() => setIsRefreshing(false)); }}
              disabled={isRefreshing}
            >
              {isRefreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Atualizar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Progresso de Aquecimento por Chip</CardTitle>
            <CardDescription>Desempenho diário e progressão de fase</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredChips.map(chip => {
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
              {filteredChips.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">Nenhum chip encontrado</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
