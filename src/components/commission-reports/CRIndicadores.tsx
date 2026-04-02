import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { TSHead, useSortState, applySortToData } from './CRSortUtils';
import { TooltipProvider } from '@/components/ui/tooltip';
import CREvolutionChart from './CREvolutionChart';
import CRDivergenceAlerts from './CRDivergenceAlerts';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;

interface AuditRow {
  banco: string; valor_liberado: number; comissao_recebida: number; comissao_esperada: number; diferenca: number;
}

export default function CRIndicadores() {
  const { sort, toggle } = useSortState();

  const { data: contractData = [], isLoading } = useQuery({
    queryKey: ['cr-audit-rpc-full'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('calculate_commission_audit', { _date_from: null, _date_to: null });
      if (error) throw error;
      return (data || []) as AuditRow[];
    }
  });

  const acuraciaByBanco = useMemo(() => {
    const stats = new Map<string, { total: number; accurate: number }>();
    for (const c of contractData) {
      const banco = (c.banco || '').toUpperCase();
      const s = stats.get(banco) || { total: 0, accurate: 0 };
      s.total++;
      if (Math.abs(c.diferenca) < 1) s.accurate++;
      stats.set(banco, s);
    }
    return Array.from(stats.entries()).map(([banco, s]) => ({
      banco, total: s.total, accurate: s.accurate, pct: s.total > 0 ? s.accurate / s.total : 0,
    }));
  }, [contractData]);

  const perdaByBanco = useMemo(() => {
    const stats = new Map<string, { perda: number; ganho: number; count: number }>();
    for (const c of contractData) {
      const banco = (c.banco || '').toUpperCase();
      const s = stats.get(banco) || { perda: 0, ganho: 0, count: 0 };
      s.count++;
      if (c.diferenca < -0.01) s.perda += Math.abs(c.diferenca);
      else if (c.diferenca > 0.01) s.ganho += c.diferenca;
      stats.set(banco, s);
    }
    return Array.from(stats.entries()).map(([banco, s]) => ({
      banco, perda: Math.round(s.perda * 100) / 100, ganho: Math.round(s.ganho * 100) / 100, count: s.count,
    }));
  }, [contractData]);

  const taxaMedia = useMemo(() => {
    const stats = new Map<string, { somaRecebida: number; somaEsperada: number; somaValor: number; count: number }>();
    for (const c of contractData) {
      if (c.valor_liberado <= 0) continue;
      const banco = (c.banco || '').toUpperCase();
      const s = stats.get(banco) || { somaRecebida: 0, somaEsperada: 0, somaValor: 0, count: 0 };
      s.somaRecebida += c.comissao_recebida;
      s.somaEsperada += c.comissao_esperada;
      s.somaValor += c.valor_liberado;
      s.count++;
      stats.set(banco, s);
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

  const globalKpis = useMemo(() => {
    const total = contractData.length;
    const accurate = contractData.filter(c => Math.abs(c.diferenca) < 1).length;
    const perdaTotal = contractData.filter(c => c.diferenca < -0.01).reduce((s, c) => s + Math.abs(c.diferenca), 0);
    return { total, accurate, acuracia: total > 0 ? accurate / total : 0, perdaTotal: Math.round(perdaTotal * 100) / 100 };
  }, [contractData]);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (contractData.length === 0) return <p className="text-center text-muted-foreground py-8 text-sm">Importe dados na aba Relatório (Import) primeiro.</p>;

  return (
    <TooltipProvider delayDuration={300}>
    <div className="space-y-6">
      <CREvolutionChart />
      <CRDivergenceAlerts />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><Target className="w-4 h-4" /> Acurácia Global</div>
          <p className="text-2xl font-bold">{(globalKpis.acuracia * 100).toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground">{globalKpis.accurate} de {globalKpis.total} contratos com |Δ| &lt; R$1</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><TrendingDown className="w-4 h-4 text-destructive" /> Perda Acumulada</div>
          <p className="text-2xl font-bold text-destructive">{fmtBRL(globalKpis.perdaTotal)}</p>
          <p className="text-xs text-muted-foreground">Soma das divergências negativas</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><TrendingUp className="w-4 h-4" /> Contratos Analisados</div>
          <p className="text-2xl font-bold">{globalKpis.total}</p>
          <p className="text-xs text-muted-foreground">Calculado no servidor (RPC)</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg"><Target className="w-5 h-5" /> Acurácia por Banco</CardTitle>
          <CardDescription>% de contratos onde |Recebida − Esperada| &lt; R$1,00.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg max-h-[400px] overflow-auto">
            <Table className="min-w-[600px]">
              <TableHeader><tr>
                <TSHead label="Banco" sortKey="banco" sort={sort} toggle={toggle} tooltip="Nome do banco" className="text-xs" />
                <TSHead label="Contratos" sortKey="total" sort={sort} toggle={toggle} tooltip="Total" className="text-xs text-right" />
                <TSHead label="Corretos" sortKey="accurate" sort={sort} toggle={toggle} tooltip="|Δ| < R$1" className="text-xs text-right" />
                <TSHead label="Acurácia" sortKey="pct" sort={sort} toggle={toggle} tooltip="%" className="text-xs text-right" />
              </tr></TableHeader>
              <TableBody>
                {sortedAcuracia.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-medium">{r.banco}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{r.total}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{r.accurate}</TableCell>
                    <TableCell className="text-xs text-right font-mono">
                      <Badge variant={r.pct >= 0.9 ? 'default' : r.pct >= 0.7 ? 'secondary' : 'destructive'} className="text-[10px]">{(r.pct * 100).toFixed(1)}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg"><TrendingDown className="w-5 h-5 text-destructive" /> Perda Acumulada por Banco</CardTitle>
          <CardDescription>Soma das divergências negativas por banco.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg max-h-[400px] overflow-auto">
            <Table className="min-w-[600px]">
              <TableHeader><tr>
                <TSHead label="Banco" sortKey="banco" sort={sort} toggle={toggle} className="text-xs" />
                <TSHead label="Contratos" sortKey="count" sort={sort} toggle={toggle} className="text-xs text-right" />
                <TSHead label="Ganho (Δ+)" sortKey="ganho" sort={sort} toggle={toggle} className="text-xs text-right" />
                <TSHead label="Perda (Δ−)" sortKey="perda" sort={sort} toggle={toggle} className="text-xs text-right" />
              </tr></TableHeader>
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg"><TrendingUp className="w-5 h-5" /> Taxa Média por Banco</CardTitle>
          <CardDescription>Comissão média como % do valor liberado.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg max-h-[400px] overflow-auto">
            <Table className="min-w-[700px]">
              <TableHeader><tr>
                <TSHead label="Banco" sortKey="banco" sort={sort} toggle={toggle} className="text-xs" />
                <TSHead label="Contratos" sortKey="contratos" sort={sort} toggle={toggle} className="text-xs text-right" />
                <TSHead label="Taxa Recebida" sortKey="taxaRecebida" sort={sort} toggle={toggle} className="text-xs text-right" />
                <TSHead label="Taxa Esperada" sortKey="taxaEsperada" sort={sort} toggle={toggle} className="text-xs text-right" />
                <TSHead label="Δ Taxa" sortKey="delta" sort={sort} toggle={toggle} className="text-xs text-right" />
              </tr></TableHeader>
              <TableBody>
                {sortedTaxa.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-medium">{r.banco}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{r.contratos}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{fmtPct(r.taxaRecebida)}</TableCell>
                    <TableCell className="text-xs text-right font-mono">{fmtPct(r.taxaEsperada)}</TableCell>
                    <TableCell className={`text-xs text-right font-mono font-bold ${r.delta > 0.001 ? 'text-green-600' : r.delta < -0.001 ? 'text-destructive' : ''}`}>{fmtPct(r.delta)}</TableCell>
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
