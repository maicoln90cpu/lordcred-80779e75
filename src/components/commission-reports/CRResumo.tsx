import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, BarChart3, Save, DollarSign, TrendingUp, TrendingDown, FileText, AlertTriangle } from 'lucide-react';

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface GeralRow { ade: string | null; banco: string | null; prod_liq: number | null; prazo: number | null; tipo_operacao: string | null; convenio: string | null; cms_rep: number | null; data_pgt_cliente: string | null; }
interface RepasseRow { ade: string | null; cms_rep_favorecido: number | null; }
interface SeguroRow { descricao: string | null; valor_comissao: number | null; }
interface RuleFGTS { banco: string; tabela_chave: string; seguro: string; min_valor: number; max_valor: number; taxa: number; data_vigencia: string; }
interface RuleCLT { banco: string; tabela_chave: string; seguro: string; prazo_min: number; prazo_max: number; taxa: number; data_vigencia: string; }

function identifyProduct(tipo: string | null, convenio: string | null): string {
  const t = (tipo || '').toUpperCase();
  const c = (convenio || '').toUpperCase();
  if (t.includes('FGTS') || c.includes('FGTS')) return 'FGTS';
  return 'CLT';
}
function hasInsuranceFn(convenio: string | null): boolean {
  const c = (convenio || '').toUpperCase();
  return c.includes('SEGURO') || c.includes('COM SEG') || c.includes('C/SEG');
}
function findFGTSRate(rules: RuleFGTS[], banco: string, valor: number, tabela: string, temSeguro: boolean, dt: string): number {
  const b = banco.toUpperCase();
  for (const r of rules.filter(r => r.banco.toUpperCase() === b && r.data_vigencia <= dt).sort((a, c) => c.data_vigencia.localeCompare(a.data_vigencia))) {
    if ((r.tabela_chave === '*' || tabela.toUpperCase().includes(r.tabela_chave.toUpperCase())) &&
        (r.seguro === 'Ambos' || (r.seguro === 'Sim' && temSeguro) || (r.seguro === 'Não' && !temSeguro)) &&
        valor >= r.min_valor && valor <= r.max_valor) return r.taxa;
  }
  return 0;
}
function findCLTRate(rules: RuleCLT[], banco: string, prazo: number, tabela: string, temSeguro: boolean, dt: string): number {
  const b = banco.toUpperCase();
  for (const r of rules.filter(r => r.banco.toUpperCase() === b && r.data_vigencia <= dt).sort((a, c) => c.data_vigencia.localeCompare(a.data_vigencia))) {
    if ((r.tabela_chave === '*' || tabela.toUpperCase().includes(r.tabela_chave.toUpperCase())) &&
        (r.seguro === 'Ambos' || (r.seguro === 'Sim' && temSeguro) || (r.seguro === 'Não' && !temSeguro)) &&
        prazo >= r.prazo_min && prazo <= r.prazo_max) return r.taxa;
  }
  return 0;
}

export default function CRResumo() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  const { data: geral = [], isLoading: l1 } = useQuery({
    queryKey: ['cr-geral-report'],
    queryFn: async () => { const { data } = await supabase.from('cr_geral').select('ade, banco, prod_liq, prazo, tipo_operacao, convenio, cms_rep, data_pgt_cliente').limit(5000); return (data || []) as GeralRow[]; },
  });
  const { data: repasse = [], isLoading: l2 } = useQuery({
    queryKey: ['cr-repasse-report'],
    queryFn: async () => { const { data } = await supabase.from('cr_repasse').select('ade, cms_rep_favorecido').limit(5000); return (data || []) as RepasseRow[]; },
  });
  const { data: seguros = [], isLoading: l3 } = useQuery({
    queryKey: ['cr-seguros-report'],
    queryFn: async () => { const { data } = await supabase.from('cr_seguros').select('descricao, valor_comissao').limit(5000); return (data || []) as SeguroRow[]; },
  });
  const { data: rulesFGTS = [], isLoading: l4 } = useQuery({
    queryKey: ['cr-rules-fgts'],
    queryFn: async () => { const { data } = await supabase.from('cr_rules_fgts').select('*').order('data_vigencia', { ascending: false }); return (data || []) as RuleFGTS[]; },
  });
  const { data: rulesCLT = [], isLoading: l5 } = useQuery({
    queryKey: ['cr-rules-clt'],
    queryFn: async () => { const { data } = await supabase.from('cr_rules_clt').select('*').order('data_vigencia', { ascending: false }); return (data || []) as RuleCLT[]; },
  });

  const isLoading = l1 || l2 || l3 || l4 || l5;

  const repasseMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of repasse) if (r.ade) m.set(r.ade, (m.get(r.ade) || 0) + (r.cms_rep_favorecido || 0));
    return m;
  }, [repasse]);

  const seguroMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of seguros) if (s.descricao) {
      for (const g of geral) if (g.ade && s.descricao.toUpperCase().includes(g.ade.toUpperCase()))
        m.set(g.ade, (m.get(g.ade) || 0) + (s.valor_comissao || 0));
    }
    return m;
  }, [seguros, geral]);

  const summary = useMemo(() => {
    let totalLiberado = 0, totalRecebida = 0, totalEsperada = 0, countFGTS = 0, countCLT = 0, countDiv = 0;
    const byBanco = new Map<string, { recebida: number; esperada: number; count: number }>();

    const details: { ade: string; nome: string; banco: string; produto: string; valor_liberado: number; comissao_recebida: number; comissao_esperada: number; diferenca: number }[] = [];

    for (const g of geral) {
      const banco = (g.banco || '').toUpperCase();
      const valor = g.prod_liq || 0;
      const prazo = g.prazo || 0;
      const produto = identifyProduct(g.tipo_operacao, g.convenio);
      const temSeguro = hasInsuranceFn(g.convenio);
      const tabela = (g.convenio || '*').trim();
      const valorCalc = banco === 'MERCANTIL' ? valor / 0.7 : valor;
      const dt = g.data_pgt_cliente ? g.data_pgt_cliente.slice(0, 10) : '9999-12-31';

      const cmsGeral = g.cms_rep || 0;
      const cmsRepasse = repasseMap.get(g.ade || '') || 0;
      const cmsSeguro = seguroMap.get(g.ade || '') || 0;
      const recebida = cmsGeral + cmsRepasse + cmsSeguro;

      let esperada = 0;
      if (produto === 'FGTS') {
        esperada = Math.round(valorCalc * findFGTSRate(rulesFGTS, banco, valorCalc, tabela, temSeguro, dt) / 100 * 100) / 100;
        countFGTS++;
      } else {
        esperada = Math.round(valorCalc * findCLTRate(rulesCLT, banco, prazo, tabela, temSeguro, dt) / 100 * 100) / 100;
        countCLT++;
      }

      const dif = Math.round((recebida - esperada) * 100) / 100;
      if (Math.abs(dif) > 0.01) countDiv++;

      totalLiberado += valor;
      totalRecebida += recebida;
      totalEsperada += esperada;

      const b = byBanco.get(banco) || { recebida: 0, esperada: 0, count: 0 };
      b.recebida += recebida; b.esperada += esperada; b.count++;
      byBanco.set(banco, b);

      details.push({ ade: g.ade || '', nome: '', banco, produto, valor_liberado: valor, comissao_recebida: recebida, comissao_esperada: esperada, diferenca: dif });
    }

    return { totalLiberado, totalRecebida, totalEsperada, diferenca: Math.round((totalRecebida - totalEsperada) * 100) / 100, count: geral.length, countFGTS, countCLT, countDiv, byBanco, details };
  }, [geral, repasseMap, seguroMap, rulesFGTS, rulesCLT]);

  const handleSaveHistory = async () => {
    if (!saveName.trim()) { toast({ title: 'Informe um nome para o fechamento', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      // Find date range from geral data
      const dates = geral.map(g => g.data_pgt_cliente).filter(Boolean).sort();
      const dataInicio = dates[0]?.slice(0, 10) || null;
      const dataFim = dates[dates.length - 1]?.slice(0, 10) || null;

      const { data: gestao, error: gErr } = await supabase.from('cr_historico_gestao').insert({
        nome: saveName.trim(),
        qtd_propostas: summary.count,
        valor_liberado: summary.totalLiberado,
        comissao_esperada: summary.totalEsperada,
        comissao_recebida: summary.totalRecebida,
        diferenca: summary.diferenca,
        data_inicio: dataInicio,
        data_fim: dataFim,
        created_by: user!.id,
      } as any).select().single();
      if (gErr) throw gErr;

      const gestaoId = (gestao as any).id;

      // Save details in batches
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
        }));
        const { error } = await supabase.from('cr_historico_detalhado').insert(chunk as any);
        if (error) throw error;
      }

      toast({ title: `Fechamento "${saveName}" salvo com ${summary.count} contratos` });
      setSaveDialogOpen(false);
      setSaveName('');
      qc.invalidateQueries({ queryKey: ['cr-historico'] });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const topBancos = useMemo(() =>
    [...summary.byBanco.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 6),
    [summary.byBanco]
  );

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <FileText className="w-4 h-4" /> Contratos
            </div>
            <p className="text-2xl font-bold">{isLoading ? '...' : summary.count}</p>
            <div className="flex gap-2 mt-1">
              <Badge variant="secondary" className="text-[10px]">FGTS: {summary.countFGTS}</Badge>
              <Badge variant="outline" className="text-[10px]">CLT: {summary.countCLT}</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="w-4 h-4" /> Valor Liberado
            </div>
            <p className="text-2xl font-bold">{isLoading ? '...' : fmtBRL(summary.totalLiberado)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <TrendingUp className="w-4 h-4" /> Comissão Recebida
            </div>
            <p className="text-2xl font-bold text-green-600">{isLoading ? '...' : fmtBRL(summary.totalRecebida)}</p>
          </CardContent>
        </Card>
        <Card className={summary.diferenca < -0.01 ? 'border-destructive/50' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              {summary.diferenca >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              Diferença (Rec - Esp)
            </div>
            <p className={`text-2xl font-bold ${summary.diferenca > 0.01 ? 'text-green-600' : summary.diferenca < -0.01 ? 'text-destructive' : ''}`}>
              {isLoading ? '...' : fmtBRL(summary.diferenca)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Esperada: {fmtBRL(summary.totalEsperada)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Divergences alert */}
      {summary.countDiv > 0 && (
        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="py-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span className="text-sm"><strong>{summary.countDiv}</strong> contratos com divergência detectada.</span>
          </CardContent>
        </Card>
      )}

      {/* By Bank */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Resumo por Banco
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : topBancos.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-4">Sem dados.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {topBancos.map(([banco, data]) => {
                const dif = Math.round((data.recebida - data.esperada) * 100) / 100;
                return (
                  <div key={banco} className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{banco}</span>
                      <Badge variant="secondary" className="text-[10px]">{data.count} contratos</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div><span className="text-muted-foreground">Receb:</span> <span className="font-mono">{fmtBRL(data.recebida)}</span></div>
                      <div><span className="text-muted-foreground">Esper:</span> <span className="font-mono">{fmtBRL(data.esperada)}</span></div>
                      <div><span className="text-muted-foreground">Δ:</span> <span className={`font-mono font-bold ${dif > 0.01 ? 'text-green-600' : dif < -0.01 ? 'text-destructive' : ''}`}>{fmtBRL(dif)}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save History Button */}
      <div className="flex justify-end">
        <Button onClick={() => { setSaveName(`Fechamento ${new Date().toLocaleDateString('pt-BR')}`); setSaveDialogOpen(true); }} disabled={geral.length === 0}>
          <Save className="w-4 h-4 mr-2" /> Salvar Fechamento
        </Button>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Salvar Fechamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nome do fechamento</label>
              <Input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="Ex: Fechamento Março 2026" />
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
              <p><strong>{summary.count}</strong> contratos serão salvos</p>
              <p>Valor liberado: <strong>{fmtBRL(summary.totalLiberado)}</strong></p>
              <p>Comissão recebida: <strong className="text-green-600">{fmtBRL(summary.totalRecebida)}</strong></p>
              <p>Comissão esperada: <strong>{fmtBRL(summary.totalEsperada)}</strong></p>
              <p>Diferença: <strong className={summary.diferenca < -0.01 ? 'text-destructive' : ''}>{fmtBRL(summary.diferenca)}</strong></p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveHistory} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
