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

interface AuditRow {
  num_contrato: string;
  nome: string;
  banco: string;
  produto: string;
  tabela: string;
  valor_liberado: number;
  valor_assegurado: number;
  prazo: number;
  seguro: string;
  vendedor: string;
  data_pago: string | null;
  comissao_recebida: number;
  comissao_esperada: number;
  diferenca: number;
}

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

  // Use server-side RPC for all calculations
  const dateFromStr = dataInicio ? format(dataInicio, 'yyyy-MM-dd') : null;
  const dateToStr = dataFim ? format(dataFim, 'yyyy-MM-dd') : null;

  const { data: auditData = [], isLoading } = useQuery({
    queryKey: ['cr-audit-rpc', dateFromStr, dateToStr],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('calculate_commission_audit', {
        _date_from: dateFromStr,
        _date_to: dateToStr,
      });
      if (error) throw error;
      return (data || []) as AuditRow[];
    }
  });

  // Build summary from server results (just aggregation, no heavy calc)
  const summary = useMemo(() => {
    let totalLiberado = 0, totalRecebida = 0, totalEsperada = 0, countFGTS = 0, countCLT = 0, countDiv = 0;
    const byBanco = new Map<string, { recebida: number; esperada: number; count: number }>();

    for (const r of auditData) {
      totalLiberado += r.valor_liberado;
      totalRecebida += r.comissao_recebida;
      totalEsperada += r.comissao_esperada;
      if (r.produto === 'FGTS') countFGTS++; else countCLT++;
      if (Math.abs(r.diferenca) > 0.01) countDiv++;

      const banco = (r.banco || '').toUpperCase();
      const b = byBanco.get(banco) || { recebida: 0, esperada: 0, count: 0 };
      b.recebida += r.comissao_recebida;
      b.esperada += r.comissao_esperada;
      b.count++;
      byBanco.set(banco, b);
    }

    return {
      totalLiberado, totalRecebida, totalEsperada,
      diferenca: Math.round((totalRecebida - totalEsperada) * 100) / 100,
      count: auditData.length, countFGTS, countCLT, countDiv, byBanco
    };
  }, [auditData]);

  const handleSaveHistory = async () => {
    if (!saveName.trim()) { toast({ title: 'Informe um nome para o fechamento', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const dates = auditData.map(r => r.data_pago).filter(Boolean).sort();
      const dataInicioStr = dates[0] ? dates[0].slice(0, 10) : null;
      const dataFimStr = dates[dates.length - 1] ? dates[dates.length - 1]!.slice(0, 10) : null;

      const { data: gestao, error: gErr } = await supabase.from('cr_historico_gestao').insert({
        nome: saveName.trim(), qtd_propostas: summary.count, valor_liberado: summary.totalLiberado,
        comissao_esperada: summary.totalEsperada, comissao_recebida: summary.totalRecebida,
        diferenca: summary.diferenca, data_inicio: dataInicioStr, data_fim: dataFimStr, created_by: user!.id
      } as any).select().single();
      if (gErr) throw gErr;
      const gestaoId = (gestao as any).id;

      for (let i = 0; i < auditData.length; i += 100) {
        const chunk = auditData.slice(i, i + 100).map(d => ({
          gestao_id: gestaoId, num_contrato: d.num_contrato, nome: d.nome || null, banco: d.banco,
          produto: d.produto, valor_liberado: d.valor_liberado, comissao_esperada: d.comissao_esperada,
          comissao_recebida: d.comissao_recebida, diferenca: d.diferenca,
          data_pago: d.data_pago || null, valor_assegurado: d.valor_assegurado || null,
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
    return applySortToData(arr, bancoSort);
  }, [summary.byBanco, bancoSort]);

  const { sort: detailSort, toggle: toggleDetailSort } = useSortState();
  const [detailPage, setDetailPage] = useState(0);
  const PAGE_SIZE = 100;
  const sortedDetails = useMemo(() => {
    return applySortToData(auditData, detailSort, (item, key) => (item as any)[key]);
  }, [auditData, detailSort]);
  const pagedDetails = sortedDetails.slice(detailPage * PAGE_SIZE, (detailPage + 1) * PAGE_SIZE);
  const totalDetailPages = Math.ceil(sortedDetails.length / PAGE_SIZE);

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
            <div className="border rounded-lg overflow-auto scrollbar-visible">
              <table className="w-full min-w-[900px]">
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

      {/* Detailed contracts table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2"><FileText className="w-5 h-5" /> Detalhado ({auditData.length} contratos)</CardTitle>
        </CardHeader>
        <CardContent>
          {auditData.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-4">Sem dados{(dataInicio || dataFim) ? ' para o período selecionado' : ''}.</p>
          ) : (
            <>
              <div className="border rounded-lg overflow-auto max-h-[500px] scrollbar-visible">
                <table className="w-full min-w-[1100px]">
                  <thead className="sticky top-0 bg-background z-10">
                    <tr>
                      <TSHead label="Contrato" sortKey="num_contrato" sort={detailSort} toggle={toggleDetailSort} className="text-xs" />
                      <TSHead label="Nome" sortKey="nome" sort={detailSort} toggle={toggleDetailSort} className="text-xs" />
                      <TSHead label="Banco" sortKey="banco" sort={detailSort} toggle={toggleDetailSort} className="text-xs" />
                      <TSHead label="Produto" sortKey="produto" sort={detailSort} toggle={toggleDetailSort} className="text-xs" />
                      <TSHead label="Valor Lib." sortKey="valor_liberado" sort={detailSort} toggle={toggleDetailSort} className="text-xs text-right" />
                      <TSHead label="Recebida" sortKey="comissao_recebida" sort={detailSort} toggle={toggleDetailSort} className="text-xs text-right" />
                      <TSHead label="Esperada" sortKey="comissao_esperada" sort={detailSort} toggle={toggleDetailSort} className="text-xs text-right" />
                      <TSHead label="Diferença" sortKey="diferenca" sort={detailSort} toggle={toggleDetailSort} className="text-xs text-right" />
                    </tr>
                  </thead>
                  <tbody>
                    {pagedDetails.map((d, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-4 py-1.5 text-xs font-mono">{d.num_contrato}</td>
                        <td className="px-4 py-1.5 text-xs max-w-[200px] truncate">{d.nome}</td>
                        <td className="px-4 py-1.5 text-xs">{d.banco}</td>
                        <td className="px-4 py-1.5 text-xs"><Badge variant={d.produto === 'FGTS' ? 'default' : 'secondary'} className="text-[10px]">{d.produto}</Badge></td>
                        <td className="px-4 py-1.5 text-xs text-right font-mono">{fmtBRL(d.valor_liberado)}</td>
                        <td className="px-4 py-1.5 text-xs text-right font-mono">{fmtBRL(d.comissao_recebida)}</td>
                        <td className="px-4 py-1.5 text-xs text-right font-mono">{fmtBRL(d.comissao_esperada)}</td>
                        <td className={`px-4 py-1.5 text-xs text-right font-mono font-bold ${d.diferenca > 0.01 ? 'text-green-600' : d.diferenca < -0.01 ? 'text-destructive' : ''}`}>{fmtBRL(d.diferenca)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalDetailPages > 1 && (
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-muted-foreground">Página {detailPage + 1} de {totalDetailPages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={detailPage === 0} onClick={() => setDetailPage(p => p - 1)}>Anterior</Button>
                    <Button variant="outline" size="sm" disabled={detailPage >= totalDetailPages - 1} onClick={() => setDetailPage(p => p + 1)}>Próximo</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Info card about related tabs */}
      <Card className="border-blue-500/30 bg-blue-50/30 dark:bg-blue-950/10">
        <CardContent className="py-3 flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <span className="text-sm text-muted-foreground">
            <strong>Histórico Gestão</strong> = aba "Histórico" (fechamentos salvos) • <strong>Histórico Detalhado</strong> = expandir fechamento • <strong>Divergências</strong> = aba "Divergências" (contratos com |Δ| &gt; R$0,01)
          </span>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => { setSaveName(`Fechamento ${new Date().toLocaleDateString('pt-BR')}`); setSaveDialogOpen(true); }} disabled={auditData.length === 0}>
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
    </TooltipProvider>
  );
}
