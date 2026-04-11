import { useEffect, useState, useMemo } from 'react';
import { Clock, RefreshCw, DollarSign, Users, BarChart3, PieChart as PieChartIcon, Target, Calendar as CalendarIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface SnapshotRow {
  status: string | null;
  banco: string | null;
  valor_liberado: number | null;
  prazo: string | null;
  vendedor_nome: string | null;
  snapshot_date: string;
}

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

export function CorbanAnalyticsTab() {
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [snapDateFrom, setSnapDateFrom] = useState<Date>(() => subDays(new Date(), 180));
  const [snapDateTo, setSnapDateTo] = useState<Date>(new Date());
  const [cachedStatusLabels, setCachedStatusLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('corban_assets_cache').select('asset_id, asset_label').eq('asset_type', 'status');
      if (data) {
        const map: Record<string, string> = {};
        data.forEach(s => { map[s.asset_id] = s.asset_label; });
        setCachedStatusLabels(map);
      }
    })();
  }, []);

  useEffect(() => { loadSnapshots(); }, [snapDateFrom, snapDateTo]);

  const loadSnapshots = async () => {
    setLoadingSnapshots(true);
    const fromStr = format(snapDateFrom, 'yyyy-MM-dd');
    const toStr = format(snapDateTo, 'yyyy-MM-dd') + ' 23:59:59';
    const PAGE = 1000;
    let all: SnapshotRow[] = [];
    let offset = 0;
    let done = false;
    while (!done) {
      const { data, error } = await supabase
        .from('corban_propostas_snapshot')
        .select('status, banco, valor_liberado, prazo, vendedor_nome, snapshot_date, data_cadastro')
        .gte('data_cadastro', fromStr)
        .lte('data_cadastro', toStr)
        .order('data_cadastro', { ascending: false })
        .range(offset, offset + PAGE - 1);
      if (error) { console.error('Error loading snapshots:', error); break; }
      all = all.concat((data || []) as SnapshotRow[]);
      done = !data || data.length < PAGE;
      offset += PAGE;
    }
    setLoadingSnapshots(false);
    setSnapshots(all);
  };

  const resolveStatusLabel = (key: string) => cachedStatusLabels[key] || key;

  const analytics = useMemo(() => {
    if (snapshots.length === 0) return null;
    const statusCounts: Record<string, number> = {};
    const bancoCounts: Record<string, number> = {};
    const vendedorValues: Record<string, number> = {};
    let totalValor = 0, prazoSum = 0, prazoCount = 0;

    snapshots.forEach(s => {
      const st = s.status || 'desconhecido';
      statusCounts[st] = (statusCounts[st] || 0) + 1;
      if (s.banco) bancoCounts[s.banco] = (bancoCounts[s.banco] || 0) + 1;
      if (s.vendedor_nome && s.valor_liberado) {
        vendedorValues[s.vendedor_nome] = (vendedorValues[s.vendedor_nome] || 0) + (s.valor_liberado || 0);
      }
      totalValor += s.valor_liberado || 0;
      const prazoNum = parseFloat(s.prazo || '');
      if (!isNaN(prazoNum)) { prazoSum += prazoNum; prazoCount++; }
    });

    const statusData = Object.entries(statusCounts).sort(([, a], [, b]) => b - a).slice(0, 10).map(([name, value]) => ({ name: resolveStatusLabel(name), value }));
    const bancoData = Object.entries(bancoCounts).sort(([, a], [, b]) => b - a).slice(0, 8).map(([name, value]) => ({ name, value }));
    const vendedorData = Object.entries(vendedorValues).sort(([, a], [, b]) => b - a).slice(0, 10).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
    const ticketMedio = snapshots.length > 0 ? totalValor / snapshots.length : 0;
    const prazoMedio = prazoCount > 0 ? prazoSum / prazoCount : 0;
    const approvedCount = snapshots.filter(s => {
      const label = resolveStatusLabel(s.status || '').toLowerCase();
      return label.includes('pago') || label.includes('aprovad') || label.includes('liberado') || label.includes('integrado');
    }).length;
    const taxaAprovacao = snapshots.length > 0 ? (approvedCount / snapshots.length) * 100 : 0;

    return { statusData, bancoData, vendedorData, ticketMedio, prazoMedio, taxaAprovacao, total: snapshots.length };
  }, [snapshots, cachedStatusLabels]);

  return (
    <div className="space-y-6">
      {/* Date filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Analytics (Snapshots{analytics ? ` — ${analytics.total} registros` : ''})
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1">
            {[7, 30, 60, 90, 180].map(days => (
              <Button key={days} variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => { setSnapDateFrom(subDays(new Date(), days)); setSnapDateTo(new Date()); }}>
                {days}d
              </Button>
            ))}
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1">
                <CalendarIcon className="w-3 h-3" />
                {format(snapDateFrom, 'dd/MM')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={snapDateFrom} onSelect={d => d && setSnapDateFrom(d)} disabled={d => d > new Date()} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">até</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1">
                <CalendarIcon className="w-3 h-3" />
                {format(snapDateTo, 'dd/MM')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={snapDateTo} onSelect={d => d && setSnapDateTo(d)} disabled={d => d > new Date()} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="sm" className="h-7" onClick={loadSnapshots} disabled={loadingSnapshots}>
            <RefreshCw className={`w-3.5 h-3.5 ${loadingSnapshots ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {analytics ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Target className="w-5 h-5 text-primary" /></div>
                <div>
                  <p className="text-xl font-bold">{analytics.taxaAprovacao.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">Taxa de Aprovação</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><DollarSign className="w-5 h-5 text-primary" /></div>
                <div>
                  <p className="text-lg font-bold">{fmtBRL(analytics.ticketMedio)}</p>
                  <p className="text-xs text-muted-foreground">Ticket Médio</p>
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
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Distribuição por Status</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
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
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><PieChartIcon className="w-4 h-4" /> Distribuição por Banco</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={analytics.bancoData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
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

          {/* Seller ranking */}
          {analytics.vendedorData.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" /> Ranking de Vendedores (Valor Liberado)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(200, analytics.vendedorData.length * 35)}>
                  <BarChart data={analytics.vendedorData} layout="vertical" margin={{ left: 120, right: 20 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={115} />
                    <Tooltip formatter={(val: number) => [fmtBRL(val), 'Valor Liberado']} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Status table */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Top Status — Valores Agregados</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Quantidade</TableHead>
                    <TableHead className="text-xs text-right">% Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.statusData.map((s) => (
                    <TableRow key={s.name}>
                      <TableCell className="text-xs">{s.name}</TableCell>
                      <TableCell className="text-xs text-right font-medium">{s.value}</TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground">{((s.value / analytics.total) * 100).toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum snapshot para o período selecionado.</p>
            <p className="text-xs mt-1">Snapshots são salvos automaticamente todos os dias, ou vá em <strong>Propostas</strong> e clique em <strong>"Salvar Snapshot"</strong>.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
