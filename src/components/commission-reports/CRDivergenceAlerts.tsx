import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

// Same calc functions
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

function findFGTSRate(rules: RuleFGTS[], banco: string, lv: number, tk: string, seg: string, dp: string | null): number {
  const b = banco.toUpperCase(); const dt = dp ? toSaoPauloDate(dp) : '9999-12-31';
  const v = rules.filter(r => r.banco.toUpperCase() === b && r.data_vigencia <= dt);
  if (!v.length) return 0;
  const mx = v.reduce((m, r) => r.data_vigencia > m ? r.data_vigencia : m, '0000-00-00');
  let t = 0;
  for (const r of v.filter(r => r.data_vigencia === mx)) {
    if ((tk === '*' || r.tabela_chave === '*' || tk.toUpperCase().includes(r.tabela_chave.toUpperCase())) && lv >= r.min_valor && lv <= r.max_valor && (r.seguro === seg || r.seguro === 'Ambos')) t += Number(r.taxa);
  }
  return t;
}
function findCLTRate(rules: RuleCLT[], banco: string, prazo: number, tk: string, seg: string, dp: string | null): number {
  const b = banco.toUpperCase(); const dt = dp ? toSaoPauloDate(dp) : '9999-12-31';
  const v = rules.filter(r => r.banco.toUpperCase() === b && r.data_vigencia <= dt);
  if (!v.length) return 0;
  const mx = v.reduce((m, r) => r.data_vigencia > m ? r.data_vigencia : m, '0000-00-00');
  let t = 0;
  for (const r of v.filter(r => r.data_vigencia === mx)) {
    if ((tk === '*' || r.tabela_chave === '*' || tk.toUpperCase().includes(r.tabela_chave.toUpperCase())) && prazo >= r.prazo_min && prazo <= r.prazo_max && (r.seguro === seg || r.seguro === 'Ambos')) t += Number(r.taxa);
  }
  return t;
}
function isMercantil(banco: string) { return banco.toUpperCase().includes('MERCANTIL'); }

interface RelatorioRow {
  num_contrato: string | null; produto: string | null; banco: string | null; prazo: number | null;
  tabela: string | null; valor_liberado: number | null; seguro: string | null; data_pago: string | null;
}
interface GeralRow { ade: string | null; cod_contrato: string | null; cms_rep: number | null; }
interface RepasseRow { ade: string | null; cod_contrato: string | null; cms_rep_favorecido: number | null; }
interface SeguroRow { descricao: string | null; valor_comissao: number | null; }

const THRESHOLD = 0.05; // 5%

export default function CRDivergenceAlerts() {
  const { data: relatorio = [], isLoading } = useQuery({
    queryKey: ['cr-relatorio-data'],
    queryFn: async () => { const { data } = await (supabase as any).from('cr_relatorio').select('num_contrato, produto, banco, prazo, tabela, valor_liberado, seguro, data_pago').limit(5000); return (data || []) as RelatorioRow[]; }
  });
  const { data: geral = [] } = useQuery({ queryKey: ['cr-geral-report'], queryFn: async () => { const { data } = await supabase.from('cr_geral').select('ade, cod_contrato, cms_rep').limit(5000); return (data || []) as GeralRow[]; } });
  const { data: repasse = [] } = useQuery({ queryKey: ['cr-repasse-report'], queryFn: async () => { const { data } = await supabase.from('cr_repasse').select('ade, cod_contrato, cms_rep_favorecido').limit(5000); return (data || []) as RepasseRow[]; } });
  const { data: seguros = [] } = useQuery({ queryKey: ['cr-seguros-report'], queryFn: async () => { const { data } = await supabase.from('cr_seguros').select('descricao, valor_comissao').limit(5000); return (data || []) as SeguroRow[]; } });
  const { data: rulesFGTS = [] } = useQuery({ queryKey: ['cr-rules-fgts'], queryFn: async () => { const { data } = await supabase.from('cr_rules_fgts').select('*').order('data_vigencia', { ascending: false }); return (data || []) as RuleFGTS[]; } });
  const { data: rulesCLT = [] } = useQuery({ queryKey: ['cr-rules-clt'], queryFn: async () => { const { data } = await supabase.from('cr_rules_clt').select('*').order('data_vigencia', { ascending: false }); return (data || []) as RuleCLT[]; } });

  const geralMap = useMemo(() => { const m = new Map<string, number>(); for (const g of geral) { const k = g.ade || g.cod_contrato || ''; if (k) m.set(k, (m.get(k) || 0) + (g.cms_rep || 0)); } return m; }, [geral]);
  const repasseMap = useMemo(() => { const m = new Map<string, number>(); for (const r of repasse) { const k = r.ade || r.cod_contrato || ''; if (k) m.set(k, (m.get(k) || 0) + (r.cms_rep_favorecido || 0)); } return m; }, [repasse]);
  const seguroMap = useMemo(() => { const m = new Map<string, number>(); for (const s of seguros) { if (!s.descricao) continue; const match = s.descricao.toUpperCase().match(/ADE\s+(\d+)/); if (match) m.set(match[1], (m.get(match[1]) || 0) + (s.valor_comissao || 0)); } return m; }, [seguros]);

  const alerts = useMemo(() => {
    const byBanco = new Map<string, { esperada: number; recebida: number; count: number }>();
    for (const r of relatorio) {
      const contrato = r.num_contrato || '';
      const banco = (r.banco || '').toUpperCase();
      const produto = (r.produto || '').toUpperCase();
      const valor = r.valor_liberado || 0;
      const prazo = r.prazo || 0;
      const seguro = r.seguro || 'Não';
      const tabela = r.tabela || '';
      const dataPago = r.data_pago || null;
      const valorCalc = isMercantil(banco) ? Math.round(valor / 0.7 * 100) / 100 : valor;
      const recebida = (geralMap.get(contrato) || 0) + (repasseMap.get(contrato) || 0) + (seguroMap.get(contrato) || 0);

      let esperada = 0;
      if (produto.includes('FGTS')) {
        const tk = extractTableKeyFGTS(banco, tabela, seguro);
        esperada = Math.round(valor * findFGTSRate(rulesFGTS, banco, banco.includes('HUB') ? valor : prazo, tk, seguro, dataPago) / 100 * 100) / 100;
      } else if (produto.includes('TRABALHADOR')) {
        esperada = Math.round(valorCalc * findCLTRate(rulesCLT, banco, prazo, extractTableKeyCLT(banco, tabela), seguro, dataPago) / 100 * 100) / 100;
      }

      const entry = byBanco.get(banco) || { esperada: 0, recebida: 0, count: 0 };
      entry.esperada += esperada;
      entry.recebida += recebida;
      entry.count++;
      byBanco.set(banco, entry);
    }

    return Array.from(byBanco.entries())
      .map(([banco, d]) => {
        const diff = d.recebida - d.esperada;
        const pctDiff = d.esperada > 0 ? Math.abs(diff) / d.esperada : 0;
        return { banco, ...d, diff: Math.round(diff * 100) / 100, pctDiff, alert: pctDiff > THRESHOLD };
      })
      .sort((a, b) => b.pctDiff - a.pctDiff);
  }, [relatorio, geralMap, repasseMap, seguroMap, rulesFGTS, rulesCLT]);

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  const alertBanks = alerts.filter(a => a.alert);
  const okBanks = alerts.filter(a => !a.alert);

  if (alerts.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          Alertas de Divergência por Banco
        </CardTitle>
        <CardDescription>Bancos com divergência acumulada &gt; 5% entre esperada e recebida</CardDescription>
      </CardHeader>
      <CardContent>
        {alertBanks.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            Nenhum banco com divergência &gt; 5%. Todos dentro da tolerância.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {alertBanks.map(a => (
              <div key={a.banco} className="border rounded-lg p-3 bg-destructive/5 border-destructive/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold">{a.banco}</span>
                  <Badge variant="destructive" className="text-[10px]">
                    {fmtPct(a.pctDiff)} desvio
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  <span>Esperada: {fmtBRL(a.esperada)}</span>
                  <span>Recebida: {fmtBRL(a.recebida)}</span>
                </div>
                <div className={`text-xs font-semibold mt-1 ${a.diff < 0 ? 'text-destructive' : 'text-green-600'}`}>
                  Δ {fmtBRL(a.diff)} ({a.count} contratos)
                </div>
              </div>
            ))}
          </div>
        )}
        {okBanks.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {okBanks.map(a => (
              <Badge key={a.banco} variant="secondary" className="text-[10px] gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                {a.banco} ({fmtPct(a.pctDiff)})
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
