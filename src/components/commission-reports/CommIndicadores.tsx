import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Medal, PieChart, Ticket, AlertTriangle, DollarSign, TrendingUp, Users, History, CalendarRange } from 'lucide-react';
import { TSHead, useSortState, applySortToData } from './CRSortUtils';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Sale {
  id: string;
  seller_id: string;
  product: string;
  bank: string;
  released_value: number;
  commission_value: number;
  commission_rate: number;
  week_label: string | null;
  bonus_value?: number;
  sale_date: string;
  client_name?: string | null;
}

interface Profile {
  user_id: string;
  name: string | null;
  email: string;
}

// IMPORTANTE: sempre receba `salesTable` via prop — não hardcode 'commission_sales',
// senão o módulo V2 (sandbox) acaba lendo dados do V1 e mostra números falsos.
export default function CommIndicadores({
  profiles,
  getSellerName,
  salesTable = 'commission_sales',
  cltRatesTable = 'commission_rates_clt',
  fgtsRatesTable = 'commission_rates_fgts',
}: {
  profiles: Profile[];
  getSellerName: (id: string) => string;
  salesTable?: 'commission_sales' | 'commission_sales_v2';
  cltRatesTable?: 'commission_rates_clt' | 'commission_rates_clt_v2';
  fgtsRatesTable?: 'commission_rates_fgts' | 'commission_rates_fgts_v2';
}) {
  const { sort, toggle } = useSortState();
  const [selectedMonth, setSelectedMonth] = useState<string>(''); // YYYY-MM ('' = mês atual ainda não resolvido)

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['comm-sales-indicadores', salesTable],
    queryFn: async () => {
      const { data } = await supabase.from(salesTable).select('id, seller_id, product, bank, released_value, commission_value, commission_rate, week_label, sale_date, client_name').limit(5000);
      return (data || []) as Sale[];
    },
  });

  // Opções de mês = todos YYYY-MM com vendas, ordenado desc
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    sales.forEach(s => { if (s.sale_date) set.add(String(s.sale_date).slice(0, 7)); });
    const arr = [...set].sort().reverse();
    const NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return arr.map(ym => {
      const [y, m] = ym.split('-');
      return { value: ym, label: `${NAMES[parseInt(m, 10) - 1]}/${y}` };
    });
  }, [sales]);

  // Default automático = mês mais recente com vendas (uma única vez)
  const autoDefaultedRef = useRef(false);
  useEffect(() => {
    if (autoDefaultedRef.current) return;
    if (monthOptions.length === 0) return;
    setSelectedMonth(monthOptions[0].value);
    autoDefaultedRef.current = true;
  }, [monthOptions]);


  // Fetch CLT rate history
  const { data: cltRates = [] } = useQuery({
    queryKey: ['comm-clt-rates-history', cltRatesTable],
    queryFn: async () => {
      const { data } = await supabase.from(cltRatesTable).select('id, bank, effective_date, rate, has_insurance, term_min, term_max, table_key, created_at').order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
  });

  // Fetch FGTS rate history (V1 = 3 cols; V2 = multivariável)
  const { data: fgtsRates = [] } = useQuery({
    queryKey: ['comm-fgts-rates-history', fgtsRatesTable],
    queryFn: async () => {
      const cols = fgtsRatesTable === 'commission_rates_fgts_v2'
        ? 'id, bank, effective_date, rate, has_insurance, table_key, created_at'
        : 'id, bank, effective_date, rate_no_insurance, rate_with_insurance, created_at';
      const { data } = await supabase.from(fgtsRatesTable).select(cols).order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
  });

  // ==================== KPIs Executivos ====================
  const kpis = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthSales = sales.filter(s => {
      const d = new Date(s.sale_date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const totalVendasMes = monthSales.length;
    const totalComissaoMes = monthSales.reduce((a, s) => a + (s.commission_value || 0), 0);
    const totalLiberadoMes = monthSales.reduce((a, s) => a + (s.released_value || 0), 0);
    const ticketMedio = totalVendasMes > 0 ? totalLiberadoMes / totalVendasMes : 0;
    const vendedoresAtivos = new Set(monthSales.map(s => s.seller_id)).size;
    const topSeller = (() => {
      const map = new Map<string, number>();
      for (const s of monthSales) map.set(s.seller_id, (map.get(s.seller_id) || 0) + (s.commission_value || 0));
      let best = { id: '', val: 0 };
      for (const [id, val] of map) if (val > best.val) best = { id, val };
      return best.id ? getSellerName(best.id) : '—';
    })();
    const bancoTop = (() => {
      const map = new Map<string, number>();
      for (const s of monthSales) map.set(s.bank, (map.get(s.bank) || 0) + s.released_value);
      let best = { name: '', val: 0 };
      for (const [name, val] of map) if (val > best.val) best = { name, val };
      return best.name || '—';
    })();

    return { totalVendasMes, totalComissaoMes, totalLiberadoMes, ticketMedio, vendedoresAtivos, topSeller, bancoTop };
  }, [sales, getSellerName]);

  // ==================== Alertas de Taxa 0% ====================
  const zeroRateAlerts = useMemo(() => {
    return sales.filter(s => (s.commission_rate === 0 || s.commission_rate === null) && s.released_value > 0)
      .slice(0, 20)
      .map(s => ({
        id: s.id,
        bank: s.bank,
        product: s.product,
        client: s.client_name || '—',
        value: s.released_value,
        date: s.sale_date,
        seller: getSellerName(s.seller_id),
      }));
  }, [sales, getSellerName]);

  // ==================== Histórico de Taxas ====================
  const rateHistory = useMemo(() => {
    const cltItems = cltRates.map(r => ({
      tipo: 'CLT',
      banco: (r as any).bank,
      vigencia: (r as any).effective_date,
      taxa: `${(r as any).rate}%`,
      detalhe: `Prazo ${(r as any).term_min}-${(r as any).term_max} | Seguro: ${(r as any).has_insurance ? 'Sim' : 'Não'}${(r as any).table_key ? ` | Chave: ${(r as any).table_key}` : ''}`,
      criado: (r as any).created_at,
    }));
    const fgtsItems = fgtsRates.map(r => {
      const row = r as any;
      // V2: coluna `rate` única com `has_insurance`. V1: `rate_no_insurance` + `rate_with_insurance`.
      const taxa = row.rate !== undefined
        ? `${row.rate}%${row.has_insurance ? ' (c/ seg)' : ''}${row.table_key ? ` | ${row.table_key}` : ''}`
        : `S/ Seg: ${row.rate_no_insurance}% | C/ Seg: ${row.rate_with_insurance}%`;
      return {
        tipo: 'FGTS',
        banco: row.bank,
        vigencia: row.effective_date,
        taxa,
        detalhe: '',
        criado: row.created_at,
      };
    });
    return [...cltItems, ...fgtsItems].sort((a, b) => new Date(b.criado).getTime() - new Date(a.criado).getTime()).slice(0, 30);
  }, [cltRates, fgtsRates]);

  // ==================== Existing tables ====================
  const ticketMedio = useMemo(() => {
    const map = new Map<string, { total: number; count: number; comissao: number }>();
    for (const s of sales) {
      const entry = map.get(s.seller_id) || { total: 0, count: 0, comissao: 0 };
      entry.total += s.released_value;
      entry.count++;
      entry.comissao += s.commission_value || 0;
      map.set(s.seller_id, entry);
    }
    return Array.from(map.entries()).map(([seller_id, v]) => ({
      seller_id,
      nome: getSellerName(seller_id),
      propostas: v.count,
      totalLiberado: v.total,
      ticketMedio: v.count > 0 ? v.total / v.count : 0,
      comissaoTotal: v.comissao,
    }));
  }, [sales, getSellerName]);

  const rankingSemanal = useMemo(() => {
    const weeks = [...new Set(sales.filter(s => s.week_label).map(s => s.week_label!))].sort().reverse();
    const latestWeek = weeks[0] || null;
    const prevWeek = weeks[1] || null;
    if (!latestWeek) return { week: '', rows: [] };
    const current = new Map<string, number>();
    const prev = new Map<string, number>();
    for (const s of sales) {
      if (s.week_label === latestWeek) current.set(s.seller_id, (current.get(s.seller_id) || 0) + (s.commission_value || 0));
      if (prevWeek && s.week_label === prevWeek) prev.set(s.seller_id, (prev.get(s.seller_id) || 0) + (s.commission_value || 0));
    }
    const rows = Array.from(current.entries()).map(([seller_id, cms]) => {
      const prevCms = prev.get(seller_id) || 0;
      return { seller_id, nome: getSellerName(seller_id), comissao: cms, anterior: prevCms, variacao: prevCms > 0 ? ((cms - prevCms) / prevCms) : 0 };
    }).sort((a, b) => b.comissao - a.comissao);
    return { week: latestWeek, rows };
  }, [sales, getSellerName]);

  const mixProdutos = useMemo(() => {
    const map = new Map<string, { fgts: number; clt: number; outros: number; total: number }>();
    for (const s of sales) {
      const entry = map.get(s.seller_id) || { fgts: 0, clt: 0, outros: 0, total: 0 };
      const p = s.product.toUpperCase();
      if (p.includes('FGTS')) entry.fgts += s.released_value;
      else if (p.includes('CLT') || p.includes('TRABALHADOR')) entry.clt += s.released_value;
      else entry.outros += s.released_value;
      entry.total += s.released_value;
      map.set(s.seller_id, entry);
    }
    return Array.from(map.entries()).map(([seller_id, v]) => ({
      seller_id,
      nome: getSellerName(seller_id),
      fgts: v.fgts,
      clt: v.clt,
      outros: v.outros,
      pctFGTS: v.total > 0 ? v.fgts / v.total : 0,
      pctCLT: v.total > 0 ? v.clt / v.total : 0,
    }));
  }, [sales, getSellerName]);

  const sortedTicket = applySortToData(ticketMedio, sort);
  const sortedMix = applySortToData(mixProdutos, sort);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (sales.length === 0) return <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma venda registrada ainda.</p>;

  const mesAtual = new Date().toLocaleString('pt-BR', { month: 'long' }).replace(/^\w/, c => c.toUpperCase());

  return (
    <div className="space-y-6">
      {/* ==================== KPIs Executivos ==================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><DollarSign className="w-3.5 h-3.5" /> Vendas {mesAtual}</div>
          <p className="text-xl font-bold">{kpis.totalVendasMes}</p>
          <p className="text-[10px] text-muted-foreground">{fmtBRL(kpis.totalLiberadoMes)} liberados</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><TrendingUp className="w-3.5 h-3.5" /> Comissão {mesAtual}</div>
          <p className="text-xl font-bold">{fmtBRL(kpis.totalComissaoMes)}</p>
          <p className="text-[10px] text-muted-foreground">Ticket médio: {fmtBRL(kpis.ticketMedio)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Users className="w-3.5 h-3.5" /> Top Vendedor</div>
          <p className="text-lg font-bold truncate">{kpis.topSeller}</p>
          <p className="text-[10px] text-muted-foreground">{kpis.vendedoresAtivos} vendedor(es) ativo(s)</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Medal className="w-3.5 h-3.5" /> Banco Destaque</div>
          <p className="text-lg font-bold truncate">{kpis.bancoTop}</p>
          <p className="text-[10px] text-muted-foreground">Maior volume no mês</p>
        </CardContent></Card>
      </div>

      {/* ==================== Alerta Taxas 0% ==================== */}
      {zeroRateAlerts.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-destructive"><AlertTriangle className="w-5 h-5" /> Vendas com Taxa 0% <Badge variant="destructive" className="text-[10px]">{zeroRateAlerts.length}</Badge></CardTitle>
            <CardDescription>Vendas onde a taxa de comissão é 0% — provavelmente faltam taxas cadastradas para este banco/produto.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border border-destructive/30 rounded-lg max-h-[300px] overflow-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <tr>
                    <TSHead label="Banco" sortKey="bank" sort={sort} toggle={toggle} className="text-xs" />
                    <TSHead label="Produto" sortKey="product" sort={sort} toggle={toggle} className="text-xs" />
                    <TSHead label="Cliente" sortKey="client" sort={sort} toggle={toggle} className="text-xs" />
                    <TSHead label="Valor" sortKey="value" sort={sort} toggle={toggle} className="text-xs text-right" />
                    <TSHead label="Vendedor" sortKey="seller" sort={sort} toggle={toggle} className="text-xs" />
                    <TSHead label="Data" sortKey="date" sort={sort} toggle={toggle} className="text-xs" />
                  </tr>
                </TableHeader>
                <TableBody>
                  {zeroRateAlerts.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs font-medium">{r.bank}</TableCell>
                      <TableCell className="text-xs">{r.product}</TableCell>
                      <TableCell className="text-xs">{r.client}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{fmtBRL(r.value)}</TableCell>
                      <TableCell className="text-xs">{r.seller}</TableCell>
                      <TableCell className="text-xs">{new Date(r.date).toLocaleDateString('pt-BR')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 1. Ticket Médio */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg"><Ticket className="w-5 h-5" /> Ticket Médio por Vendedor</CardTitle>
          <CardDescription>Valor liberado médio por proposta, agrupado por vendedor.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg max-h-[400px] overflow-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <tr>
                  <TSHead label="Vendedor" sortKey="nome" sort={sort} toggle={toggle} tooltip="Nome do vendedor" className="text-xs" />
                  <TSHead label="Propostas" sortKey="propostas" sort={sort} toggle={toggle} tooltip="Quantidade total de propostas" className="text-xs text-right" />
                  <TSHead label="Total Liberado" sortKey="totalLiberado" sort={sort} toggle={toggle} tooltip="Soma do valor liberado" className="text-xs text-right" />
                  <TSHead label="Ticket Médio" sortKey="ticketMedio" sort={sort} toggle={toggle} tooltip="Valor médio por proposta" className="text-xs text-right" />
                  <TSHead label="Comissão Total" sortKey="comissaoTotal" sort={sort} toggle={toggle} tooltip="Soma da comissão calculada" className="text-xs text-right" />
                </tr>
              </TableHeader>
              <TableBody>
                {sortedTicket.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-medium">{r.nome}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{r.propostas}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{fmtBRL(r.totalLiberado)}</TableCell>
                    <TableCell className="text-xs text-right font-mono font-bold">{fmtBRL(r.ticketMedio)}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{fmtBRL(r.comissaoTotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 2. Ranking Semanal */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg"><Medal className="w-5 h-5 text-yellow-500" /> Ranking Semanal</CardTitle>
          <CardDescription>Top vendedores por comissão na semana mais recente{rankingSemanal.week ? ` (${rankingSemanal.week})` : ''}.</CardDescription>
        </CardHeader>
        <CardContent>
          {rankingSemanal.rows.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">Sem dados de semana disponíveis.</p>
          ) : (
            <div className="border rounded-lg max-h-[400px] overflow-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <tr>
                    <TSHead label="#" sortKey="_rank" sort={sort} toggle={toggle} tooltip="Posição no ranking" className="text-xs w-10" />
                    <TSHead label="Vendedor" sortKey="nome" sort={sort} toggle={toggle} tooltip="Nome do vendedor" className="text-xs" />
                    <TSHead label="Comissão" sortKey="comissao" sort={sort} toggle={toggle} tooltip="Comissão total na semana" className="text-xs text-right" />
                    <TSHead label="Sem. Anterior" sortKey="anterior" sort={sort} toggle={toggle} tooltip="Comissão na semana anterior" className="text-xs text-right" />
                    <TSHead label="Variação" sortKey="variacao" sort={sort} toggle={toggle} tooltip="Variação percentual vs semana anterior" className="text-xs text-right" />
                  </tr>
                </TableHeader>
                <TableBody>
                  {rankingSemanal.rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-bold">{i + 1}º</TableCell>
                      <TableCell className="text-xs font-medium">{r.nome}</TableCell>
                      <TableCell className="text-xs text-right font-mono font-bold">{fmtBRL(r.comissao)}</TableCell>
                      <TableCell className="text-xs text-right font-mono text-muted-foreground">{fmtBRL(r.anterior)}</TableCell>
                      <TableCell className={`text-xs text-right font-mono ${r.variacao > 0 ? 'text-green-600' : r.variacao < 0 ? 'text-destructive' : ''}`}>
                        {r.variacao > 0 ? '+' : ''}{(r.variacao * 100).toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Mix de Produtos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg"><PieChart className="w-5 h-5" /> Mix de Produtos</CardTitle>
          <CardDescription>Distribuição percentual FGTS vs CLT por vendedor.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg max-h-[400px] overflow-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <tr>
                  <TSHead label="Vendedor" sortKey="nome" sort={sort} toggle={toggle} tooltip="Nome do vendedor" className="text-xs" />
                  <TSHead label="FGTS" sortKey="fgts" sort={sort} toggle={toggle} tooltip="Valor liberado em FGTS" className="text-xs text-right" />
                  <TSHead label="% FGTS" sortKey="pctFGTS" sort={sort} toggle={toggle} tooltip="Percentual do total em FGTS" className="text-xs text-right" />
                  <TSHead label="CLT" sortKey="clt" sort={sort} toggle={toggle} tooltip="Valor liberado em CLT" className="text-xs text-right" />
                  <TSHead label="% CLT" sortKey="pctCLT" sort={sort} toggle={toggle} tooltip="Percentual do total em CLT" className="text-xs text-right" />
                </tr>
              </TableHeader>
              <TableBody>
                {sortedMix.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-medium">{r.nome}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{fmtBRL(r.fgts)}</TableCell>
                    <TableCell className="text-xs text-right font-mono"><Badge variant="default" className="text-[10px]">{(r.pctFGTS * 100).toFixed(1)}%</Badge></TableCell>
                    <TableCell className="text-xs text-right font-mono">{fmtBRL(r.clt)}</TableCell>
                    <TableCell className="text-xs text-right font-mono"><Badge variant="secondary" className="text-[10px]">{(r.pctCLT * 100).toFixed(1)}%</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 4. Histórico de Taxas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg"><History className="w-5 h-5" /> Últimas Taxas Cadastradas</CardTitle>
          <CardDescription>Últimas 30 alterações nas tabelas de taxas CLT e FGTS (ordenado por data de criação).</CardDescription>
        </CardHeader>
        <CardContent>
          {rateHistory.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">Nenhuma taxa cadastrada ainda.</p>
          ) : (
            <div className="border rounded-lg max-h-[400px] overflow-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <tr>
                    <TSHead label="Tipo" sortKey="tipo" sort={sort} toggle={toggle} className="text-xs" />
                    <TSHead label="Banco" sortKey="banco" sort={sort} toggle={toggle} className="text-xs" />
                    <TSHead label="Vigência" sortKey="vigencia" sort={sort} toggle={toggle} className="text-xs" />
                    <TSHead label="Taxa" sortKey="taxa" sort={sort} toggle={toggle} className="text-xs" />
                    <TSHead label="Detalhes" sortKey="detalhe" sort={sort} toggle={toggle} className="text-xs" />
                    <TSHead label="Criado em" sortKey="criado" sort={sort} toggle={toggle} className="text-xs" />
                  </tr>
                </TableHeader>
                <TableBody>
                  {rateHistory.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs"><Badge variant={r.tipo === 'CLT' ? 'secondary' : 'default'} className="text-[10px]">{r.tipo}</Badge></TableCell>
                      <TableCell className="text-xs font-medium">{r.banco}</TableCell>
                      <TableCell className="text-xs font-mono">{r.vigencia}</TableCell>
                      <TableCell className="text-xs font-mono">{r.taxa}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{r.detalhe || '—'}</TableCell>
                      <TableCell className="text-xs font-mono">{new Date(r.criado).toLocaleDateString('pt-BR')}</TableCell>
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
