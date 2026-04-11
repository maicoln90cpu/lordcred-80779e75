import { useEffect, useState, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Building2, DollarSign, FileText, Target, Clock, BarChart3, Loader2, PieChart as PieChartIcon, RefreshCw, Calendar as CalendarIcon } from 'lucide-react';
import { SellerPdfExport } from '@/components/corban/SellerPdfExport';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 160 60% 45%))',
  'hsl(var(--chart-3, 30 80% 55%))',
  'hsl(var(--chart-4, 280 65% 60%))',
  'hsl(var(--chart-5, 340 75% 55%))',
  'hsl(200, 70%, 50%)',
  'hsl(120, 50%, 45%)',
  'hsl(50, 80%, 50%)',
];

interface SnapshotRow {
  status: string | null;
  banco: string | null;
  valor_liberado: number | null;
  prazo: string | null;
  snapshot_date: string;
  data_cadastro: string | null;
  nome: string | null;
  cpf: string | null;
}

export default function SellerDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sellerName, setSellerName] = useState<string | null>(null);
  const [allSnapshots, setAllSnapshots] = useState<SnapshotRow[]>([]);
  const [statusLabels, setStatusLabels] = useState<Record<string, string>>({});
  const [dateFrom, setDateFrom] = useState<Date>(() => subDays(new Date(), 30));
  const [dateTo, setDateTo] = useState<Date>(new Date());

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: mapping } = await supabase
        .from('corban_seller_mapping')
        .select('corban_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!mapping) {
        setLoading(false);
        return;
      }

      setSellerName(mapping.corban_name);

      const [{ data: snaps }, { data: statusData }] = await Promise.all([
        supabase
          .from('corban_propostas_snapshot')
          .select('status, banco, valor_liberado, prazo, snapshot_date, data_cadastro, nome, cpf')
          .eq('vendedor_nome', mapping.corban_name)
          .order('data_cadastro', { ascending: false }),
        supabase
          .from('corban_assets_cache')
          .select('asset_id, asset_label')
          .eq('asset_type', 'status'),
      ]);

      setAllSnapshots((snaps || []) as SnapshotRow[]);
      if (statusData) {
        const map: Record<string, string> = {};
        statusData.forEach(s => { map[s.asset_id] = s.asset_label; });
        setStatusLabels(map);
      }
      setLoading(false);
    })();
  }, [user]);

  const resolveStatus = (key: string) => statusLabels[key] || key;

  // Filter snapshots by data_cadastro date range
  const snapshots = useMemo(() => {
    const fromStr = format(dateFrom, 'yyyy-MM-dd');
    const toStr = format(dateTo, 'yyyy-MM-dd') + ' 23:59:59';
    return allSnapshots.filter(s => {
      const dc = s.data_cadastro || '';
      return dc >= fromStr && dc <= toStr;
    });
  }, [allSnapshots, dateFrom, dateTo]);

  const analytics = useMemo(() => {
    if (snapshots.length === 0) return null;

    const statusCounts: Record<string, number> = {};
    const bancoCounts: Record<string, number> = {};
    let totalValor = 0, prazoSum = 0, prazoCount = 0;

    snapshots.forEach(s => {
      const st = s.status || 'desconhecido';
      statusCounts[st] = (statusCounts[st] || 0) + 1;
      if (s.banco) bancoCounts[s.banco] = (bancoCounts[s.banco] || 0) + 1;
      totalValor += s.valor_liberado || 0;
      const p = parseFloat(s.prazo || '');
      if (!isNaN(p)) { prazoSum += p; prazoCount++; }
    });

    const statusData = Object.entries(statusCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, value]) => ({ name: resolveStatus(name), value }));

    const bancoData = Object.entries(bancoCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));

    const approvedCount = snapshots.filter(s => {
      const label = resolveStatus(s.status || '').toLowerCase();
      return label.includes('pago') || label.includes('aprovad') || label.includes('liberado') || label.includes('integrado');
    }).length;

    return {
      total: snapshots.length,
      totalValor,
      ticketMedio: snapshots.length > 0 ? totalValor / snapshots.length : 0,
      prazoMedio: prazoCount > 0 ? prazoSum / prazoCount : 0,
      taxaAprovacao: snapshots.length > 0 ? (approvedCount / snapshots.length) * 100 : 0,
      statusData,
      bancoData,
    };
  }, [snapshots, statusLabels]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!sellerName) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Meu Dashboard Corban
          </h1>
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">Seu perfil ainda não está vinculado a um vendedor da Corban.</p>
              <p className="text-xs mt-1">Solicite a um administrador que faça o mapeamento na aba <strong>Vendedores</strong> do Dashboard Corban.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="w-6 h-6 text-primary" />
              Meu Dashboard Corban
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Vendedor: <strong>{sellerName}</strong>{analytics ? ` — ${analytics.total} propostas` : ''}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1">
              {[7, 30, 60, 90].map(days => (
                <Button key={days} variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => { setDateFrom(subDays(new Date(), days)); setDateTo(new Date()); }}>
                  {days}d
                </Button>
              ))}
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs h-7 gap-1">
                  <CalendarIcon className="w-3 h-3" />
                  {format(dateFrom, 'dd/MM')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={d => d && setDateFrom(d)} disabled={d => d > new Date()} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs h-7 gap-1">
                  <CalendarIcon className="w-3 h-3" />
                  {format(dateTo, 'dd/MM')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={d => d && setDateTo(d)} disabled={d => d > new Date()} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {analytics ? (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10"><FileText className="w-5 h-5 text-primary" /></div>
                  <div>
                    <p className="text-2xl font-bold">{analytics.total}</p>
                    <p className="text-xs text-muted-foreground">Total Propostas</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10"><DollarSign className="w-5 h-5 text-primary" /></div>
                  <div>
                    <p className="text-lg font-bold">{fmtBRL(analytics.totalValor)}</p>
                    <p className="text-xs text-muted-foreground">Valor Total</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10"><Target className="w-5 h-5 text-primary" /></div>
                  <div>
                    <p className="text-xl font-bold">{analytics.taxaAprovacao.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">Taxa Aprovação</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10"><Clock className="w-5 h-5 text-primary" /></div>
                  <div>
                    <p className="text-xl font-bold">{analytics.prazoMedio.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">Prazo Médio</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Por Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={analytics.statusData} layout="vertical" margin={{ left: 100, right: 20 }}>
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={95} />
                      <Tooltip formatter={(val: number) => [val, 'Propostas']} />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><PieChartIcon className="w-4 h-4" /> Por Banco</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={analytics.bancoData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                        {analytics.bancoData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: number) => [val, 'Propostas']} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Ticket médio card */}
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><DollarSign className="w-5 h-5 text-primary" /></div>
                <div>
                  <p className="text-lg font-bold">{fmtBRL(analytics.ticketMedio)}</p>
                  <p className="text-xs text-muted-foreground">Ticket Médio</p>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhuma proposta encontrada no período selecionado.</p>
              <p className="text-xs mt-1">Tente selecionar um período maior usando os botões acima.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}