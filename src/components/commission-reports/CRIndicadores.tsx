import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { TSHead, useSortState, applySortToData } from './CRSortUtils';
import { TooltipProvider } from '@/components/ui/tooltip';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;

// ==================== TYPES ====================
interface GeralRow { ade: string | null; banco: string | null; prod_liq: number | null; prazo: number | null; tipo_operacao: string | null; convenio: string | null; cms_rep: number | null; data_pgt_cliente: string | null; }
interface RepasseRow { ade: string | null; cms_rep_favorecido: number | null; }
interface SeguroRow { descricao: string | null; valor_comissao: number | null; }
interface RuleFGTS { banco: string; tabela_chave: string; seguro: string; min_valor: number; max_valor: number; taxa: number; data_vigencia: string; }
interface RuleCLT { banco: string; tabela_chave: string; seguro: string; prazo_min: number; prazo_max: number; taxa: number; data_vigencia: string; }

// ==================== CALCULATION HELPERS ====================
function identifyProduct(tipo: string | null, convenio: string | null): string {
  const t = (tipo || '').toUpperCase(); const c = (convenio || '').toUpperCase();
  if (t.includes('FGTS') || c.includes('FGTS')) return 'FGTS'; return 'CLT';
}
function hasInsuranceFn(convenio: string | null): boolean {
  const c = (convenio || '').toUpperCase();
  return c.includes('SEGURO') || c.includes('COM SEG') || c.includes('C/SEG');
}
// SUMIFS-style: find max vigencia, then sum all matching rates
function findFGTSRate(rules: RuleFGTS[], banco: string, lookupValue: number, tabela: string, temSeguro: boolean, dt: string): number {
  const b = banco.toUpperCase();
  const valid = rules.filter(r => r.banco.toUpperCase() === b && r.data_vigencia <= dt);
  if (!valid.length) return 0;
  const maxVig = valid.reduce((m, r) => r.data_vigencia > m ? r.data_vigencia : m, '0000-00-00');
  const atVig = valid.filter(r => r.data_vigencia === maxVig);
  const seguro = temSeguro ? 'Sim' : 'Não';
  let total = 0;
  for (const r of atVig) {
    const keyMatch = tabela === '*' || r.tabela_chave === '*' || tabela.toUpperCase().includes(r.tabela_chave.toUpperCase());
    const rangeMatch = lookupValue >= r.min_valor && lookupValue <= r.max_valor;
    const segMatch = r.seguro === seguro || r.seguro === 'Ambos';
    if (keyMatch && rangeMatch && segMatch) total += Number(r.taxa);
  }
  return total;
}
function findCLTRate(rules: RuleCLT[], banco: string, prazo: number, tabela: string, temSeguro: boolean, dt: string): number {
  const b = banco.toUpperCase();
  const valid = rules.filter(r => r.banco.toUpperCase() === b && r.data_vigencia <= dt);
  if (!valid.length) return 0;
  const maxVig = valid.reduce((m, r) => r.data_vigencia > m ? r.data_vigencia : m, '0000-00-00');
  const atVig = valid.filter(r => r.data_vigencia === maxVig);
  const seguro = temSeguro ? 'Sim' : 'Não';
  let total = 0;
  for (const r of atVig) {
    const keyMatch = tabela === '*' || r.tabela_chave === '*' || tabela.toUpperCase().includes(r.tabela_chave.toUpperCase());
    const rangeMatch = prazo >= r.prazo_min && prazo <= r.prazo_max;
    const segMatch = r.seguro === seguro || r.seguro === 'Ambos';
    if (keyMatch && rangeMatch && segMatch) total += Number(r.taxa);
  }
  return total;
}

// ==================== COMPONENT ====================
export default function CRIndicadores() {
  const { sort, toggle } = useSortState();

  const { data: geral = [], isLoading: l1 } = useQuery({ queryKey: ['cr-geral-ind'], queryFn: async () => { const { data } = await supabase.from('cr_geral').select('ade, banco, prod_liq, prazo, tipo_operacao, convenio, cms_rep, data_pgt_cliente').limit(5000); return (data || []) as GeralRow[]; } });
  const { data: repasse = [] } = useQuery({ queryKey: ['cr-repasse-ind'], queryFn: async () => { const { data } = await supabase.from('cr_repasse').select('ade, cms_rep_favorecido').limit(5000); return (data || []) as RepasseRow[]; } });
  const { data: seguros = [] } = useQuery({ queryKey: ['cr-seguros-ind'], queryFn: async () => { const { data } = await supabase.from('cr_seguros').select('descricao, valor_comissao').limit(5000); return (data || []) as SeguroRow[]; } });
  const { data: rulesFGTS = [] } = useQuery({ queryKey: ['cr-rules-fgts'], queryFn: async () => { const { data } = await supabase.from('cr_rules_fgts').select('*').order('data_vigencia', { ascending: false }); return (data || []) as RuleFGTS[]; } });
  const { data: rulesCLT = [] } = useQuery({ queryKey: ['cr-rules-clt'], queryFn: async () => { const { data } = await supabase.from('cr_rules_clt').select('*').order('data_vigencia', { ascending: false }); return (data || []) as RuleCLT[]; } });

  const isLoading = l1;

  // Build lookup maps
  const repasseMap = useMemo(() => { const m = new Map<string, number>(); for (const r of repasse) if (r.ade) m.set(r.ade, (m.get(r.ade) || 0) + (r.cms_rep_favorecido || 0)); return m; }, [repasse]);
  const seguroMap = useMemo(() => { const m = new Map<string, number>(); for (const s of seguros) if (s.descricao) { for (const g of geral) if (g.ade && s.descricao.toUpperCase().includes(g.ade.toUpperCase())) m.set(g.ade, (m.get(g.ade) || 0) + (s.valor_comissao || 0)); } return m; }, [seguros, geral]);

  // Calculate real expected vs received for each contract
  const contractData = useMemo(() => {
    return geral.map(g => {
      const banco = (g.banco || '').toUpperCase();
      const valor = g.prod_liq || 0;
      const prazo = g.prazo || 0;
      const produto = identifyProduct(g.tipo_operacao, g.convenio);
      const temSeguro = hasInsuranceFn(g.convenio);
      const tabela = (g.convenio || '*').trim();
      const isMerc = banco.includes('MERCANTIL');
      const valorCalc = isMerc ? Math.round(valor / 0.7 * 100) / 100 : valor;
      const dt = g.data_pgt_cliente ? g.data_pgt_cliente.slice(0, 10) : '9999-12-31';

      const cmsGeral = g.cms_rep || 0;
      const cmsRepasse = repasseMap.get(g.ade || '') || 0;
      const cmsSeguro = seguroMap.get(g.ade || '') || 0;
      const recebida = cmsGeral + cmsRepasse + cmsSeguro;

      let esperada = 0;
      if (produto === 'FGTS') {
        esperada = Math.round(valorCalc * findFGTSRate(rulesFGTS, banco, valorCalc, tabela, temSeguro, dt) / 100 * 100) / 100;
      } else {
        esperada = Math.round(valorCalc * findCLTRate(rulesCLT, banco, prazo, tabela, temSeguro, dt) / 100 * 100) / 100;
      }
      const diferenca = Math.round((recebida - esperada) * 100) / 100;

      return { banco, valor, recebida, esperada, diferenca };
    });
  }, [geral, repasseMap, seguroMap, rulesFGTS, rulesCLT]);

  // 1. Acurácia por Banco: % contratos com |esperada - recebida| < R$1
  const acuraciaByBanco = useMemo(() => {
    const stats = new Map<string, { total: number; accurate: number }>();
    for (const c of contractData) {
      const s = stats.get(c.banco) || { total: 0, accurate: 0 };
      s.total++;
      if (Math.abs(c.diferenca) < 1) s.accurate++;
      stats.set(c.banco, s);
    }
    return Array.from(stats.entries()).map(([banco, s]) => ({
      banco, total: s.total, accurate: s.accurate, pct: s.total > 0 ? s.accurate / s.total : 0,
    }));
  }, [contractData]);

  // 2. Perda Acumulada: sum of negative divergences (recebida < esperada)
  const perdaByBanco = useMemo(() => {
    const stats = new Map<string, { perda: number; ganho: number; count: number }>();
    for (const c of contractData) {
      const s = stats.get(c.banco) || { perda: 0, ganho: 0, count: 0 };
      s.count++;
      if (c.diferenca < -0.01) s.perda += Math.abs(c.diferenca);
      else if (c.diferenca > 0.01) s.ganho += c.diferenca;
      stats.set(c.banco, s);
    }
    return Array.from(stats.entries()).map(([banco, s]) => ({
      banco, perda: Math.round(s.perda * 100) / 100, ganho: Math.round(s.ganho * 100) / 100, count: s.count,
    }));
  }, [contractData]);

  // 3. Taxa Média Recebida vs Esperada (real per-contract)
  const taxaMedia = useMemo(() => {
    const stats = new Map<string, { somaRecebida: number; somaEsperada: number; somaValor: number; count: number }>();
    for (const c of contractData) {
      if (c.valor <= 0) continue;
      const s = stats.get(c.banco) || { somaRecebida: 0, somaEsperada: 0, somaValor: 0, count: 0 };
      s.somaRecebida += c.recebida;
      s.somaEsperada += c.esperada;
      s.somaValor += c.valor;
      s.count++;
      stats.set(c.banco, s);
    }
    return Array.from(stats.entries()).map(([banco, s]) => ({
      banco,
      taxaRecebida: s.somaValor > 0 ? s.somaRecebida / s.somaValor : 0,
      taxaEsperada: s.somaValor > 0 ? s.somaEsperada / s.somaValor : 0,
      contratos: s.count,
      delta: s.somaValor > 0 ? (s.somaRecebida - s.somaEsperada) / s.somaValor : 0,
    }));
  }, [contractData]);

  const sortedAcuracia = applySortToData(acuraciaByBanco, sort);
  const sortedPerda = applySortToData(perdaByBanco, sort);
  const sortedTaxa = applySortToData(taxaMedia, sort);

  // Global KPIs
  const globalKpis = useMemo(() => {
    const total = contractData.length;
    const accurate = contractData.filter(c => Math.abs(c.diferenca) < 1).length;
    const perdaTotal = contractData.filter(c => c.diferenca < -0.01).reduce((s, c) => s + Math.abs(c.diferenca), 0);
    return { total, accurate, acuracia: total > 0 ? accurate / total : 0, perdaTotal: Math.round(perdaTotal * 100) / 100 };
  }, [contractData]);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (geral.length === 0) return <p className="text-center text-muted-foreground py-8 text-sm">Importe dados nas abas Geral e Repasse primeiro.</p>;

  return (
    <TooltipProvider delayDuration={300}>
    <div className="space-y-6">
      {/* Global KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><Target className="w-4 h-4" /> Acurácia Global</div>
          <p className="text-2xl font-bold">{(globalKpis.acuracia * 100).toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground">{globalKpis.accurate} de {globalKpis.total} contratos com |Δ| &lt; R$1</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><TrendingDown className="w-4 h-4 text-destructive" /> Perda Acumulada</div>
          <p className="text-2xl font-bold text-destructive">{fmtBRL(globalKpis.perdaTotal)}</p>
          <p className="text-xs text-muted-foreground">Soma das divergências negativas (recebeu menos)</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><TrendingUp className="w-4 h-4" /> Contratos Analisados</div>
          <p className="text-2xl font-bold">{globalKpis.total}</p>
          <p className="text-xs text-muted-foreground">Cruzados com regras FGTS/CLT</p>
        </CardContent></Card>
      </div>

      {/* Card 1: Acurácia por Banco */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg"><Target className="w-5 h-5" /> Acurácia por Banco</CardTitle>
          <CardDescription>% de contratos onde |Recebida − Esperada| &lt; R$1,00 (comissão correta).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <tr>
                  <TSHead label="Banco" sortKey="banco" sort={sort} toggle={toggle} tooltip="Nome do banco" className="text-xs" />
                  <TSHead label="Contratos" sortKey="total" sort={sort} toggle={toggle} tooltip="Total de contratos" className="text-xs text-right" />
                  <TSHead label="Corretos" sortKey="accurate" sort={sort} toggle={toggle} tooltip="Contratos com |Δ| < R$1" className="text-xs text-right" />
                  <TSHead label="Acurácia" sortKey="pct" sort={sort} toggle={toggle} tooltip="% corretos sobre total" className="text-xs text-right" />
                </tr>
              </TableHeader>
              <TableBody>
                {sortedAcuracia.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-medium">{r.banco}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{r.total}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{r.accurate}</TableCell>
                    <TableCell className="text-xs text-right font-mono">
                      <Badge variant={r.pct >= 0.9 ? 'default' : r.pct >= 0.7 ? 'secondary' : 'destructive'} className="text-[10px]">
                        {(r.pct * 100).toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Perda Acumulada */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg"><TrendingDown className="w-5 h-5 text-destructive" /> Perda Acumulada por Banco</CardTitle>
          <CardDescription>Soma real das divergências negativas (Recebida − Esperada &lt; 0) por banco.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <tr>
                  <TSHead label="Banco" sortKey="banco" sort={sort} toggle={toggle} tooltip="Nome do banco" className="text-xs" />
                  <TSHead label="Contratos" sortKey="count" sort={sort} toggle={toggle} tooltip="Quantidade de contratos" className="text-xs text-right" />
                  <TSHead label="Ganho (Δ+)" sortKey="ganho" sort={sort} toggle={toggle} tooltip="Soma divergências positivas (recebeu mais)" className="text-xs text-right" />
                  <TSHead label="Perda (Δ−)" sortKey="perda" sort={sort} toggle={toggle} tooltip="Soma divergências negativas (recebeu menos)" className="text-xs text-right" />
                </tr>
              </TableHeader>
              <TableBody>
                {sortedPerda.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-medium">{r.banco}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{r.count}</TableCell>
                    <TableCell className="text-xs text-right font-mono text-green-600">{fmtBRL(r.ganho)}</TableCell>
                    <TableCell className="text-xs text-right font-mono text-destructive">{fmtBRL(r.perda)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Taxa Média Real */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg"><TrendingUp className="w-5 h-5" /> Taxa Média: Recebida vs Esperada</CardTitle>
          <CardDescription>Taxa efetiva (CMS/Valor) calculada por contrato vs taxa esperada pelas regras.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <tr>
                  <TSHead label="Banco" sortKey="banco" sort={sort} toggle={toggle} tooltip="Nome do banco" className="text-xs" />
                  <TSHead label="Contratos" sortKey="contratos" sort={sort} toggle={toggle} tooltip="Contratos com valor > 0" className="text-xs text-right" />
                  <TSHead label="Taxa Recebida" sortKey="taxaRecebida" sort={sort} toggle={toggle} tooltip="CMS total / Valor total" className="text-xs text-right" />
                  <TSHead label="Taxa Esperada" sortKey="taxaEsperada" sort={sort} toggle={toggle} tooltip="CMS esperada / Valor total" className="text-xs text-right" />
                  <TSHead label="Delta" sortKey="delta" sort={sort} toggle={toggle} tooltip="Recebida − Esperada" className="text-xs text-right" />
                </tr>
              </TableHeader>
              <TableBody>
                {sortedTaxa.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-medium">{r.banco}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{r.contratos}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{fmtPct(r.taxaRecebida)}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{fmtPct(r.taxaEsperada)}</TableCell>
                    <TableCell className={`text-xs text-right font-mono font-bold ${r.delta > 0 ? 'text-green-600' : r.delta < 0 ? 'text-destructive' : ''}`}>
                      {r.delta > 0 ? '+' : ''}{fmtPct(r.delta)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
    </TooltipProvider>
  );
}
