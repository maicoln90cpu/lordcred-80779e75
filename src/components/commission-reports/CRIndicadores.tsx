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
interface RelatorioRow {
  id: string; data_pago: string | null; num_contrato: string | null; produto: string | null;
  banco: string | null; prazo: number | null; tabela: string | null; valor_liberado: number | null;
  seguro: string | null; nome: string | null;
}
interface GeralRow { ade: string | null; cod_contrato: string | null; cms_rep: number | null; }
interface RepasseRow { ade: string | null; cod_contrato: string | null; cms_rep_favorecido: number | null; }
interface SeguroRow { descricao: string | null; valor_comissao: number | null; }
interface RuleFGTS { banco: string; tabela_chave: string; seguro: string; min_valor: number; max_valor: number; taxa: number; data_vigencia: string; }
interface RuleCLT { banco: string; tabela_chave: string; seguro: string; prazo_min: number; prazo_max: number; taxa: number; data_vigencia: string; }

// ==================== EXACT SAME FUNCTIONS FROM CRRelatorio ====================
function toSaoPauloDate(ts: string | null): string {
  if (!ts) return '';
  try { return new Date(ts).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }); }
  catch { return ts.slice(0, 10); }
}

function extractTableKeyFGTS(banco: string, tabela: string, seguro: string): string {
  const b = banco.toUpperCase();
  if (b.includes('PARANA') || b.includes('PARANÁ')) return seguro === 'Sim' ? 'SEGURO' : 'PARANA';
  if (b.includes('LOTUS')) { const lastChar = tabela.trim().slice(-1); return ` ${lastChar} `; }
  if (b.includes('HUB')) { const t = tabela.toUpperCase(); if (t.includes('SONHO')) return 'SONHO'; if (t.includes('FOCO')) return 'FOCO'; return 'CARTA NA M'; }
  if (b.includes('FACTA')) return tabela.toUpperCase().includes('PLUS') ? 'GOLD PLUS' : 'GOLD POWER';
  return '*';
}

function extractTableKeyCLT(banco: string, tabela: string): string {
  const b = banco.toUpperCase();
  if (b.includes('HUB')) {
    const t = tabela.toUpperCase();
    if (t.includes('36X COM SEGURO')) return '36X COM SEGURO';
    if (t.includes('FOCO')) return 'FOCO NO CORBAN';
    if (t.includes('SONHO')) return 'SONHO DO CLT';
    if (t.includes('48X')) return 'CONSIGNADO CLT 48x';
    return 'CARTADA CLT';
  }
  return '*';
}

function findFGTSRate(rules: RuleFGTS[], banco: string, lookupValue: number, tabelaChave: string, seguro: string, dataPgt: string | null): number {
  const b = banco.toUpperCase();
  const dt = dataPgt ? toSaoPauloDate(dataPgt) : '9999-12-31';
  const valid = rules.filter(r => r.banco.toUpperCase() === b && r.data_vigencia <= dt);
  if (!valid.length) return 0;
  const maxVig = valid.reduce((m, r) => r.data_vigencia > m ? r.data_vigencia : m, '0000-00-00');
  const atVig = valid.filter(r => r.data_vigencia === maxVig);
  let total = 0;
  for (const r of atVig) {
    const keyMatch = tabelaChave === '*' || r.tabela_chave === '*' || tabelaChave.toUpperCase().includes(r.tabela_chave.toUpperCase());
    const rangeMatch = lookupValue >= r.min_valor && lookupValue <= r.max_valor;
    const segMatch = r.seguro === seguro || r.seguro === 'Ambos';
    if (keyMatch && rangeMatch && segMatch) total += Number(r.taxa);
  }
  return total;
}

function findCLTRate(rules: RuleCLT[], banco: string, prazo: number, tabelaChave: string, seguro: string, dataPgt: string | null): number {
  const b = banco.toUpperCase();
  const dt = dataPgt ? toSaoPauloDate(dataPgt) : '9999-12-31';
  const valid = rules.filter(r => r.banco.toUpperCase() === b && r.data_vigencia <= dt);
  if (!valid.length) return 0;
  const maxVig = valid.reduce((m, r) => r.data_vigencia > m ? r.data_vigencia : m, '0000-00-00');
  const atVig = valid.filter(r => r.data_vigencia === maxVig);
  let total = 0;
  for (const r of atVig) {
    const keyMatch = tabelaChave === '*' || r.tabela_chave === '*' || tabelaChave.toUpperCase().includes(r.tabela_chave.toUpperCase());
    const rangeMatch = prazo >= r.prazo_min && prazo <= r.prazo_max;
    const segMatch = r.seguro === seguro || r.seguro === 'Ambos';
    if (keyMatch && rangeMatch && segMatch) total += Number(r.taxa);
  }
  return total;
}

function isMercantil(banco: string): boolean { return banco.toUpperCase().includes('MERCANTIL'); }

// ==================== COMPONENT ====================
export default function CRIndicadores() {
  const { sort, toggle } = useSortState();

  // PRIMARY: cr_relatorio (same source as CRRelatorio and CRResumo)
  const { data: relatorio = [], isLoading: l0 } = useQuery({
    queryKey: ['cr-relatorio-data'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('cr_relatorio').select('id, data_pago, num_contrato, produto, banco, prazo, tabela, valor_liberado, seguro, nome').limit(5000);
      return (data || []) as RelatorioRow[];
    }
  });

  const { data: geral = [] } = useQuery({ queryKey: ['cr-geral-report'], queryFn: async () => { const { data } = await supabase.from('cr_geral').select('ade, cod_contrato, cms_rep').limit(5000); return (data || []) as GeralRow[]; } });
  const { data: repasse = [] } = useQuery({ queryKey: ['cr-repasse-report'], queryFn: async () => { const { data } = await supabase.from('cr_repasse').select('ade, cod_contrato, cms_rep_favorecido').limit(5000); return (data || []) as RepasseRow[]; } });
  const { data: seguros = [] } = useQuery({ queryKey: ['cr-seguros-report'], queryFn: async () => { const { data } = await supabase.from('cr_seguros').select('descricao, valor_comissao').limit(5000); return (data || []) as SeguroRow[]; } });
  const { data: rulesFGTS = [] } = useQuery({ queryKey: ['cr-rules-fgts'], queryFn: async () => { const { data } = await supabase.from('cr_rules_fgts').select('*').order('data_vigencia', { ascending: false }); return (data || []) as RuleFGTS[]; } });
  const { data: rulesCLT = [] } = useQuery({ queryKey: ['cr-rules-clt'], queryFn: async () => { const { data } = await supabase.from('cr_rules_clt').select('*').order('data_vigencia', { ascending: false }); return (data || []) as RuleCLT[]; } });

  const isLoading = l0;

  // Lookup maps
  const geralByContract = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of geral) { const key = g.ade || g.cod_contrato || ''; if (key) map.set(key, (map.get(key) || 0) + (g.cms_rep || 0)); }
    return map;
  }, [geral]);

  const repasseByContract = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of repasse) { const key = r.ade || r.cod_contrato || ''; if (key) map.set(key, (map.get(key) || 0) + (r.cms_rep_favorecido || 0)); }
    return map;
  }, [repasse]);

  const seguroByAde = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of seguros) {
      if (!s.descricao) continue;
      const desc = s.descricao.toUpperCase();
      const adeMatch = desc.match(/ADE\s+(\d+)/);
      if (adeMatch) { const ade = adeMatch[1]; map.set(ade, (map.get(ade) || 0) + (s.valor_comissao || 0)); }
    }
    return map;
  }, [seguros]);

  // Calculate per contract using cr_relatorio + exact same logic
  const contractData = useMemo(() => {
    return relatorio.map(r => {
      const contrato = r.num_contrato || '';
      const banco = (r.banco || '').toUpperCase();
      const produto = (r.produto || '').toUpperCase();
      const tabela = r.tabela || '';
      const valor = r.valor_liberado || 0;
      const prazo = r.prazo || 0;
      const seguro = r.seguro || 'Não';
      const dataPago = r.data_pago || null;

      const valorAssegurado = isMercantil(banco) ? Math.round(valor / 0.7 * 100) / 100 : 0;
      const valorCalc = isMercantil(banco) ? valorAssegurado : valor;

      const cmsGeral = geralByContract.get(contrato) || 0;
      const cmsRepasse = repasseByContract.get(contrato) || 0;
      const cmsSeguro = seguroByAde.get(contrato) || 0;
      const recebida = cmsGeral + cmsRepasse + cmsSeguro;

      let esperada = 0;
      const isProdFGTS = produto.includes('FGTS');

      if (isProdFGTS) {
        const tabelaChave = extractTableKeyFGTS(banco, tabela, seguro);
        const isHub = banco.includes('HUB');
        const lookupValue = isHub ? valor : prazo;
        const rate = findFGTSRate(rulesFGTS, banco, lookupValue, tabelaChave, seguro, dataPago);
        esperada = Math.round(valor * rate / 100 * 100) / 100;
      } else {
        const tabelaChave = extractTableKeyCLT(banco, tabela);
        esperada = Math.round(valorCalc * findCLTRate(rulesCLT, banco, prazo, tabelaChave, seguro, dataPago) / 100 * 100) / 100;
      }

      const diferenca = Math.round((recebida - esperada) * 100) / 100;
      return { banco, valor, recebida, esperada, diferenca };
    });
  }, [relatorio, geralByContract, repasseByContract, seguroByAde, rulesFGTS, rulesCLT]);

  // 1. Acurácia por Banco
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

  // 2. Perda Acumulada
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

  // 3. Taxa Média
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
  if (relatorio.length === 0) return <p className="text-center text-muted-foreground py-8 text-sm">Importe dados na aba Relatório (Import) primeiro.</p>;

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
          <p className="text-xs text-muted-foreground">Fonte: Relatório (cr_relatorio)</p>
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
            <Table className="min-w-[600px]">
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
            <Table className="min-w-[600px]">
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
            <Table className="min-w-[700px]">
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
