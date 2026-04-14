import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Smartphone, MessageSquare, Wifi, WifiOff, Activity, TrendingUp, Play, Pause, Zap, RefreshCw, Loader2, Flame, Sprout, TreeDeciduous } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { cn } from '@/lib/utils';
import { useRealtimeChips } from '@/hooks/useRealtimeChips';
import { MessagesChart } from '@/components/charts/MessagesChart';
import { ChipsStatusChart } from '@/components/charts/ChipsStatusChart';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardData } from '@/hooks/useDashboardData';

const getWarmupPhase = (phase: string) => {
  switch (phase) {
    case 'novo': return { name: 'Novo', icon: Sprout, color: 'text-gray-400', bgColor: 'bg-gray-400/10' };
    case 'iniciante': return { name: 'Iniciante', icon: Sprout, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' };
    case 'crescimento': return { name: 'Crescimento', icon: Flame, color: 'text-orange-500', bgColor: 'bg-orange-500/10' };
    case 'aquecido': return { name: 'Aquecido', icon: TreeDeciduous, color: 'text-primary', bgColor: 'bg-primary/10' };
    case 'maduro': return { name: 'Maduro', icon: TreeDeciduous, color: 'text-primary', bgColor: 'bg-primary/10' };
    default: return { name: 'Iniciante', icon: Sprout, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' };
  }
};

const getDaysActive = (activatedAt: string | null) => {
  if (!activatedAt) return 0;
  return Math.floor((Date.now() - new Date(activatedAt).getTime()) / (1000 * 60 * 60 * 24));
};

export default function Dashboard() {
  const { user } = useAuth();
  const {
    chipStats, messageStats, chips, recentMessages, isLoading, settings,
    isTogglingWarming, isRunningManual, queueCount, sparklineData,
    updateChipsFromRealtime, fetchData, toggleWarming, runManualWarming, getMessageLimit,
  } = useDashboardData();

  useRealtimeChips(updateChipsFromRealtime, user?.id);
  useEffect(() => { fetchData(); }, [user]);

  const statCards = [
    { title: 'Chips Ativos', value: chipStats.total, icon: Smartphone, description: `${chipStats.connected} online`, color: 'text-primary', bgColor: 'bg-primary/10', sparkColor: 'hsl(var(--primary))' },
    { title: 'Mensagens Hoje', value: messageStats.today, icon: MessageSquare, description: 'enviadas e recebidas', color: 'text-blue-400', bgColor: 'bg-blue-400/10', sparkColor: '#60a5fa' },
    { title: 'Esta Semana', value: messageStats.week, icon: TrendingUp, description: 'mensagens trocadas', color: 'text-amber-400', bgColor: 'bg-amber-400/10', sparkColor: '#fbbf24' },
    { title: 'Este Mês', value: messageStats.month, icon: Activity, description: 'total de mensagens', color: 'text-purple-400', bgColor: 'bg-purple-400/10', sparkColor: '#c084fc' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral dos seus chips</p>
        </div>

        {/* Automation Control Panel */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", settings?.is_warming_active ? "bg-primary/20" : "bg-muted")}>
                    <Zap className={cn("w-6 h-6", settings?.is_warming_active ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Controle de Automação</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <Badge variant={settings?.is_warming_active ? "default" : "secondary"}>{settings?.is_warming_active ? "Ativo" : "Pausado"}</Badge>
                      <span className="text-sm text-muted-foreground">Chips conectados: {chipStats.connected}/{chipStats.total}</span>
                      <span className="text-sm text-muted-foreground">Na fila: {queueCount}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant={settings?.is_warming_active ? "outline" : "default"} onClick={toggleWarming} disabled={isTogglingWarming}>
                    {isTogglingWarming ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : settings?.is_warming_active ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                    {settings?.is_warming_active ? 'Pausar' : 'Iniciar'}
                  </Button>
                  <Button variant="outline" onClick={runManualWarming} disabled={isRunningManual || !settings?.is_warming_active}>
                    {isRunningManual ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    Executar Agora
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <motion.div key={stat.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.08 }}>
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
                          <Area type="monotone" dataKey="count" stroke={stat.sparkColor} strokeWidth={1.5} fill={`url(#spark-${index})`} dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2"><MessagesChart messages={recentMessages} /></div>
          <ChipsStatusChart chips={chips} />
        </div>

        {/* Chips Status */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Status dos Chips</CardTitle>
            <CardDescription>Seus chips cadastrados <span className="ml-2 text-xs text-primary">(atualização em tempo real)</span></CardDescription>
          </CardHeader>
          <CardContent>
            {chips.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground"><Smartphone className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>Nenhum chip cadastrado ainda</p></div>
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
                    <Card key={chip.id} className={cn("border-border/50 transition-all duration-200", isConnected && "border-primary/30")}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", isConnected ? "bg-primary/20" : "bg-muted")}>
                              <Smartphone className={cn("w-4 h-4", isConnected ? "text-primary" : "text-muted-foreground")} />
                            </div>
                            <div>
                              <p className="text-sm font-medium">Slot {chip.slot_number}</p>
                              <div className="flex items-center gap-1">
                                {isConnected ? <Wifi className="w-3 h-3 text-primary" /> : <WifiOff className="w-3 h-3 text-muted-foreground" />}
                                <span className={cn("text-xs", isConnected ? "text-primary" : "text-muted-foreground")}>{isConnected ? 'Online' : 'Offline'}</span>
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline" className={cn("text-xs", warmupPhase.color)}>
                            <PhaseIcon className="w-3 h-3 mr-1" />{warmupPhase.name}
                          </Badge>
                        </div>
                        {chip.phone_number && <p className="text-xs text-muted-foreground mb-2">{chip.phone_number}</p>}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Msgs hoje</span><span>{messagesSent}/{messageLimit}</span></div>
                          <Progress value={progressPercent} className="h-1.5" />
                        </div>
                        {chip.activated_at && <p className="text-xs text-muted-foreground mt-2">{daysActive} dias ativo</p>}
                      </CardContent>
                    </Card>
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
