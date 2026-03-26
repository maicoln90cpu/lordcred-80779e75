import { useState, useEffect, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
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
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { Users, TrendingUp, Clock, MessageSquare, CheckCircle, XCircle, Phone, Download, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SellerProfile {
  user_id: string;
  email: string;
  name: string | null;
}

interface LeadData {
  id: string;
  assigned_to: string;
  status: string | null;
  contacted_at: string | null;
  created_at: string;
}

interface MessageData {
  chip_id: string;
  direction: string;
  created_at: string;
}

interface ChipData {
  id: string;
  user_id: string;
  chip_type: string;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
const PERIOD_OPTIONS = [
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

// Fetch all rows without the 1000 limit
async function fetchAllMessages(cutoff?: string) {
  const allData: MessageData[] = [];
  let from = 0;
  const batchSize = 1000;
  while (true) {
    let query = supabase
      .from('message_history')
      .select('chip_id, direction, created_at')
      .order('created_at', { ascending: false })
      .range(from, from + batchSize - 1);
    if (cutoff) query = query.gte('created_at', cutoff);
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData.push(...data);
    if (data.length < batchSize) break;
    from += batchSize;
  }
  return allData;
}

async function fetchAllLeads() {
  const allData: LeadData[] = [];
  let from = 0;
  const batchSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('client_leads')
      .select('id, assigned_to, status, contacted_at, created_at')
      .range(from, from + batchSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData.push(...data);
    if (data.length < batchSize) break;
    from += batchSize;
  }
  return allData;
}

export default function Performance() {
  const { user } = useAuth();
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [chips, setChips] = useState<ChipData[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodDays, setPeriodDays] = useState(30);
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>();
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [sellersRes, chipsRes] = await Promise.all([
      supabase.from('profiles').select('user_id, email, name'),
      supabase.from('chips').select('id, user_id, chip_type'),
    ]);
    const [leadsData, messagesData] = await Promise.all([
      fetchAllLeads(),
      fetchAllMessages(),
    ]);
    if (sellersRes.data) setSellers(sellersRes.data);
    setLeads(leadsData);
    setMessages(messagesData);
    if (chipsRes.data) setChips(chipsRes.data);
    setLoading(false);
  };

  // Filter data by period
  const cutoffDate = useMemo(() => {
    if (periodDays === -1) {
      return customDateFrom ? customDateFrom.toISOString() : null;
    }
    if (periodDays === 0) return null;
    const now = new Date();
    if (periodDays === -2) {
      // Hoje
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return d.toISOString();
    }
    if (periodDays === -3) {
      // Ontem
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      return d.toISOString();
    }
    if (periodDays === -4) {
      // Essa Semana (domingo até hoje)
      const day = now.getDay(); // 0=domingo
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
      return d.toISOString();
    }
    if (periodDays === -5) {
      // Semana Passada (domingo a sábado anterior)
      const day = now.getDay();
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day - 7);
      return d.toISOString();
    }
    const d = new Date();
    d.setDate(d.getDate() - periodDays);
    return d.toISOString();
  }, [periodDays, customDateFrom]);

  const cutoffDateTo = useMemo(() => {
    if (periodDays === -1 && customDateTo) {
      const d = new Date(customDateTo);
      d.setHours(23, 59, 59, 999);
      return d.toISOString();
    }
    return null;
  }, [periodDays, customDateTo]);

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (cutoffDate) result = result.filter(l => l.created_at >= cutoffDate);
    if (cutoffDateTo) result = result.filter(l => l.created_at <= cutoffDateTo);
    return result;
  }, [leads, cutoffDate, cutoffDateTo]);

  const filteredMessages = useMemo(() => {
    let result = messages;
    if (cutoffDate) result = result.filter(m => m.created_at >= cutoffDate);
    if (cutoffDateTo) result = result.filter(m => m.created_at <= cutoffDateTo);
    return result;
  }, [messages, cutoffDate, cutoffDateTo]);

  // Exclude warming chips from performance metrics
  const nonWarmingChips = useMemo(() => chips.filter(c => c.chip_type !== 'warming'), [chips]);

  const chipsByUser = useMemo(() => {
    const map: Record<string, string[]> = {};
    nonWarmingChips.forEach(c => {
      if (!map[c.user_id]) map[c.user_id] = [];
      map[c.user_id].push(c.id);
    });
    return map;
  }, [nonWarmingChips]);

  const getSellerName = (s: SellerProfile) => s.name || s.email?.split('@')[0] || 'Sem nome';

  const sellerStats = useMemo(() => {
    return sellers.map(seller => {
      const sellerLeads = filteredLeads.filter(l => l.assigned_to === seller.user_id);
      const contacted = sellerLeads.filter(l => l.contacted_at);
      const approved = sellerLeads.filter(l => l.status?.toUpperCase() === 'APROVADO');
      const rejected = sellerLeads.filter(l => l.status?.toUpperCase()?.includes('REPROVADO') || l.status?.toUpperCase()?.includes('NÃO EXISTE'));
      const pending = sellerLeads.filter(l => !l.status || l.status === 'pendente');

      const sellerChipIds = chipsByUser[seller.user_id] || [];
      const sellerMessages = filteredMessages.filter(m => sellerChipIds.includes(m.chip_id));
      const sent = sellerMessages.filter(m => m.direction === 'outgoing').length;
      const received = sellerMessages.filter(m => m.direction === 'incoming').length;

      const responseTimes = contacted.map(l => {
        const created = new Date(l.created_at).getTime();
        const contact = new Date(l.contacted_at!).getTime();
        return (contact - created) / (1000 * 60 * 60);
      }).filter(t => t > 0 && t < 720);
      const avgResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

      return {
        userId: seller.user_id,
        name: getSellerName(seller),
        email: seller.email,
        totalLeads: sellerLeads.length,
        contacted: contacted.length,
        approved: approved.length,
        rejected: rejected.length,
        pending: pending.length,
        approvalRate: sellerLeads.length > 0 ? (approved.length / sellerLeads.length * 100) : 0,
        contactRate: sellerLeads.length > 0 ? (contacted.length / sellerLeads.length * 100) : 0,
        avgResponseTime,
        messagesSent: sent,
        messagesReceived: received,
      };
    }).filter(s => s.totalLeads > 0 || s.messagesSent > 0);
  }, [sellers, filteredLeads, filteredMessages, chipsByUser]);

  const globalStats = useMemo(() => {
    const totalLeads = filteredLeads.length;
    const totalContacted = filteredLeads.filter(l => l.contacted_at).length;
    const totalApproved = filteredLeads.filter(l => l.status?.toUpperCase() === 'APROVADO').length;
    const totalPending = filteredLeads.filter(l => !l.status || l.status === 'pendente').length;
    // Only count messages from non-warming chips
    const nonWarmingChipIds = new Set(nonWarmingChips.map(c => c.id));
    const relevantMessages = filteredMessages.filter(m => nonWarmingChipIds.has(m.chip_id));
    const totalSent = relevantMessages.filter(m => m.direction === 'outgoing').length;
    const totalReceived = relevantMessages.filter(m => m.direction === 'incoming').length;
    return { totalLeads, totalContacted, totalApproved, totalPending, totalSent, totalReceived, activeSellers: sellerStats.length };
  }, [filteredLeads, filteredMessages, sellerStats, nonWarmingChips]);

  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredLeads.forEach(l => {
      const s = l.status || 'pendente';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredLeads]);

  const leadsPerSellerChart = useMemo(() => {
    return sellerStats.map(s => ({
      name: s.name.length > 12 ? s.name.substring(0, 12) + '…' : s.name,
      Pendentes: s.pending,
      Contatados: s.contacted,
      Aprovados: s.approved,
    }));
  }, [sellerStats]);

  const getSellerEvolution = (userId: string) => {
    const days_count = periodDays > 0 ? periodDays : 30;
    const sellerLeads = filteredLeads.filter(l => l.assigned_to === userId && l.contacted_at);
    const days: Record<string, number> = {};
    const now = Date.now();
    for (let i = days_count - 1; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      days[d.toISOString().slice(0, 10)] = 0;
    }
    sellerLeads.forEach(l => {
      const day = new Date(l.contacted_at!).toISOString().slice(0, 10);
      if (days[day] !== undefined) days[day]++;
    });
    return Object.entries(days).map(([date, count]) => ({
      date: date.slice(5),
      contatados: count,
    }));
  };

  const getSellerStatusPie = (userId: string) => {
    const sellerLeads = filteredLeads.filter(l => l.assigned_to === userId);
    const counts: Record<string, number> = {};
    sellerLeads.forEach(l => {
      const s = l.status || 'pendente';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  };

  // CSV Export
  const exportCSV = useCallback(() => {
    const sorted = [...sellerStats].sort((a, b) => b.approvalRate - a.approvalRate);
    const headers = ['#', 'Vendedor', 'Email', 'Leads', 'Contatados', 'Aprovados', 'Taxa Aprov.(%)', 'Tempo Médio(h)', 'Msgs Env.', 'Msgs Rec.'];
    const rows = sorted.map((s, i) => [
      i + 1, s.name, s.email, s.totalLeads, s.contacted, s.approved,
      s.approvalRate.toFixed(1), s.avgResponseTime > 0 ? s.avgResponseTime.toFixed(1) : '0',
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

  if (loading) {
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
                <Calendar
                  mode="single"
                  selected={customDateFrom}
                  onSelect={setCustomDateFrom}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
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
                <Calendar
                  mode="single"
                  selected={customDateTo}
                  onSelect={setCustomDateTo}
                  disabled={(date) => date > new Date() || (customDateFrom ? date < customDateFrom : false)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
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
              <KPICard icon={Users} label="Vendedores Ativos" value={globalStats.activeSellers} />
              <KPICard icon={Phone} label="Total Leads" value={globalStats.totalLeads} />
              <KPICard icon={Clock} label="Pendentes" value={globalStats.totalPending} />
              <KPICard icon={TrendingUp} label="Contatados" value={globalStats.totalContacted} />
              <KPICard icon={CheckCircle} label="Aprovados" value={globalStats.totalApproved} />
              <KPICard icon={MessageSquare} label="Msgs Enviadas" value={globalStats.totalSent} />
              <KPICard icon={MessageSquare} label="Msgs Recebidas" value={globalStats.totalReceived} />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Distribuição de Status</CardTitle>
                  <CardDescription>Todos os leads do período</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                          {statusDistribution.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
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
                        <th className="py-2 pr-4">Tempo Médio</th>
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
                          <td className="py-2 pr-4">{s.avgResponseTime > 0 ? `${s.avgResponseTime.toFixed(1)}h` : '—'}</td>
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
              const evolution = getSellerEvolution(seller.userId);
              const statusPie = getSellerStatusPie(seller.userId);
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
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
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
                        <p className="text-2xl font-bold">{seller.avgResponseTime > 0 ? `${seller.avgResponseTime.toFixed(1)}h` : '—'}</p>
                        <p className="text-xs text-muted-foreground">Tempo Médio Resp.</p>
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

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm font-medium mb-2 text-muted-foreground">Leads Contatados (últimos {periodDays > 0 ? periodDays : 30} dias)</p>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={evolution}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }} />
                              <Line type="monotone" dataKey="contatados" stroke="#3b82f6" strokeWidth={2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium mb-2 text-muted-foreground">Distribuição de Status</p>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={statusPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                                {statusPie.map((_, i) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
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
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
