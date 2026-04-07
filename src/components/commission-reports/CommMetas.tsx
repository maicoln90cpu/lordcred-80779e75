import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Loader2, Target, Trophy, TrendingUp } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Profile {
  user_id: string;
  name: string | null;
  email: string;
}

interface AnnualReward {
  id: string;
  min_contracts: number;
  reward_description: string;
  sort_order: number;
}

function getStatusColor(pct: number): string {
  if (pct >= 80) return 'text-green-600';
  if (pct >= 50) return 'text-yellow-600';
  return 'text-destructive';
}

function getStatusBadge(pct: number) {
  if (pct >= 100) return <Badge className="bg-green-600 text-white text-[10px]">✅ Bateu</Badge>;
  if (pct >= 80) return <Badge className="bg-green-500/80 text-white text-[10px]">🟢 No caminho</Badge>;
  if (pct >= 50) return <Badge className="bg-yellow-500 text-white text-[10px]">🟡 Atenção</Badge>;
  return <Badge variant="destructive" className="text-[10px]">🔴 Crítico</Badge>;
}

function getProgressColor(pct: number): string {
  if (pct >= 80) return '[&>div]:bg-green-500';
  if (pct >= 50) return '[&>div]:bg-yellow-500';
  return '[&>div]:bg-destructive';
}

export default function CommMetas({ profiles, getSellerName }: { profiles: Profile[]; getSellerName: (id: string) => string }) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const [selectedMonth, setSelectedMonth] = useState<string>(String(currentMonth));

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Fetch all sales for current year
  const { data: sales = [], isLoading: loadingSales } = useQuery({
    queryKey: ['metas-sales', currentYear],
    queryFn: async () => {
      const { data, error } = await supabase.from('commission_sales')
        .select('id, seller_id, released_value, sale_date, commission_value')
        .gte('sale_date', `${currentYear}-01-01`)
        .lte('sale_date', `${currentYear}-12-31`);
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch settings (monthly goal)
  const { data: settings } = useQuery({
    queryKey: ['metas-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('commission_settings').select('*').limit(1).single();
      return data;
    }
  });

  // Fetch annual rewards
  const { data: rewards = [] } = useQuery({
    queryKey: ['metas-rewards'],
    queryFn: async () => {
      const { data } = await supabase.from('commission_annual_rewards').select('*').order('min_contracts', { ascending: true });
      return (data || []) as AnnualReward[];
    }
  });

  // Fetch seller user_ids (only users with role seller or that have sales)
  const sellerIds = useMemo(() => {
    const ids = new Set(sales.map(s => s.seller_id));
    return Array.from(ids);
  }, [sales]);

  const monthIdx = parseInt(selectedMonth);

  // Monthly stats per seller
  const monthlyStats = useMemo(() => {
    const monthStart = new Date(currentYear, monthIdx, 1);
    const monthEnd = new Date(currentYear, monthIdx + 1, 0, 23, 59, 59);

    return sellerIds.map(sellerId => {
      const sellerSales = sales.filter(s => {
        const d = new Date(s.sale_date);
        return s.seller_id === sellerId && d >= monthStart && d <= monthEnd;
      });
      const contracts = sellerSales.length;
      const valor = sellerSales.reduce((a, s) => a + (s.released_value || 0), 0);
      const comissao = sellerSales.reduce((a, s) => a + (s.commission_value || 0), 0);

      const goalType = settings?.monthly_goal_type || 'contratos';
      const goalValue = settings?.monthly_goal_value || 0;
      const current = goalType === 'contratos' ? contracts : valor;
      const pct = goalValue > 0 ? Math.min((current / goalValue) * 100, 100) : 0;

      return { sellerId, contracts, valor, comissao, current, goalValue, goalType, pct };
    }).sort((a, b) => b.pct - a.pct);
  }, [sellerIds, sales, monthIdx, currentYear, settings]);

  // Annual stats per seller
  const annualStats = useMemo(() => {
    return sellerIds.map(sellerId => {
      const count = sales.filter(s => s.seller_id === sellerId).length;
      const sortedRewards = [...rewards].sort((a, b) => a.min_contracts - b.min_contracts);
      const achieved = sortedRewards.filter(r => count >= r.min_contracts);
      const nextReward = sortedRewards.find(r => r.min_contracts > count);
      const nextTarget = nextReward?.min_contracts || (sortedRewards.length > 0 ? sortedRewards[sortedRewards.length - 1].min_contracts : 0);
      const pct = nextTarget > 0 ? Math.min((count / nextTarget) * 100, 100) : 100;
      const remaining = nextReward ? nextReward.min_contracts - count : 0;

      return {
        sellerId, count, achieved, nextReward, pct, remaining,
        achievedLabels: achieved.map(a => a.reward_description),
        nextLabel: nextReward?.reward_description || 'Todas conquistadas!',
      };
    }).sort((a, b) => b.count - a.count);
  }, [sellerIds, sales, rewards]);

  if (loadingSales) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (sellerIds.length === 0) return <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma venda registrada no ano atual.</p>;

  const goalConfigured = (settings?.monthly_goal_value || 0) > 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><Target className="w-4 h-4" /> Vendedores Ativos</div>
            <p className="text-2xl font-bold">{sellerIds.length}</p>
            <p className="text-xs text-muted-foreground">Com vendas em {currentYear}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><TrendingUp className="w-4 h-4" /> Meta Mensal Global</div>
            <p className="text-2xl font-bold">
              {goalConfigured
                ? (settings?.monthly_goal_type === 'contratos' ? `${settings?.monthly_goal_value} contratos` : fmtBRL(settings?.monthly_goal_value || 0))
                : 'Não configurada'}
            </p>
            <p className="text-xs text-muted-foreground">{goalConfigured ? 'Definida em Configurações' : 'Configure na aba Config'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><Trophy className="w-4 h-4" /> Premiações Cadastradas</div>
            <p className="text-2xl font-bold">{rewards.length}</p>
            <p className="text-xs text-muted-foreground">{rewards.map(r => r.reward_description).join(', ') || 'Nenhuma'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Goals Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg"><Target className="w-5 h-5" /> Metas Mensais por Vendedor</CardTitle>
              <CardDescription>Progresso individual no mês selecionado. Cores: 🟢 ≥80% | 🟡 ≥50% | 🔴 &lt;50%</CardDescription>
            </div>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m, i) => (
                  <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {!goalConfigured ? (
            <p className="text-sm text-muted-foreground text-center py-4">⚠️ Meta mensal não configurada. Vá em <strong>Configurações</strong> para definir.</p>
          ) : (
            <div className="border rounded-lg max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Vendedor</TableHead>
                    <TableHead className="text-xs text-right">Contratos</TableHead>
                    <TableHead className="text-xs text-right">Valor Liberado</TableHead>
                    <TableHead className="text-xs text-right">Comissão</TableHead>
                    <TableHead className="text-xs text-center">Progresso</TableHead>
                    <TableHead className="text-xs text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyStats.map((r) => (
                    <TableRow key={r.sellerId}>
                      <TableCell className="text-xs font-medium">{getSellerName(r.sellerId)}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{r.contracts}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{fmtBRL(r.valor)}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{fmtBRL(r.comissao)}</TableCell>
                      <TableCell className="text-xs w-[200px]">
                        <div className="flex items-center gap-2">
                          <Progress value={r.pct} className={`h-2 flex-1 ${getProgressColor(r.pct)}`} />
                          <span className={`text-xs font-bold min-w-[40px] text-right ${getStatusColor(r.pct)}`}>{r.pct.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-center">{getStatusBadge(r.pct)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Annual Progress Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg"><Trophy className="w-5 h-5" /> Progresso Anual — Premiações {currentYear}</CardTitle>
          <CardDescription>Acumulado de contratos no ano e proximidade das premiações cadastradas.</CardDescription>
        </CardHeader>
        <CardContent>
          {rewards.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">⚠️ Nenhuma premiação cadastrada. Configure em <strong>Configurações → Premiações Anuais</strong>.</p>
          ) : (
            <div className="border rounded-lg max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Vendedor</TableHead>
                    <TableHead className="text-xs text-right">Contratos no Ano</TableHead>
                    <TableHead className="text-xs">Prêmios Conquistados</TableHead>
                    <TableHead className="text-xs">Próximo Prêmio</TableHead>
                    <TableHead className="text-xs text-right">Faltam</TableHead>
                    <TableHead className="text-xs text-center">Progresso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {annualStats.map((r) => (
                    <TableRow key={r.sellerId}>
                      <TableCell className="text-xs font-medium">{getSellerName(r.sellerId)}</TableCell>
                      <TableCell className="text-xs text-right font-mono font-bold">{r.count}</TableCell>
                      <TableCell className="text-xs">
                        {r.achievedLabels.length > 0
                          ? r.achievedLabels.map((label, i) => (
                              <Badge key={i} variant="secondary" className="mr-1 text-[10px]">✅ {label}</Badge>
                            ))
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs font-medium">{r.nextLabel}</TableCell>
                      <TableCell className="text-xs text-right font-mono">
                        {r.remaining > 0 ? <span className="text-destructive font-bold">{r.remaining}</span> : <span className="text-green-600">✓</span>}
                      </TableCell>
                      <TableCell className="text-xs w-[160px]">
                        <div className="flex items-center gap-2">
                          <Progress value={r.pct} className={`h-2 flex-1 ${getProgressColor(r.pct)}`} />
                          <span className={`text-xs font-bold min-w-[35px] text-right ${getStatusColor(r.pct)}`}>{r.pct.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
