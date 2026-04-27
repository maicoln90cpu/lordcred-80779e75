import { useState, useEffect, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area
} from 'recharts';
import { Users, TrendingUp, Clock, MessageSquare, CheckCircle, XCircle, Phone, Download, Calendar as CalendarIcon, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SellerProfile {
  user_id: string;
  email: string;
  name: string | null;
}

interface ChipData {
  id: string;
  user_id: string;
  chip_type: string;
}

interface RpcLeadStat {
  user_id: string;
  total: number;
  contacted: number;
  approved: number;
  pending: number;
}

interface RpcMsgStat {
  chip_id: string;
  sent: number;
  received: number;
}

interface StatusDistItem {
  status: string;
  count: number;
}

interface AvgResponseItem {
  user_id: string;
  avg_hours: number;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
const PERIOD_OPTIONS = [
  { label: 'Última hora', value: -6 },
  { label: 'Hoje', value: -2 },
  { label: 'Ontem', value: -3 },
  { label: 'Essa Semana', value: -4 },
  { label: 'Semana Passada', value: -5 },
  { label: '7 dias', value: 7 },
  { label: '30 dias', value: 30 },
  { label: '90 dias', value: 90 },
  { label: 'Tudo', value: 0 },
  { label: 'Personalizado', value: -1 },
];

function applyTime(date: Date, time: string, fallback: [number, number, number, number]) {
  const d = new Date(date);
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(time || '');
  if (m) {
    d.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
  } else {
    d.setHours(fallback[0], fallback[1], fallback[2], fallback[3]);
  }
  return d;
}

function computeDateRange(
  periodDays: number,
  customDateFrom?: Date,
  customDateTo?: Date,
  customTimeFrom = '00:00',
  customTimeTo = '23:59',
) {
  const now = new Date();
  let dateFrom: string | null = null;
  let dateTo: string | null = null;

  if (periodDays === -1) {
    dateFrom = customDateFrom ? applyTime(customDateFrom, customTimeFrom, [0, 0, 0, 0]).toISOString() : null;
    dateTo   = customDateTo   ? applyTime(customDateTo,   customTimeTo,   [23, 59, 59, 999]).toISOString() : null;
  } else if (periodDays === 0) {
    // Tudo
  } else if (periodDays === -2) {
    dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  } else if (periodDays === -3) {
    dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
    dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999).toISOString();
  } else if (periodDays === -4) {
    const day = now.getDay();
    dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day).toISOString();
  } else if (periodDays === -5) {
    const day = now.getDay();
    dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day - 7).toISOString();
    dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day - 1, 23, 59, 59, 999).toISOString();
  } else if (periodDays === -6) {
    // Última hora (atalho)
    dateFrom = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  } else {
    const d = new Date();
    d.setDate(d.getDate() - periodDays);
    dateFrom = d.toISOString();
  }
  return { dateFrom, dateTo };
}

export default function Performance() {
  const { user } = useAuth();
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [chips, setChips] = useState<ChipData[]>([]);
  const [rpcLeadStats, setRpcLeadStats] = useState<RpcLeadStat[]>([]);
  const [rpcMsgStats, setRpcMsgStats] = useState<RpcMsgStat[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<StatusDistItem[]>([]);
  const [avgResponseTimes, setAvgResponseTimes] = useState<AvgResponseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [periodDays, setPeriodDays] = useState(30);
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>();
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>();
  const [customTimeFrom, setCustomTimeFrom] = useState('00:00');
  const [customTimeTo, setCustomTimeTo] = useState('23:59');

  const { dateFrom, dateTo } = useMemo(
    () => computeDateRange(periodDays, customDateFrom, customDateTo, customTimeFrom, customTimeTo),
    [periodDays, customDateFrom, customDateTo, customTimeFrom, customTimeTo]
  );

  // Fetch static data once
  useEffect(() => {
    (async () => {
      const [sellersRes, chipsRes] = await Promise.all([
        supabase.rpc('get_visible_profiles'),
        supabase.from('chips').select('id, user_id, chip_type'),
      ]);
      if (sellersRes.data) setSellers(sellersRes.data);
      if (chipsRes.data) setChips(chipsRes.data);
    })();
  }, []);

  // Fetch RPC stats when period changes
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [perfRes, statusRes, responseRes] = await Promise.all([
          supabase.rpc('get_performance_stats', {
            _date_from: dateFrom || undefined,
            _date_to: dateTo || undefined,
          }),
          supabase.rpc('get_lead_status_distribution', {
            _date_from: dateFrom || undefined,
            _date_to: dateTo || undefined,
          } as any),
          supabase.rpc('get_avg_response_time', {
            _date_from: dateFrom || undefined,
            _date_to: dateTo || undefined,
          } as any),
        ]);

        if (perfRes.error) throw perfRes.error;
        const parsed = typeof perfRes.data === 'string' ? JSON.parse(perfRes.data) : perfRes.data;
        setRpcLeadStats(parsed?.leads || []);
        setRpcMsgStats(parsed?.messages || []);

        const statusData = typeof statusRes.data === 'string' ? JSON.parse(statusRes.data) : statusRes.data;
        setStatusDistribution(statusData || []);

        const responseData = typeof responseRes.data === 'string' ? JSON.parse(responseRes.data) : responseRes.data;
        setAvgResponseTimes(responseData || []);
      } catch (err) {
        console.error('Error fetching performance stats:', err);
      }
      setLoading(false);
    })();
  }, [dateFrom, dateTo, refreshKey]);

  const chipsByUser = useMemo(() => {
    const map: Record<string, string[]> = {};
    chips.filter(c => c.chip_type !== 'warming').forEach(c => {
      if (!map[c.user_id]) map[c.user_id] = [];
      map[c.user_id].push(c.id);
    });
    return map;
  }, [chips]);

  const getSellerName = (s: SellerProfile) => s.name || s.email?.split('@')[0] || 'Sem nome';

  const sellerStats = useMemo(() => {
    return sellers.map(seller => {
      const leadStat = rpcLeadStats.find(l => l.user_id === seller.user_id);
      const sellerChipIds = chipsByUser[seller.user_id] || [];
      const msgStats = rpcMsgStats.filter(m => sellerChipIds.includes(m.chip_id));
      const sent = msgStats.reduce((a, m) => a + m.sent, 0);
      const received = msgStats.reduce((a, m) => a + m.received, 0);

      const totalLeads = leadStat?.total || 0;
      const contacted = leadStat?.contacted || 0;
      const approved = leadStat?.approved || 0;
      const pending = leadStat?.pending || 0;

      const avgResp = avgResponseTimes.find(r => r.user_id === seller.user_id);

      return {
        userId: seller.user_id,
        name: getSellerName(seller),
        email: seller.email,
        totalLeads,
        contacted,
        approved,
        rejected: totalLeads - contacted - pending,
        pending,
        approvalRate: totalLeads > 0 ? (approved / totalLeads * 100) : 0,
        contactRate: totalLeads > 0 ? (contacted / totalLeads * 100) : 0,
        avgResponseTime: avgResp?.avg_hours || 0,
        messagesSent: sent,
        messagesReceived: received,
      };
    }).filter(s => s.totalLeads > 0 || s.messagesSent > 0);
  }, [sellers, rpcLeadStats, rpcMsgStats, chipsByUser, avgResponseTimes]);

  const globalStats = useMemo(() => {
    const totalLeads = rpcLeadStats.reduce((a, l) => a + l.total, 0);
    const totalContacted = rpcLeadStats.reduce((a, l) => a + l.contacted, 0);
    const totalApproved = rpcLeadStats.reduce((a, l) => a + l.approved, 0);
    const totalPending = rpcLeadStats.reduce((a, l) => a + l.pending, 0);
    const totalSent = rpcMsgStats.reduce((a, m) => a + m.sent, 0);
    const totalReceived = rpcMsgStats.reduce((a, m) => a + m.received, 0);
    return { totalLeads, totalContacted, totalApproved, totalPending, totalSent, totalReceived, activeSellers: sellerStats.length };
  }, [rpcLeadStats, rpcMsgStats, sellerStats]);

  const pieChartData = useMemo(() => {
    return statusDistribution.map(item => ({
      name: item.status,
      value: item.count,
    }));
  }, [statusDistribution]);

  const leadsPerSellerChart = useMemo(() => {
    return sellerStats.map(s => ({
      name: s.name.length > 12 ? s.name.substring(0, 12) + '…' : s.name,
      Pendentes: s.pending,
      Contatados: s.contacted,
      Aprovados: s.approved,
    }));
  }, [sellerStats]);

  // CSV Export
  const exportCSV = useCallback(() => {
    const sorted = [...sellerStats].sort((a, b) => b.approvalRate - a.approvalRate);
    const headers = ['#', 'Vendedor', 'Email', 'Leads', 'Contatados', 'Aprovados', 'Taxa Aprov.(%)', 'Tempo Méd. Resp.(h)', 'Msgs Env.', 'Msgs Rec.'];
    const rows = sorted.map((s, i) => [
      i + 1, s.name, s.email, s.totalLeads, s.contacted, s.approved,
      s.approvalRate.toFixed(1), s.avgResponseTime > 0 ? s.avgResponseTime.toFixed(1) : '-',
      s.messagesSent, s.messagesReceived,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ranking-vendedores-${periodDays > 0 ? periodDays + 'dias' : 'personalizado'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sellerStats, periodDays]);

  const handlePeriodChange = (value: number) => {
    setPeriodDays(value);
    if (value !== -1) {
      setCustomDateFrom(undefined);
      setCustomDateTo(undefined);
    }
  };

  if (loading && sellers.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Performance</h1>
            <p className="text-muted-foreground">Métricas de desempenho dos vendedores</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setRefreshKey(k => k + 1)} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4 mr-1", loading && "animate-spin")} />
              Atualizar
            </Button>
            <CalendarIcon className="w-4 h-4 text-muted-foreground" />
            {PERIOD_OPTIONS.map(opt => (
              <Button
                key={opt.value}
                variant={periodDays === opt.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePeriodChange(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Custom date pickers */}
        {periodDays === -1 && (
          <div className="flex items-center gap-3 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-[160px] justify-start text-left font-normal", !customDateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customDateFrom ? format(customDateFrom, 'dd/MM/yyyy') : 'Data início'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customDateFrom} onSelect={setCustomDateFrom} disabled={(date) => date > new Date()} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground text-sm">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-[160px] justify-start text-left font-normal", !customDateTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customDateTo ? format(customDateTo, 'dd/MM/yyyy') : 'Data fim'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customDateTo} onSelect={setCustomDateTo} disabled={(date) => date > new Date() || (customDateFrom ? date < customDateFrom : false)} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mr-2" />
            <span className="text-sm text-muted-foreground">Carregando estatísticas...</span>
          </div>
        )}

        <Tabs defaultValue="geral">
          <TabsList>
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="pessoal">Pessoal</TabsTrigger>
          </TabsList>

          {/* ===== ABA GERAL ===== */}
          <TabsContent value="geral" className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {[
                { icon: Users, label: 'Vendedores Ativos', value: globalStats.activeSellers },
                { icon: Phone, label: 'Total Leads', value: globalStats.totalLeads },
                { icon: Clock, label: 'Pendentes', value: globalStats.totalPending },
                { icon: TrendingUp, label: 'Contatados', value: globalStats.totalContacted },
                { icon: CheckCircle, label: 'Aprovados', value: globalStats.totalApproved },
                { icon: MessageSquare, label: 'Msgs Enviadas', value: globalStats.totalSent },
                { icon: MessageSquare, label: 'Msgs Recebidas', value: globalStats.totalReceived },
              ].map((kpi, index) => (
                <motion.div
                  key={kpi.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <KPICard icon={kpi.icon} label={kpi.label} value={kpi.value} />
                </motion.div>
              ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Leads por Vendedor</CardTitle>
                    <CardDescription>Pendentes vs Contatados vs Aprovados</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={leadsPerSellerChart}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                          <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }} />
                          <Legend />
                          <Bar dataKey="Pendentes" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Contatados" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Aprovados" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Distribuição de Status</CardTitle>
                    <CardDescription>Todos os leads do período</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                            {pieChartData.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Ranking Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Ranking de Vendedores</CardTitle>
                    <CardDescription>Ordenado por taxa de aprovação</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={exportCSV}>
                    <Download className="w-4 h-4 mr-1.5" />
                    Exportar CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="py-2 pr-4">#</th>
                        <th className="py-2 pr-4">Vendedor</th>
                        <th className="py-2 pr-4">Leads</th>
                        <th className="py-2 pr-4">Contatados</th>
                        <th className="py-2 pr-4">Aprovados</th>
                        <th className="py-2 pr-4">Taxa Aprov.</th>
                        <th className="py-2 pr-4">Tempo Méd. Resp.</th>
                        <th className="py-2 pr-4">Msgs Env.</th>
                        <th className="py-2">Msgs Rec.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...sellerStats].sort((a, b) => b.approvalRate - a.approvalRate).map((s, i) => (
                        <tr key={s.userId} className="border-b border-border/50">
                          <td className="py-2 pr-4 font-medium">{i + 1}</td>
                          <td className="py-2 pr-4 font-medium">{s.name}</td>
                          <td className="py-2 pr-4">{s.totalLeads}</td>
                          <td className="py-2 pr-4">{s.contacted}</td>
                          <td className="py-2 pr-4">
                            <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">{s.approved}</Badge>
                          </td>
                          <td className="py-2 pr-4">
                            <Badge variant={s.approvalRate > 20 ? 'default' : 'secondary'}>
                              {s.approvalRate.toFixed(1)}%
                            </Badge>
                          </td>
                          <td className="py-2 pr-4">
                            {s.avgResponseTime > 0 ? (
                              <span className={cn("text-xs font-medium", s.avgResponseTime < 2 ? "text-green-400" : s.avgResponseTime < 8 ? "text-amber-400" : "text-red-400")}>
                                {s.avgResponseTime < 1 ? `${Math.round(s.avgResponseTime * 60)}min` : `${s.avgResponseTime.toFixed(1)}h`}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-2 pr-4">{s.messagesSent}</td>
                          <td className="py-2">{s.messagesReceived}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== ABA PESSOAL ===== */}
          <TabsContent value="pessoal" className="space-y-6">
            {sellerStats.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhum vendedor com dados encontrado.
                </CardContent>
              </Card>
            )}
            {sellerStats.map(seller => {
              const contactProgress = seller.totalLeads > 0 ? (seller.contacted / seller.totalLeads * 100) : 0;

              return (
                <Card key={seller.userId}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
                        {seller.name.charAt(0).toUpperCase()}
                      </div>
                      {seller.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold">{seller.totalLeads}</p>
                        <p className="text-xs text-muted-foreground">Total Leads</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold">{seller.pending}</p>
                        <p className="text-xs text-muted-foreground">Pendentes</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold text-green-400">{seller.approvalRate.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">Taxa Aprovação</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold">{seller.messagesSent}</p>
                        <p className="text-xs text-muted-foreground">Msgs Enviadas</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold">{seller.messagesReceived}</p>
                        <p className="text-xs text-muted-foreground">Msgs Recebidas</p>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Leads contatados</span>
                        <span>{seller.contacted}/{seller.totalLeads}</span>
                      </div>
                      <Progress value={contactProgress} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function KPICard({ icon: Icon, label, value }: { icon: any; label: string; value: number | string }) {
  return (
    <Card className="overflow-hidden group hover:border-primary/30 transition-colors duration-200">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors duration-200">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <motion.p
            className="text-2xl font-bold"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            key={String(value)}
          >
            {value}
          </motion.p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
