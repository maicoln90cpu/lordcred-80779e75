import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { TSHead } from '@/components/commission-reports/CRSortUtils';
import { useTableState } from '@/hooks/useTableState';
import TablePagination from '@/components/common/TablePagination';
import WeekMultiSelect from './WeekMultiSelect';
import { fmtBRL, formatDateBR } from './commissionUtils';
import type { CommissionSale, Profile, AnnualReward } from './commissionUtils';
import KpiDelta from './KpiDelta';
import {
  getPreviousWeekLabels,
  filterPreviousMonthSales,
  filterCurrentMonthSales,
  computeKpiTotals,
} from './kpiPeriodUtils';

interface ExtratoTabProps {
  profiles: Profile[];
  getSellerName: (id: string) => string;
  isAdmin: boolean;
  userId: string;
}

export default function ExtratoTab({ profiles, getSellerName, isAdmin, userId }: ExtratoTabProps) {
  const [sales, setSales] = useState<CommissionSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [sellerFilter, setSellerFilter] = useState(isAdmin ? 'all' : userId);
  const [weekFilters, setWeekFilters] = useState<string[]>([]);
  const [productFilter, setProductFilter] = useState('all');
  const { sort, toggle } = useSortState();
  const [monthlyGoal, setMonthlyGoal] = useState<{ value: number; type: string }>({ value: 0, type: 'contratos' });
  const [annualRewards, setAnnualRewards] = useState<AnnualReward[]>([]);

  useEffect(() => { loadSales(); loadMonthlyGoal(); loadAnnualRewards(); }, []);

  const loadAnnualRewards = async () => {
    const { data } = await supabase.from('commission_annual_rewards' as any).select('*').order('sort_order', { ascending: true });
    if (data) setAnnualRewards(data as any as AnnualReward[]);
  };

  const loadSales = async () => {
    setLoading(true);
    const { data } = await supabase.from('commission_sales').select('*').order('sale_date', { ascending: false });
    if (data) setSales(data as unknown as CommissionSale[]);
    setLoading(false);
  };

  const loadMonthlyGoal = async () => {
    const { data } = await supabase.from('commission_settings').select('monthly_goal_value, monthly_goal_type').limit(1).single();
    if (data) setMonthlyGoal({ value: (data as any).monthly_goal_value ?? 0, type: (data as any).monthly_goal_type ?? 'contratos' });
  };

  const currentMonthSales = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const targetSeller = sellerFilter !== 'all' ? sellerFilter : (!isAdmin ? userId : null);
    return sales.filter(s => {
      const d = new Date(s.sale_date);
      if (d.getFullYear() !== y || d.getMonth() !== m) return false;
      if (targetSeller && s.seller_id !== targetSeller) return false;
      return true;
    });
  }, [sales, sellerFilter, isAdmin, userId]);

  const monthlyProgress = useMemo(() => {
    if (monthlyGoal.value <= 0) return null;
    const current = monthlyGoal.type === 'contratos'
      ? currentMonthSales.length
      : currentMonthSales.reduce((a, s) => a + s.released_value, 0);
    const pct = Math.min((current / monthlyGoal.value) * 100, 100);
    return { current, goal: monthlyGoal.value, pct, type: monthlyGoal.type };
  }, [monthlyGoal, currentMonthSales]);

  const annualProgress = useMemo(() => {
    if (annualRewards.length === 0) return null;
    const targetSeller = sellerFilter !== 'all' ? sellerFilter : (!isAdmin ? userId : null);
    if (!targetSeller) return null;
    const year = new Date().getFullYear();
    const yearSales = sales.filter(s => {
      const d = new Date(s.sale_date);
      return d.getFullYear() === year && s.seller_id === targetSeller;
    });
    const count = yearSales.length;
    const sortedRewards = [...annualRewards].sort((a, b) => a.min_contracts - b.min_contracts);
    const nextReward = sortedRewards.find(r => r.min_contracts > count);
    const currentReward = [...sortedRewards].reverse().find(r => r.min_contracts <= count);
    const nextTarget = nextReward?.min_contracts || (sortedRewards[sortedRewards.length - 1]?.min_contracts || 0);
    const remaining = nextReward ? nextReward.min_contracts - count : 0;
    const pct = nextTarget > 0 ? Math.min((count / nextTarget) * 100, 100) : 100;
    return { count, nextReward: nextReward?.reward_description || '🎉 Todas atingidas!', currentReward: currentReward?.reward_description || null, remaining, pct };
  }, [sales, sellerFilter, isAdmin, userId, annualRewards]);

  const weeks = useMemo(() => [...new Set(sales.map(s => s.week_label).filter(Boolean))].sort().reverse(), [sales]);

  // Cascata: se há semanas selecionadas, vendedores disponíveis são apenas os que venderam nessas semanas
  const availableSellerIds = useMemo(() => {
    if (weekFilters.length === 0) return null; // null = todos
    const ids = new Set<string>();
    sales.forEach(s => {
      if (weekFilters.includes(s.week_label || '')) ids.add(s.seller_id);
    });
    return ids;
  }, [sales, weekFilters]);

  const visibleProfiles = useMemo(() => {
    if (!availableSellerIds) return profiles;
    return profiles.filter(p => availableSellerIds.has(p.user_id));
  }, [profiles, availableSellerIds]);

  // Reset sellerFilter se vendedor escolhido não vendeu nas semanas selecionadas
  useEffect(() => {
    if (!isAdmin) return;
    if (sellerFilter === 'all') return;
    if (availableSellerIds && !availableSellerIds.has(sellerFilter)) {
      setSellerFilter('all');
    }
  }, [availableSellerIds, sellerFilter, isAdmin]);

  const filtered = sales.filter(s => {
    if (weekFilters.length > 0 && !weekFilters.includes(s.week_label || '')) return false;
    if (sellerFilter !== 'all' && s.seller_id !== sellerFilter) return false;
    if (productFilter !== 'all' && s.product !== productFilter) return false;
    return true;
  });

  const totalValue = filtered.reduce((a, s) => a + s.released_value, 0);
  const totalComm = filtered.reduce((a, s) => a + s.commission_value, 0);
  const fmt = fmtBRL;

  // ---- Comparação inteligente: período atual vs anterior
  const prevPeriodSales = useMemo(() => {
    const baseFilter = (s: CommissionSale) => {
      if (sellerFilter !== 'all' && s.seller_id !== sellerFilter) return false;
      if (productFilter !== 'all' && s.product !== productFilter) return false;
      return true;
    };
    if (weekFilters.length > 0) {
      const prevWeeks = getPreviousWeekLabels(weekFilters, weeks as string[]);
      if (prevWeeks.length === 0) return [];
      return sales.filter((s) => baseFilter(s) && prevWeeks.includes(s.week_label || ''));
    }
    return filterPreviousMonthSales(sales.filter(baseFilter));
  }, [sales, weekFilters, sellerFilter, productFilter, weeks]);

  const currentReferenceSales = useMemo(() => {
    if (weekFilters.length > 0) return filtered;
    const baseFilter = (s: CommissionSale) => {
      if (sellerFilter !== 'all' && s.seller_id !== sellerFilter) return false;
      if (productFilter !== 'all' && s.product !== productFilter) return false;
      return true;
    };
    return filterCurrentMonthSales(sales.filter(baseFilter));
  }, [sales, weekFilters, sellerFilter, productFilter, filtered]);

  const currentTotals = useMemo(() => computeKpiTotals(currentReferenceSales), [currentReferenceSales]);
  const prevTotals = useMemo(() => computeKpiTotals(prevPeriodSales), [prevPeriodSales]);

  const comparisonLabel = weekFilters.length > 0
    ? (weekFilters.length === 1 ? 'vs semana anterior' : `vs ${weekFilters.length} semanas anteriores`)
    : 'vs mês anterior';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Extrato de Comissões</CardTitle>
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          {isAdmin && (
            <Select value={sellerFilter} onValueChange={setSellerFilter}>
              <SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os vendedores</SelectItem>
                {[...visibleProfiles].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, 'pt-BR')).map(p => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.name || p.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos produtos</SelectItem>
              <SelectItem value="FGTS">FGTS</SelectItem>
              <SelectItem value="Crédito do Trabalhador">CLT</SelectItem>
            </SelectContent>
          </Select>
          <WeekMultiSelect weeks={weeks as string[]} selected={weekFilters} onChange={setWeekFilters} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="p-4 border rounded-lg bg-card">
            <p className="text-xs text-muted-foreground">Propostas</p>
            <p className="text-2xl font-bold mt-1">{currentTotals.count}</p>
            <KpiDelta current={currentTotals.count} previous={prevTotals.count} comparisonLabel={comparisonLabel} />
          </div>
          <div className="p-4 border rounded-lg bg-card">
            <p className="text-xs text-muted-foreground">Total Liberado</p>
            <p className="text-2xl font-bold mt-1">{fmt(currentTotals.totalValue)}</p>
            <KpiDelta current={currentTotals.totalValue} previous={prevTotals.totalValue} comparisonLabel={comparisonLabel} />
          </div>
          <div className="p-4 border rounded-lg bg-card">
            <p className="text-xs text-muted-foreground">Comissão</p>
            <p className="text-2xl font-bold mt-1 text-primary">{fmt(currentTotals.totalComm)}</p>
            <KpiDelta current={currentTotals.totalComm} previous={prevTotals.totalComm} comparisonLabel={comparisonLabel} />
          </div>
          <div className="p-4 border rounded-lg bg-card">
            <p className="text-xs text-muted-foreground">Ticket Médio</p>
            <p className="text-2xl font-bold mt-1">{fmt(currentTotals.ticket)}</p>
            <KpiDelta current={currentTotals.ticket} previous={prevTotals.ticket} comparisonLabel={comparisonLabel} />
          </div>
        </div>
        {weekFilters.length === 0 && (
          <p className="text-[11px] text-muted-foreground -mt-2 mb-3 italic">
            📅 Mostrando totais do mês corrente (sem filtro de semana). A tabela abaixo mostra todos os registros.
          </p>
        )}
        {monthlyProgress && (
          <div className="mb-4 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium flex items-center gap-2">
                📊 Meta Mensal {monthlyProgress.type === 'contratos' ? '(Contratos)' : '(Valor Liberado)'}
                {sellerFilter !== 'all' && <Badge variant="secondary" className="text-[10px]">{getSellerName(sellerFilter)}</Badge>}
              </p>
              <p className="text-sm font-bold">
                {monthlyProgress.type === 'contratos'
                  ? `${monthlyProgress.current} / ${monthlyProgress.goal}`
                  : `${fmt(monthlyProgress.current)} / ${fmt(monthlyProgress.goal)}`}
              </p>
            </div>
            <div className="relative h-4 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={`h-full rounded-full transition-all ${monthlyProgress.pct >= 100 ? 'bg-green-500' : monthlyProgress.pct >= 70 ? 'bg-primary' : monthlyProgress.pct >= 40 ? 'bg-yellow-500' : 'bg-destructive'}`}
                style={{ width: `${monthlyProgress.pct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {monthlyProgress.pct >= 100
                ? '🎉 Meta atingida!'
                : `${monthlyProgress.pct.toFixed(0)}% concluído — faltam ${monthlyProgress.type === 'contratos'
                    ? `${Math.max(0, monthlyProgress.goal - monthlyProgress.current)} contratos`
                    : fmt(Math.max(0, monthlyProgress.goal - monthlyProgress.current))}`}
            </p>
          </div>
        )}

        {annualProgress && (
          <div className="mb-4 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">🏆 Progresso Anual ({new Date().getFullYear()})</p>
              <Badge variant="outline" className="text-xs">{annualProgress.count} contratos no ano</Badge>
            </div>
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={`h-full rounded-full transition-all ${annualProgress.pct >= 100 ? 'bg-green-500' : annualProgress.pct >= 70 ? 'bg-primary' : annualProgress.pct >= 40 ? 'bg-yellow-500' : 'bg-orange-400'}`}
                style={{ width: `${annualProgress.pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted-foreground">
                {annualProgress.remaining > 0
                  ? `Faltam ${annualProgress.remaining} para: ${annualProgress.nextReward}`
                  : annualProgress.nextReward}
              </p>
              {annualProgress.currentReward && (
                <Badge variant="secondary" className="text-[10px]">✅ {annualProgress.currentReward}</Badge>
              )}
            </div>
          </div>
        )}

        {loading ? <p className="text-center text-muted-foreground py-4">Carregando...</p> : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">Nenhum resultado</p>
        ) : (
          <Table>
            <TableHeader>
              <tr>
                <TSHead label="Data" sortKey="sale_date" sort={sort} toggle={toggle} />
                <TSHead label="Produto" sortKey="product" sort={sort} toggle={toggle} />
                <TSHead label="Banco" sortKey="bank" sort={sort} toggle={toggle} />
                {isAdmin && <TSHead label="Vendedor" sortKey="seller_id" sort={sort} toggle={toggle} />}
                <TSHead label="Valor" sortKey="released_value" sort={sort} toggle={toggle} className="text-right" />
                <TSHead label="Comissão" sortKey="commission_value" sort={sort} toggle={toggle} className="text-right" />
              </tr>
            </TableHeader>
            <TableBody>
              {applySortToData(filtered, sort, (s, k) => {
                if (k === 'seller_id') return getSellerName(s.seller_id);
                return (s as any)[k];
              }).map(s => (
                <TableRow key={s.id}>
                  <TableCell>{formatDateBR(s.sale_date)}</TableCell>
                  <TableCell><Badge variant={s.product === 'FGTS' ? 'default' : 'secondary'}>{s.product === 'Crédito do Trabalhador' ? 'CLT' : s.product}</Badge></TableCell>
                  <TableCell>{s.bank}</TableCell>
                  {isAdmin && <TableCell>{getSellerName(s.seller_id)}</TableCell>}
                  <TableCell className="text-right">{fmt(s.released_value)}</TableCell>
                  <TableCell className="text-right font-bold text-primary">{fmt(s.commission_value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
