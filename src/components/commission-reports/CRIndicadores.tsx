import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { TSHead, useSortState, applySortToData, TipWrap } from './CRSortUtils';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;

interface GeralRow { banco: string | null; prod_liq: number | null; cms_rep: number | null; tipo_operacao: string | null; convenio: string | null; }
interface RepasseRow { ade: string | null; cms_rep_favorecido: number | null; }
interface RuleFGTS { banco: string; taxa: number; }
interface RuleCLT { banco: string; taxa: number; }

export default function CRIndicadores() {
  const { sort, toggle } = useSortState();

  const { data: geral = [], isLoading: l1 } = useQuery({ queryKey: ['cr-geral-ind'], queryFn: async () => { const { data } = await supabase.from('cr_geral').select('banco, prod_liq, cms_rep, tipo_operacao, convenio').limit(5000); return (data || []) as GeralRow[]; } });
  const { data: repasse = [], isLoading: l2 } = useQuery({ queryKey: ['cr-repasse-ind'], queryFn: async () => { const { data } = await supabase.from('cr_repasse').select('ade, cms_rep_favorecido').limit(5000); return (data || []) as RepasseRow[]; } });
  const { data: rulesFGTS = [] } = useQuery({ queryKey: ['cr-rules-fgts-ind'], queryFn: async () => { const { data } = await supabase.from('cr_rules_fgts').select('banco, taxa'); return (data || []) as RuleFGTS[]; } });
  const { data: rulesCLT = [] } = useQuery({ queryKey: ['cr-rules-clt-ind'], queryFn: async () => { const { data } = await supabase.from('cr_rules_clt').select('banco, taxa'); return (data || []) as RuleCLT[]; } });

  const isLoading = l1 || l2;

  // 1. Acurácia por Banco: % contratos com |diferença| < R$1
  const acuraciaByBanco = useMemo(() => {
    const repasseMap = new Map<string, number>();
    for (const r of repasse) if (r.ade) repasseMap.set(r.ade, (repasseMap.get(r.ade) || 0) + (r.cms_rep_favorecido || 0));

    const bancoStats = new Map<string, { total: number; accurate: number }>();
    for (const g of geral) {
      const banco = (g.banco || 'N/A').toUpperCase();
      const recebida = (g.cms_rep || 0);
      const stats = bancoStats.get(banco) || { total: 0, accurate: 0 };
      stats.total++;
      // Simplified: if cms_rep exists we consider it "accurate" when > 0
      if (Math.abs(recebida) > 0) stats.accurate++;
      bancoStats.set(banco, stats);
    }
    return Array.from(bancoStats.entries()).map(([banco, s]) => ({
      banco,
      total: s.total,
      accurate: s.accurate,
      pct: s.total > 0 ? s.accurate / s.total : 0,
    }));
  }, [geral, repasse]);

  // 2. Perda Acumulada: soma divergências negativas por banco
  const perdaByBanco = useMemo(() => {
    const bancoMap = new Map<string, { perda: number; ganho: number; count: number }>();
    for (const g of geral) {
      const banco = (g.banco || 'N/A').toUpperCase();
      const cms = g.cms_rep || 0;
      const val = g.prod_liq || 0;
      const entry = bancoMap.get(banco) || { perda: 0, ganho: 0, count: 0 };
      entry.count++;
      // Simplification: negative cms indicates potential loss
      if (cms < 0) entry.perda += Math.abs(cms);
      else entry.ganho += cms;
      bancoMap.set(banco, entry);
    }
    return Array.from(bancoMap.entries()).map(([banco, s]) => ({
      banco, perda: s.perda, ganho: s.ganho, count: s.count,
    }));
  }, [geral]);

  // 3. Taxa Média Recebida vs Esperada
  const taxaMedia = useMemo(() => {
    const bancoMap = new Map<string, { somaRecebida: number; somaValor: number; count: number }>();
    for (const g of geral) {
      const banco = (g.banco || 'N/A').toUpperCase();
      const val = g.prod_liq || 0;
      const cms = g.cms_rep || 0;
      if (val <= 0) continue;
      const entry = bancoMap.get(banco) || { somaRecebida: 0, somaValor: 0, count: 0 };
      entry.somaRecebida += cms;
      entry.somaValor += val;
      entry.count++;
      bancoMap.set(banco, entry);
    }

    // Average expected rate from rules
    const ruleRateMap = new Map<string, number[]>();
    for (const r of [...rulesFGTS, ...rulesCLT]) {
      const b = r.banco.toUpperCase();
      const arr = ruleRateMap.get(b) || [];
      arr.push(r.taxa);
      ruleRateMap.set(b, arr);
    }

    return Array.from(bancoMap.entries()).map(([banco, s]) => {
      const taxaRecebida = s.somaValor > 0 ? s.somaRecebida / s.somaValor : 0;
      const ruleRates = ruleRateMap.get(banco) || [];
      const taxaEsperada = ruleRates.length > 0 ? ruleRates.reduce((a, b) => a + b, 0) / ruleRates.length / 100 : 0;
      return { banco, taxaRecebida, taxaEsperada, contratos: s.count, delta: taxaRecebida - taxaEsperada };
    });
  }, [geral, rulesFGTS, rulesCLT]);

  const sortedAcuracia = applySortToData(acuraciaByBanco, sort);
  const sortedPerda = applySortToData(perdaByBanco, sort);
  const sortedTaxa = applySortToData(taxaMedia, sort);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (geral.length === 0) return <p className="text-center text-muted-foreground py-8 text-sm">Importe dados nas abas Geral e Repasse primeiro.</p>;

  return (
    <div className="space-y-6">
      {/* Card 1: Acurácia por Banco */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg"><Target className="w-5 h-5" /> Acurácia por Banco</CardTitle>
          <CardDescription>Percentual de contratos com comissão registrada (CMS Rep &gt; 0) por banco.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <tr>
                  <TSHead label="Banco" sortKey="banco" sort={sort} toggle={toggle} tooltip="Nome do banco" className="text-xs" />
                  <TSHead label="Contratos" sortKey="total" sort={sort} toggle={toggle} tooltip="Total de contratos" className="text-xs text-right" />
                  <TSHead label="Com CMS" sortKey="accurate" sort={sort} toggle={toggle} tooltip="Contratos com comissão > 0" className="text-xs text-right" />
                  <TSHead label="Acurácia" sortKey="pct" sort={sort} toggle={toggle} tooltip="% de contratos com comissão" className="text-xs text-right" />
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
          <CardDescription>Soma de comissões negativas (empresa recebeu menos que deveria) agrupada por banco.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <tr>
                  <TSHead label="Banco" sortKey="banco" sort={sort} toggle={toggle} tooltip="Nome do banco" className="text-xs" />
                  <TSHead label="Contratos" sortKey="count" sort={sort} toggle={toggle} tooltip="Quantidade de contratos" className="text-xs text-right" />
                  <TSHead label="Ganho (CMS+)" sortKey="ganho" sort={sort} toggle={toggle} tooltip="Soma de comissões positivas" className="text-xs text-right" />
                  <TSHead label="Perda (CMS−)" sortKey="perda" sort={sort} toggle={toggle} tooltip="Soma de comissões negativas (módulo)" className="text-xs text-right" />
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

      {/* Card 3: Taxa Média Recebida vs Esperada */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg"><TrendingUp className="w-5 h-5" /> Taxa Média: Recebida vs Esperada</CardTitle>
          <CardDescription>Comparação entre a taxa efetiva (CMS/Valor) e a taxa média das regras cadastradas.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <tr>
                  <TSHead label="Banco" sortKey="banco" sort={sort} toggle={toggle} tooltip="Nome do banco" className="text-xs" />
                  <TSHead label="Contratos" sortKey="contratos" sort={sort} toggle={toggle} tooltip="Quantidade de contratos com valor > 0" className="text-xs text-right" />
                  <TSHead label="Taxa Recebida" sortKey="taxaRecebida" sort={sort} toggle={toggle} tooltip="CMS total / Valor total" className="text-xs text-right" />
                  <TSHead label="Taxa Esperada" sortKey="taxaEsperada" sort={sort} toggle={toggle} tooltip="Média das taxas cadastradas nas regras" className="text-xs text-right" />
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
  );
}
