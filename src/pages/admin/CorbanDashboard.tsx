import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Building2, ClipboardList, Landmark, TrendingUp, Clock, CheckCircle, AlertTriangle, Wifi, RefreshCw, DollarSign, FileText, Users, Activity, BarChart3, PieChart as PieChartIcon, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useNavigate } from 'react-router-dom';
import { invokeCorban } from '@/lib/invokeCorban';
import { normalizeCorbanPropostasInput, type NormalizedCorbanProposta } from '@/lib/corbanPropostas';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface DashboardStats {
  totalPropostas: number;
  valorTotal: number;
  porStatus: Record<string, number>;
  porBanco: Record<string, number>;
  ultimaAtualizacao: Date | null;
}

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

export default function CorbanDashboard() {
  const navigate = useNavigate();
  const [testing, setTesting] = useState(false);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  const [assetCount, setAssetCount] = useState(0);
  const [loadingStats, setLoadingStats] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [cachedStatusLabels, setCachedStatusLabels] = useState<Record<string, string>>({});
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ count }, { data: statusData }] = await Promise.all([
        supabase.from('corban_assets_cache').select('id', { count: 'exact', head: true }),
        supabase.from('corban_assets_cache').select('asset_id, asset_label').eq('asset_type', 'status'),
      ]);
      setAssetCount(count || 0);
      if (statusData) {
        const map: Record<string, string> = {};
        statusData.forEach(s => { map[s.asset_id] = s.asset_label; });
        setCachedStatusLabels(map);
      }
    })();
  }, []);

  // Load snapshots on mount
  useEffect(() => {
    loadSnapshots();
  }, []);

  // Auto-test connection on mount
  useEffect(() => {
    handleTestConnection();
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    const { data, error } = await invokeCorban('testConnection');
    setTesting(false);
    setConnectionOk(!error);
  };

  const loadSnapshots = async () => {
    setLoadingSnapshots(true);
    const since = subDays(new Date(), 30).toISOString();
    const { data, error } = await supabase
      .from('corban_propostas_snapshot' as any)
      .select('status, banco, valor_liberado, prazo, vendedor_nome, snapshot_date')
      .gte('snapshot_date', since)
      .order('snapshot_date', { ascending: false });
    setLoadingSnapshots(false);
    if (error) { console.error('Error loading snapshots:', error); return; }
    setSnapshots((data || []) as SnapshotRow[]);
  };

  const loadRecentStats = useCallback(async () => {
    setLoadingStats(true);
    const dateFrom = format(subDays(new Date(), 7), 'yyyy-MM-dd');
    const dateTo = format(new Date(), 'yyyy-MM-dd');

    const { data, error } = await invokeCorban('getPropostas', {
      exactPayload: true,
      filters: { status: [], data: { tipo: 'cadastro', startDate: dateFrom, endDate: dateTo } },
    });

    setLoadingStats(false);
    if (error) { toast.error('Erro ao carregar estatísticas', { description: error }); return; }

    const propostas = normalizeCorbanPropostasInput(data);
    const porStatus: Record<string, number> = {};
    const porBanco: Record<string, number> = {};
    let valorTotal = 0;

    propostas.forEach(p => {
      const statusKey = p.status || 'desconhecido';
      porStatus[statusKey] = (porStatus[statusKey] || 0) + 1;
      if (p.banco) porBanco[p.banco] = (porBanco[p.banco] || 0) + 1;
      valorTotal += p.valor_liberado || 0;
    });

    setStats({ totalPropostas: propostas.length, valorTotal, porStatus, porBanco, ultimaAtualizacao: new Date() });
    toast.success(`${propostas.length} propostas carregadas (últimos 7 dias)`);
  }, []);

  const resolveStatusLabel = (key: string) => cachedStatusLabels[key] || key;

  const topStatuses = stats ? Object.entries(stats.porStatus).sort(([, a], [, b]) => b - a).slice(0, 6) : [];
  const topBancos = stats ? Object.entries(stats.porBanco).sort(([, a], [, b]) => b - a).slice(0, 5) : [];

  // Analytics from snapshots
  const analytics = useMemo(() => {
    if (snapshots.length === 0) return null;

    // Status distribution
    const statusCounts: Record<string, number> = {};
    const bancoCounts: Record<string, number> = {};
    const vendedorValues: Record<string, number> = {};
    let totalValor = 0;
    let prazoSum = 0;
    let prazoCount = 0;

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

    const statusData = Object.entries(statusCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, value]) => ({ name: resolveStatusLabel(name), value }));

    const bancoData = Object.entries(bancoCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));

    const vendedorData = Object.entries(vendedorValues)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));

    const ticketMedio = snapshots.length > 0 ? totalValor / snapshots.length : 0;
    const prazoMedio = prazoCount > 0 ? prazoSum / prazoCount : 0;

    // Rough approval rate: count statuses that look like "aprovado" or "pago"
    const approvedCount = snapshots.filter(s => {
      const label = resolveStatusLabel(s.status || '').toLowerCase();
      return label.includes('pago') || label.includes('aprovad') || label.includes('liberado') || label.includes('integrado');
    }).length;
    const taxaAprovacao = snapshots.length > 0 ? (approvedCount / snapshots.length) * 100 : 0;

    return { statusData, bancoData, vendedorData, ticketMedio, prazoMedio, taxaAprovacao, total: snapshots.length };
  }, [snapshots, cachedStatusLabels]);

  const navCards = [
    { icon: ClipboardList, title: 'Propostas', description: 'Consultar propostas por CPF, status, banco e período', href: '/admin/corban/propostas' },
    { icon: Landmark, title: 'Fila FGTS', description: 'Consultar e incluir CPFs na fila FGTS', href: '/admin/corban/fgts' },
    { icon: TrendingUp, title: 'Assets Sincronizados', description: `${assetCount} itens em cache`, href: '/admin/corban/assets' },
    { icon: Clock, title: 'Configuração', description: 'Visibilidade de features por role', href: '/admin/corban/config' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="w-6 h-6 text-primary" />
              Dashboard Corban
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Integração com a plataforma NewCorban</p>
          </div>
          <div className="flex items-center gap-3">
            {connectionOk !== null && (
              <Badge variant={connectionOk ? 'default' : 'destructive'} className="gap-1">
                {connectionOk ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                {connectionOk ? 'Conectado' : 'Falha'}
              </Badge>
            )}
            <Button onClick={handleTestConnection} disabled={testing} variant="outline" size="sm">
              <Wifi className="w-4 h-4 mr-2" />
              {testing ? 'Testando...' : 'Testar Conexão'}
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><FileText className="w-5 h-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalPropostas ?? '—'}</p>
                <p className="text-xs text-muted-foreground">Propostas (7 dias)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><DollarSign className="w-5 h-5 text-primary" /></div>
              <div>
                <p className="text-lg font-bold">{stats ? fmtBRL(stats.valorTotal) : '—'}</p>
                <p className="text-xs text-muted-foreground">Valor Total (7 dias)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Users className="w-5 h-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{stats ? Object.keys(stats.porBanco).length : '—'}</p>
                <p className="text-xs text-muted-foreground">Bancos Ativos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Activity className="w-5 h-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{stats ? Object.keys(stats.porStatus).length : '—'}</p>
                <p className="text-xs text-muted-foreground">Status Distintos</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Load stats button */}
        {!stats && (
          <div className="flex justify-center">
            <Button onClick={loadRecentStats} disabled={loadingStats} variant="outline" className="gap-2">
              <RefreshCw className={`w-4 h-4 ${loadingStats ? 'animate-spin' : ''}`} />
              {loadingStats ? 'Carregando propostas...' : 'Carregar Métricas (últimos 7 dias)'}
            </Button>
          </div>
        )}

        {/* Stats breakdown */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Propostas por Status</CardTitle>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadRecentStats} disabled={loadingStats}>
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {topStatuses.map(([status, count]) => {
                  const pct = stats.totalPropostas > 0 ? Math.round((count / stats.totalPropostas) * 100) : 0;
                  return (
                    <div key={status} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-32 truncate" title={resolveStatusLabel(status)}>{resolveStatusLabel(status)}</span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-medium w-12 text-right">{count} ({pct}%)</span>
                    </div>
                  );
                })}
                {stats.ultimaAtualizacao && (
                  <p className="text-[10px] text-muted-foreground/60 mt-2">Atualizado: {format(stats.ultimaAtualizacao, 'dd/MM HH:mm')}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Top Bancos</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {topBancos.map(([banco, count], i) => (
                  <div key={banco} className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground w-5">{i + 1}.</span>
                    <span className="text-xs flex-1 truncate">{banco}</span>
                    <Badge variant="secondary" className="text-[10px]">{count}</Badge>
                  </div>
                ))}
                {topBancos.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Carregue as métricas primeiro</p>}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===== ANALYTICS FROM SNAPSHOTS ===== */}
        {analytics && analytics.total > 0 && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Analytics (Snapshots — {analytics.total} registros)
              </h2>
              <Button variant="ghost" size="sm" onClick={loadSnapshots} disabled={loadingSnapshots}>
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingSnapshots ? 'animate-spin' : ''}`} /> Atualizar
              </Button>
            </div>

            {/* KPI advanced cards */}
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

            {/* Charts row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Status distribution bar chart */}
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

              {/* Banco distribution pie chart */}
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

            {/* Vendedor ranking */}
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

            {/* Top Status table */}
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
        )}

        {snapshots.length === 0 && !loadingSnapshots && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum snapshot salvo ainda.</p>
              <p className="text-xs mt-1">Vá em <strong>Propostas</strong> e clique em <strong>"Salvar Snapshot"</strong> para gerar dados históricos.</p>
            </CardContent>
          </Card>
        )}

        {/* Navigation cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {navCards.map((card, i) => (
            <motion.div key={card.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.08 }}>
              <Card className="cursor-pointer hover:border-primary/50 transition-colors group" onClick={() => navigate(card.href)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <card.icon className="w-4 h-4 group-hover:text-primary transition-colors" />
                    {card.title}
                  </CardTitle>
                </CardHeader>
                <CardContent><p className="text-xs text-muted-foreground">{card.description}</p></CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Integration summary */}
        <Card>
          <CardHeader><CardTitle className="text-base">Resumo da Integração</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium">Endpoints Disponíveis</p>
                <p className="text-muted-foreground text-xs mt-1">getPropostas, getAssets, listLogins, insertQueueFGTS, listQueueFGTS, createProposta</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium">Segurança</p>
                <p className="text-muted-foreground text-xs mt-1">Credenciais no servidor (Edge Function), JWT validado, ações de escrita restritas a admin/support</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium">Auditoria</p>
                <p className="text-muted-foreground text-xs mt-1">Todas as chamadas logadas em audit_logs com user, action e resultado</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
