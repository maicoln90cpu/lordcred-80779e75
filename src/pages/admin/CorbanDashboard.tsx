import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Building2, ClipboardList, Landmark, TrendingUp, Clock, CheckCircle, AlertTriangle, Wifi, RefreshCw, DollarSign, FileText, Users, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { invokeCorban } from '@/lib/invokeCorban';
import { normalizeCorbanPropostasInput, type NormalizedCorbanProposta } from '@/lib/corbanPropostas';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';

interface DashboardStats {
  totalPropostas: number;
  valorTotal: number;
  porStatus: Record<string, number>;
  porBanco: Record<string, number>;
  ultimaAtualizacao: Date | null;
}

const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function CorbanDashboard() {
  const navigate = useNavigate();
  const [testing, setTesting] = useState(false);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  const [assetCount, setAssetCount] = useState(0);
  const [loadingStats, setLoadingStats] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [cachedStatusLabels, setCachedStatusLabels] = useState<Record<string, string>>({});

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

  // Auto-test connection on mount
  useEffect(() => {
    handleTestConnection();
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    const { data, error } = await invokeCorban('testConnection');
    setTesting(false);
    if (error) {
      setConnectionOk(false);
    } else {
      setConnectionOk(true);
    }
  };

  const loadRecentStats = useCallback(async () => {
    setLoadingStats(true);
    const dateFrom = format(subDays(new Date(), 7), 'yyyy-MM-dd');
    const dateTo = format(new Date(), 'yyyy-MM-dd');

    const { data, error } = await invokeCorban('getPropostas', {
      exactPayload: true,
      filters: {
        status: [],
        data: { tipo: 'cadastro', startDate: dateFrom, endDate: dateTo },
      },
    });

    setLoadingStats(false);
    if (error) {
      toast.error('Erro ao carregar estatísticas', { description: error });
      return;
    }

    const propostas = normalizeCorbanPropostasInput(data);
    const porStatus: Record<string, number> = {};
    const porBanco: Record<string, number> = {};
    let valorTotal = 0;

    propostas.forEach(p => {
      const statusKey = p.status || 'desconhecido';
      porStatus[statusKey] = (porStatus[statusKey] || 0) + 1;
      if (p.banco) {
        porBanco[p.banco] = (porBanco[p.banco] || 0) + 1;
      }
      valorTotal += p.valor_liberado || 0;
    });

    setStats({
      totalPropostas: propostas.length,
      valorTotal,
      porStatus,
      porBanco,
      ultimaAtualizacao: new Date(),
    });

    toast.success(`${propostas.length} propostas carregadas (últimos 7 dias)`);
  }, []);

  const resolveStatusLabel = (key: string) => cachedStatusLabels[key] || key;

  const topStatuses = stats ? Object.entries(stats.porStatus)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6) : [];

  const topBancos = stats ? Object.entries(stats.porBanco)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5) : [];

  const navCards = [
    {
      icon: ClipboardList,
      title: 'Propostas',
      description: 'Consultar propostas por CPF, status, banco e período',
      href: '/admin/corban/propostas',
    },
    {
      icon: Landmark,
      title: 'Fila FGTS',
      description: 'Consultar e incluir CPFs na fila FGTS',
      href: '/admin/corban/fgts',
    },
    {
      icon: TrendingUp,
      title: 'Assets Sincronizados',
      description: `${assetCount} itens em cache (bancos, convênios, etc.)`,
      href: '/admin/corban/assets',
    },
    {
      icon: Clock,
      title: 'Configuração',
      description: 'Visibilidade de features por role',
      href: '/admin/corban/config',
    },
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
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalPropostas ?? '—'}</p>
                <p className="text-xs text-muted-foreground">Propostas (7 dias)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <DollarSign className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats ? fmtBRL(stats.valorTotal) : '—'}</p>
                <p className="text-xs text-muted-foreground">Valor Total (7 dias)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats ? Object.keys(stats.porBanco).length : '—'}</p>
                <p className="text-xs text-muted-foreground">Bancos Ativos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Activity className="w-5 h-5 text-amber-500" />
              </div>
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
            {/* Status breakdown */}
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
                      <span className="text-xs text-muted-foreground w-32 truncate" title={resolveStatusLabel(status)}>
                        {resolveStatusLabel(status)}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/70 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium w-12 text-right">{count} ({pct}%)</span>
                    </div>
                  );
                })}
                {stats.ultimaAtualizacao && (
                  <p className="text-[10px] text-muted-foreground/60 mt-2">
                    Atualizado: {format(stats.ultimaAtualizacao, 'dd/MM HH:mm')}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Bank breakdown */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Top Bancos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {topBancos.map(([banco, count], i) => (
                  <div key={banco} className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground w-5">{i + 1}.</span>
                    <span className="text-xs flex-1 truncate">{banco}</span>
                    <Badge variant="secondary" className="text-[10px]">{count}</Badge>
                  </div>
                ))}
                {topBancos.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Carregue as métricas primeiro</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Navigation cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {navCards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.08 }}
            >
              <Card
                className="cursor-pointer hover:border-primary/50 transition-colors group"
                onClick={() => navigate(card.href)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <card.icon className="w-4 h-4 group-hover:text-primary transition-colors" />
                    {card.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{card.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Integration summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumo da Integração</CardTitle>
          </CardHeader>
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
