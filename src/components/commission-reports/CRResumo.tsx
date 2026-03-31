import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, BarChart3, Save, DollarSign, TrendingUp, TrendingDown, FileText, AlertTriangle, CalendarIcon } from 'lucide-react';
import { TSHead, useSortState, applySortToData, TipWrap, TOOLTIPS_RESUMO } from './CRSortUtils';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface GeralRow { ade: string | null; banco: string | null; prod_liq: number | null; prazo: number | null; tipo_operacao: string | null; convenio: string | null; cms_rep: number | null; data_pgt_cliente: string | null; }
interface RepasseRow { ade: string | null; cms_rep_favorecido: number | null; }
interface SeguroRow { descricao: string | null; valor_comissao: number | null; }
interface RuleFGTS { banco: string; tabela_chave: string; seguro: string; min_valor: number; max_valor: number; taxa: number; data_vigencia: string; }
interface RuleCLT { banco: string; tabela_chave: string; seguro: string; prazo_min: number; prazo_max: number; taxa: number; data_vigencia: string; }

function identifyProduct(tipo: string | null, convenio: string | null): string { const t = (tipo || '').toUpperCase(); const c = (convenio || '').toUpperCase(); if (t.includes('FGTS') || c.includes('FGTS')) return 'FGTS'; return 'CLT'; }
function hasInsuranceFn(convenio: string | null): boolean { const c = (convenio || '').toUpperCase(); return c.includes('SEGURO') || c.includes('COM SEG') || c.includes('C/SEG'); }
function findFGTSRate(rules: RuleFGTS[], banco: string, valor: number, tabela: string, temSeguro: boolean, dt: string): number { const b = banco.toUpperCase(); for (const r of rules.filter(r => r.banco.toUpperCase() === b && r.data_vigencia <= dt).sort((a, c) => c.data_vigencia.localeCompare(a.data_vigencia))) { if ((r.tabela_chave === '*' || tabela.toUpperCase().includes(r.tabela_chave.toUpperCase())) && (r.seguro === 'Ambos' || (r.seguro === 'Sim' && temSeguro) || (r.seguro === 'Não' && !temSeguro)) && valor >= r.min_valor && valor <= r.max_valor) return r.taxa; } return 0; }
function findCLTRate(rules: RuleCLT[], banco: string, prazo: number, tabela: string, temSeguro: boolean, dt: string): number { const b = banco.toUpperCase(); for (const r of rules.filter(r => r.banco.toUpperCase() === b && r.data_vigencia <= dt).sort((a, c) => c.data_vigencia.localeCompare(a.data_vigencia))) { if ((r.tabela_chave === '*' || tabela.toUpperCase().includes(r.tabela_chave.toUpperCase())) && (r.seguro === 'Ambos' || (r.seguro === 'Sim' && temSeguro) || (r.seguro === 'Não' && !temSeguro)) && prazo >= r.prazo_min && prazo <= r.prazo_max) return r.taxa; } return 0; }

export default function CRResumo() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();
  const { sort: bancoSort, toggle: toggleBancoSort } = useSortState();

  const { data: geral = [], isLoading: l1 } = useQuery({ queryKey: ['cr-geral-report'], queryFn: async () => { const { data } = await supabase.from('cr_geral').select('ade, banco, prod_liq, prazo, tipo_operacao, convenio, cms_rep, data_pgt_cliente').limit(5000); return (data || []) as GeralRow[]; } });
  const { data: repasse = [], isLoading: l2 } = useQuery({ queryKey: ['cr-repasse-report'], queryFn: async () => { const { data } = await supabase.from('cr_repasse').select('ade, cms_rep_favorecido').limit(5000); return (data || []) as RepasseRow[]; } });
  const { data: seguros = [], isLoading: l3 } = useQuery({ queryKey: ['cr-seguros-report'], queryFn: async () => { const { data } = await supabase.from('cr_seguros').select('descricao, valor_comissao').limit(5000); return (data || []) as SeguroRow[]; } });
  const { data: rulesFGTS = [], isLoading: l4 } = useQuery({ queryKey: ['cr-rules-fgts'], queryFn: async () => { const { data } = await supabase.from('cr_rules_fgts').select('*').order('data_vigencia', { ascending: false }); return (data || []) as RuleFGTS[]; } });
  const { data: rulesCLT = [], isLoading: l5 } = useQuery({ queryKey: ['cr-rules-clt'], queryFn: async () => { const { data } = await supabase.from('cr_rules_clt').select('*').order('data_vigencia', { ascending: false }); return (data || []) as RuleCLT[]; } });
  const isLoading = l1 || l2 || l3 || l4 || l5;

  // Filter geral by date range
  const filteredGeral = useMemo(() => {
    let rows = geral;
    if (dataInicio) {
      const ini = dataInicio.toISOString().slice(0, 10);
      rows = rows.filter(g => g.data_pgt_cliente && g.data_pgt_cliente.slice(0, 10) >= ini);
    }
    if (dataFim) {
      const fim = dataFim.toISOString().slice(0, 10);
      rows = rows.filter(g => g.data_pgt_cliente && g.data_pgt_cliente.slice(0, 10) <= fim);
    }
    return rows;
  }, [geral, dataInicio, dataFim]);

  const repasseMap = useMemo(() => { const m = new Map<string, number>(); for (const r of repasse) if (r.ade) m.set(r.ade, (m.get(r.ade) || 0) + (r.cms_rep_favorecido || 0)); return m; }, [repasse]);
  const seguroMap = useMemo(() => { const m = new Map<string, number>(); for (const s of seguros) if (s.descricao) { for (const g of filteredGeral) if (g.ade && s.descricao.toUpperCase().includes(g.ade.toUpperCase())) m.set(g.ade, (m.get(g.ade) || 0) + (s.valor_comissao || 0)); } return m; }, [seguros, filteredGeral]);

  const summary = useMemo(() => {
    let totalLiberado = 0, totalRecebida = 0, totalEsperada = 0, countFGTS = 0, countCLT = 0, countDiv = 0;
    const byBanco = new Map<string, { recebida: number; esperada: number; count: number }>();
    const details: { ade: string; nome: string; banco: string; produto: string; valor_liberado: number; comissao_recebida: number; comissao_esperada: number; diferenca: number; data_pago: string | null; valor_assegurado: number }[] = [];

    for (const g of filteredGeral) {
      const banco = (g.banco || '').toUpperCase(); const valor = g.prod_liq || 0; const prazo = g.prazo || 0;
      const produto = identifyProduct(g.tipo_operacao, g.convenio); const temSeguro = hasInsuranceFn(g.convenio);
      const tabela = (g.convenio || '*').trim();
      const isMerc = banco.includes('MERCANTIL');
      const valorAssegurado = isMerc ? Math.round(valor / 0.7 * 100) / 100 : 0;
      const valorCalc = isMerc ? valorAssegurado : valor;
      const dt = g.data_pgt_cliente ? g.data_pgt_cliente.slice(0, 10) : '9999-12-31';
      const cmsGeral = g.cms_rep || 0; const cmsRepasse = repasseMap.get(g.ade || '') || 0; const cmsSeguro = seguroMap.get(g.ade || '') || 0;
      const recebida = cmsGeral + cmsRepasse + cmsSeguro;
      let esperada = 0;
      if (produto === 'FGTS') { esperada = Math.round(valorCalc * findFGTSRate(rulesFGTS, banco, valorCalc, tabela, temSeguro, dt) / 100 * 100) / 100; countFGTS++; }
      else { esperada = Math.round(valorCalc * findCLTRate(rulesCLT, banco, prazo, tabela, temSeguro, dt) / 100 * 100) / 100; countCLT++; }
      const dif = Math.round((recebida - esperada) * 100) / 100;
      if (Math.abs(dif) > 0.01) countDiv++;
      totalLiberado += valor; totalRecebida += recebida; totalEsperada += esperada;
      const b = byBanco.get(banco) || { recebida: 0, esperada: 0, count: 0 };
      b.recebida += recebida; b.esperada += esperada; b.count++; byBanco.set(banco, b);
      details.push({ ade: g.ade || '', nome: '', banco, produto, valor_liberado: valor, comissao_recebida: recebida, comissao_esperada: esperada, diferenca: dif, data_pago: g.data_pgt_cliente || null, valor_assegurado: valorAssegurado });
    }
    return { totalLiberado, totalRecebida, totalEsperada, diferenca: Math.round((totalRecebida - totalEsperada) * 100) / 100, count: filteredGeral.length, countFGTS, countCLT, countDiv, byBanco, details };
  }, [filteredGeral, repasseMap, seguroMap, rulesFGTS, rulesCLT]);

  const handleSaveHistory = async () => {
    if (!saveName.trim()) { toast({ title: 'Informe um nome para o fechamento', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const dates = filteredGeral.map(g => g.data_pgt_cliente).filter(Boolean).sort();
      const dataInicioStr = dates[0]?.slice(0, 10) || null; const dataFimStr = dates[dates.length - 1]?.slice(0, 10) || null;
      const { data: gestao, error: gErr } = await supabase.from('cr_historico_gestao').insert({ nome: saveName.trim(), qtd_propostas: summary.count, valor_liberado: summary.totalLiberado, comissao_esperada: summary.totalEsperada, comissao_recebida: summary.totalRecebida, diferenca: summary.diferenca, data_inicio: dataInicioStr, data_fim: dataFimStr, created_by: user!.id } as any).select().single();
      if (gErr) throw gErr;
      const gestaoId = (gestao as any).id;
      for (let i = 0; i < summary.details.length; i += 100) {
        const chunk = summary.details.slice(i, i + 100).map(d => ({
          gestao_id: gestaoId,
          num_contrato: d.ade,
          nome: d.nome || null,
          banco: d.banco,
          produto: d.produto,
          valor_liberado: d.valor_liberado,
          comissao_esperada: d.comissao_esperada,
          comissao_recebida: d.comissao_recebida,
          diferenca: d.diferenca,
          data_pago: d.data_pago || null,
          valor_assegurado: d.valor_assegurado || null,
        }));
        const { error } = await supabase.from('cr_historico_detalhado').insert(chunk as any);
        if (error) throw error;
      }
      toast({ title: `Fechamento "${saveName}" salvo com ${summary.count} contratos` });
      setSaveDialogOpen(false); setSaveName('');
      qc.invalidateQueries({ queryKey: ['cr-historico'] });
    } catch (e: any) { toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const topBancos = useMemo(() => {
    const arr = [...summary.byBanco.entries()].map(([banco, data]) => ({ banco, ...data, diferenca: Math.round((data.recebida - data.esperada) * 100) / 100 }));
    return applySortToData(arr, bancoSort).slice(0, 10);
  }, [summary.byBanco, bancoSort]);

  return (
    <TooltipProvider delayDuration={300}>
    <div className="space-y-4">
      {/* Date Filters */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">Filtro de Período:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal h-9", !dataInicio && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Data Início"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataInicio} onSelect={setDataInicio} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal h-9", !dataFim && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataFim ? format(dataFim, "dd/MM/yyyy") : "Data Fim"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataFim} onSelect={setDataFim} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            {(dataInicio || dataFim) && (
              <Button variant="ghost" size="sm" onClick={() => { setDataInicio(undefined); setDataFim(undefined); }}>Limpar</Button>
            )}
            {(dataInicio || dataFim) && (
              <Badge variant="secondary" className="text-xs">
                {dataInicio ? format(dataInicio, "dd/MM/yyyy") : '...'} — {dataFim ? format(dataFim, "dd/MM/yyyy") : '...'}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6">
          <TipWrap tip={TOOLTIPS_RESUMO.contratos}><div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><FileText className="w-4 h-4" /> Contratos</div></TipWrap>
          <p className="text-2xl font-bold">{isLoading ? '...' : summary.count}</p>
          <div className="flex gap-2 mt-1"><Badge variant="secondary" className="text-[10px]">FGTS: {summary.countFGTS}</Badge><Badge variant="outline" className="text-[10px]">CLT: {summary.countCLT}</Badge></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <TipWrap tip={TOOLTIPS_RESUMO.valor_liberado}><div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><DollarSign className="w-4 h-4" /> Valor Liberado</div></TipWrap>
          <p className="text-2xl font-bold">{isLoading ? '...' : fmtBRL(summary.totalLiberado)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <TipWrap tip={TOOLTIPS_RESUMO.comissao_recebida}><div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><TrendingUp className="w-4 h-4" /> Comissão Recebida</div></TipWrap>
          <p className="text-2xl font-bold text-green-600">{isLoading ? '...' : fmtBRL(summary.totalRecebida)}</p>
        </CardContent></Card>
        <Card className={summary.diferenca < -0.01 ? 'border-destructive/50' : ''}><CardContent className="pt-6">
          <TipWrap tip={TOOLTIPS_RESUMO.diferenca}><div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">{summary.diferenca >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />} Diferença (Rec - Esp)</div></TipWrap>
          <p className={`text-2xl font-bold ${summary.diferenca > 0.01 ? 'text-green-600' : summary.diferenca < -0.01 ? 'text-destructive' : ''}`}>{isLoading ? '...' : fmtBRL(summary.diferenca)}</p>
          <p className="text-xs text-muted-foreground mt-1">Esperada: {fmtBRL(summary.totalEsperada)}</p>
        </CardContent></Card>
      </div>

      {summary.countDiv > 0 && (
        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="py-3 flex items-center gap-3"><AlertTriangle className="w-5 h-5 text-amber-600" /><span className="text-sm"><strong>{summary.countDiv}</strong> contratos com divergência detectada.</span></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Resumo por Banco</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : topBancos.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-4">Sem dados{(dataInicio || dataFim) ? ' para o período selecionado' : ''}.</p>
          ) : (
            <div className="border rounded-lg overflow-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <TSHead label="Banco" sortKey="banco" sort={bancoSort} toggle={toggleBancoSort} tooltip={TOOLTIPS_RESUMO.banco} className="text-xs" />
                    <TSHead label="Contratos" sortKey="count" sort={bancoSort} toggle={toggleBancoSort} tooltip={TOOLTIPS_RESUMO.count} className="text-xs text-center" />
                    <TSHead label="Recebida" sortKey="recebida" sort={bancoSort} toggle={toggleBancoSort} tooltip={TOOLTIPS_RESUMO.recebida} className="text-xs text-right" />
                    <TSHead label="Esperada" sortKey="esperada" sort={bancoSort} toggle={toggleBancoSort} tooltip={TOOLTIPS_RESUMO.esperada} className="text-xs text-right" />
                    <TSHead label="Diferença" sortKey="diferenca" sort={bancoSort} toggle={toggleBancoSort} tooltip={TOOLTIPS_RESUMO.diferenca} className="text-xs text-right" />
                  </tr>
                </thead>
                <tbody>
                  {topBancos.map(b => (
                    <tr key={b.banco} className="border-t">
                      <td className="px-4 py-2 text-sm font-medium">{b.banco}</td>
                      <td className="px-4 py-2 text-sm text-center">{b.count}</td>
                      <td className="px-4 py-2 text-sm text-right font-mono">{fmtBRL(b.recebida)}</td>
                      <td className="px-4 py-2 text-sm text-right font-mono">{fmtBRL(b.esperada)}</td>
                      <td className={`px-4 py-2 text-sm text-right font-mono font-bold ${b.diferenca > 0.01 ? 'text-green-600' : b.diferenca < -0.01 ? 'text-destructive' : ''}`}>{fmtBRL(b.diferenca)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => { setSaveName(`Fechamento ${new Date().toLocaleDateString('pt-BR')}`); setSaveDialogOpen(true); }} disabled={filteredGeral.length === 0}>
          <Save className="w-4 h-4 mr-2" /> Salvar Fechamento
        </Button>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Salvar Fechamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-xs font-medium text-muted-foreground">Nome do fechamento</label><Input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="Ex: Fechamento Março 2026" /></div>
            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
              <p><strong>{summary.count}</strong> contratos serão salvos</p>
              <p>Valor liberado: <strong>{fmtBRL(summary.totalLiberado)}</strong></p>
              <p>Comissão recebida: <strong className="text-green-600">{fmtBRL(summary.totalRecebida)}</strong></p>
              <p>Comissão esperada: <strong>{fmtBRL(summary.totalEsperada)}</strong></p>
              <p>Diferença: <strong className={summary.diferenca < -0.01 ? 'text-destructive' : ''}>{fmtBRL(summary.diferenca)}</strong></p>
              {(dataInicio || dataFim) && <p className="text-muted-foreground text-xs">Período: {dataInicio ? format(dataInicio, 'dd/MM/yyyy') : '...'} — {dataFim ? format(dataFim, 'dd/MM/yyyy') : '...'}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveHistory} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
