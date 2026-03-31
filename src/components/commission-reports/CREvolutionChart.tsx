import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function toSaoPauloMonth(ts: string | null): string {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    const sp = d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' });
    return sp.slice(0, 7); // YYYY-MM
  } catch { return ts.slice(0, 7); }
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
  '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
};

// ==================== EXACT SAME CALC FUNCTIONS ====================
function toSaoPauloDate(ts: string | null): string {
  if (!ts) return '';
  try { return new Date(ts).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }); }
  catch { return ts.slice(0, 10); }
}

function extractTableKeyFGTS(banco: string, tabela: string, seguro: string): string {
  const b = banco.toUpperCase();
  if (b.includes('PARANA') || b.includes('PARANÁ')) return seguro === 'Sim' ? 'SEGURO' : 'PARANA';
  if (b.includes('LOTUS')) return ` ${tabela.trim().slice(-1)} `;
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

interface Rule { banco: string; tabela_chave: string; seguro: string; taxa: number; data_vigencia: string; }
interface RuleFGTS extends Rule { min_valor: number; max_valor: number; }
interface RuleCLT extends Rule { prazo_min: number; prazo_max: number; }

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
interface RelatorioRow {
  data_pago: string | null; num_contrato: string | null; produto: string | null;
  banco: string | null; prazo: number | null; tabela: string | null; valor_liberado: number | null;
  seguro: string | null;
}
interface GeralRow { ade: string | null; cod_contrato: string | null; cms_rep: number | null; }
interface RepasseRow { ade: string | null; cod_contrato: string | null; cms_rep_favorecido: number | null; }
interface SeguroRow { descricao: string | null; valor_comissao: number | null; }

export default function CREvolutionChart() {
  const { data: relatorio = [], isLoading: l0 } = useQuery({
    queryKey: ['cr-relatorio-data'],
    queryFn: async () => {
      const { data } = await (supabase as any).from('cr_relatorio').select('data_pago, num_contrato, produto, banco, prazo, tabela, valor_liberado, seguro').limit(5000);
      return (data || []) as RelatorioRow[];
    }
  });
  const { data: geral = [] } = useQuery({ queryKey: ['cr-geral-report'], queryFn: async () => { const { data } = await supabase.from('cr_geral').select('ade, cod_contrato, cms_rep').limit(5000); return (data || []) as GeralRow[]; } });
  const { data: repasse = [] } = useQuery({ queryKey: ['cr-repasse-report'], queryFn: async () => { const { data } = await supabase.from('cr_repasse').select('ade, cod_contrato, cms_rep_favorecido').limit(5000); return (data || []) as RepasseRow[]; } });
  const { data: seguros = [] } = useQuery({ queryKey: ['cr-seguros-report'], queryFn: async () => { const { data } = await supabase.from('cr_seguros').select('descricao, valor_comissao').limit(5000); return (data || []) as SeguroRow[]; } });
  const { data: rulesFGTS = [] } = useQuery({ queryKey: ['cr-rules-fgts'], queryFn: async () => { const { data } = await supabase.from('cr_rules_fgts').select('*').order('data_vigencia', { ascending: false }); return (data || []) as RuleFGTS[]; } });
  const { data: rulesCLT = [] } = useQuery({ queryKey: ['cr-rules-clt'], queryFn: async () => { const { data } = await supabase.from('cr_rules_clt').select('*').order('data_vigencia', { ascending: false }); return (data || []) as RuleCLT[]; } });

  const geralMap = useMemo(() => { const m = new Map<string, number>(); for (const g of geral) { const k = g.ade || g.cod_contrato || ''; if (k) m.set(k, (m.get(k) || 0) + (g.cms_rep || 0)); } return m; }, [geral]);
  const repasseMap = useMemo(() => { const m = new Map<string, number>(); for (const r of repasse) { const k = r.ade || r.cod_contrato || ''; if (k) m.set(k, (m.get(k) || 0) + (r.cms_rep_favorecido || 0)); } return m; }, [repasse]);
  const seguroMap = useMemo(() => { const m = new Map<string, number>(); for (const s of seguros) { if (!s.descricao) continue; const match = s.descricao.toUpperCase().match(/ADE\s+(\d+)/); if (match) m.set(match[1], (m.get(match[1]) || 0) + (s.valor_comissao || 0)); } return m; }, [seguros]);

  const chartData = useMemo(() => {
    const byMonth = new Map<string, { esperada: number; recebida: number; count: number }>();

    for (const r of relatorio) {
      const month = toSaoPauloMonth(r.data_pago);
      if (!month) continue;
      const contrato = r.num_contrato || '';
      const banco = (r.banco || '').toUpperCase();
      const produto = (r.produto || '').toUpperCase();
      const tabela = r.tabela || '';
      const valor = r.valor_liberado || 0;
      const prazo = r.prazo || 0;
      const seguro = r.seguro || 'Não';
      const dataPago = r.data_pago || null;

      const valorCalc = isMercantil(banco) ? Math.round(valor / 0.7 * 100) / 100 : valor;
      const recebida = (geralMap.get(contrato) || 0) + (repasseMap.get(contrato) || 0) + (seguroMap.get(contrato) || 0);

      let esperada = 0;
      if (produto.includes('FGTS')) {
        const tk = extractTableKeyFGTS(banco, tabela, seguro);
        const isHub = banco.includes('HUB');
        esperada = Math.round(valor * findFGTSRate(rulesFGTS, banco, isHub ? valor : prazo, tk, seguro, dataPago) / 100 * 100) / 100;
      } else if (produto.includes('TRABALHADOR')) {
        const tk = extractTableKeyCLT(banco, tabela);
        esperada = Math.round(valorCalc * findCLTRate(rulesCLT, banco, prazo, tk, seguro, dataPago) / 100 * 100) / 100;
      }

      const entry = byMonth.get(month) || { esperada: 0, recebida: 0, count: 0 };
      entry.esperada += esperada;
      entry.recebida += recebida;
      entry.count++;
      byMonth.set(month, entry);
    }

    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]) => {
        const [y, m] = month.split('-');
        return {
          month: `${MONTH_LABELS[m] || m}/${y.slice(2)}`,
          Esperada: Math.round(d.esperada * 100) / 100,
          Recebida: Math.round(d.recebida * 100) / 100,
          Diferença: Math.round((d.recebida - d.esperada) * 100) / 100,
          count: d.count,
        };
      });
  }, [relatorio, geralMap, repasseMap, seguroMap, rulesFGTS, rulesCLT]);

  if (l0) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (chartData.length === 0) return <p className="text-center text-muted-foreground py-6 text-sm">Sem dados para gráfico de evolução.</p>;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Evolução Mensal: Esperada vs Recebida</CardTitle>
        <CardDescription>Comparação mensal das comissões calculadas vs efetivamente recebidas</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
            <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
            <Tooltip
              formatter={(value: number) => fmtBRL(value)}
              labelFormatter={(label) => `Mês: ${label}`}
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Esperada" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Recebida" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
