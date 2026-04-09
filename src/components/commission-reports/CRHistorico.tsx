import { useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, History, Trash2, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { TSHead, useSortState, applySortToData, TOOLTIPS_HISTORICO } from './CRSortUtils';

const fmtBRL = (v: number | null) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string | null) => {
  if (!d) return '-';
  try { return format(new Date(d), 'dd/MM/yyyy'); } catch { return '-'; }
};

interface Gestao { id: string; nome: string; qtd_propostas: number | null; valor_liberado: number | null; comissao_esperada: number | null; comissao_recebida: number | null; diferenca: number | null; data_inicio: string | null; data_fim: string | null; created_at: string; }
interface Detalhe { id: string; num_contrato: string | null; nome: string | null; banco: string | null; produto: string | null; valor_liberado: number | null; comissao_esperada: number | null; comissao_recebida: number | null; diferenca: number | null; data_pago: string | null; }

export default function CRHistorico() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Gestao | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { sort: detailSort, toggle: toggleDetailSort } = useSortState();

  const { data: gestoes = [], isLoading } = useQuery({
    queryKey: ['cr-historico'],
    queryFn: async () => { const { data, error } = await supabase.from('cr_historico_gestao').select('*').order('created_at', { ascending: false }).limit(100); if (error) throw error; return data as Gestao[]; },
  });

  const { data: detalhes = [] } = useQuery({
    queryKey: ['cr-historico-detalhes', expanded],
    enabled: !!expanded,
    queryFn: async () => {
      // Batch fetch to get all details (may exceed 1000)
      let all: Detalhe[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase.from('cr_historico_detalhado').select('*').eq('gestao_id', expanded!).order('banco').range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data as Detalhe[]);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });

  const sortedDetalhes = applySortToData(detalhes, detailSort);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error: dErr } = await supabase.from('cr_historico_detalhado').delete().eq('gestao_id', deleteTarget.id);
      if (dErr) throw dErr;
      const { error } = await supabase.from('cr_historico_gestao').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast({ title: 'Fechamento excluído' }); setDeleteTarget(null);
      if (expanded === deleteTarget.id) setExpanded(null);
      qc.invalidateQueries({ queryKey: ['cr-historico'] });
    } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
    finally { setDeleting(false); }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><History className="w-5 h-5" /> Histórico de Fechamentos</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : gestoes.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">Nenhum fechamento salvo. Use a aba Resumo para salvar um fechamento.</p>
        ) : (
          <div className="space-y-3">
            {gestoes.map(g => {
              const isOpen = expanded === g.id;
              const dif = g.diferenca ?? 0;
              return (
                <Collapsible key={g.id} open={isOpen} onOpenChange={open => setExpanded(open ? g.id : null)}>
                  <div className="border rounded-lg">
                    <div className="flex items-center justify-between p-4">
                      <CollapsibleTrigger className="flex items-center gap-3 flex-1 text-left hover:opacity-80">
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <div>
                          <p className="font-medium">{g.nome}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="secondary" className="text-[10px]">{g.qtd_propostas} contratos</Badge>
                            {g.data_inicio && g.data_fim && <span className="text-xs text-muted-foreground">{new Date(g.data_inicio).toLocaleDateString('pt-BR')} — {new Date(g.data_fim).toLocaleDateString('pt-BR')}</span>}
                            <span className="text-xs text-muted-foreground">Salvo em {new Date(g.created_at).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-sm">
                          <p className="text-muted-foreground">Recebida: <span className="text-green-600 font-mono">{fmtBRL(g.comissao_recebida)}</span></p>
                          <p className="text-muted-foreground">Esperada: <span className="font-mono">{fmtBRL(g.comissao_esperada)}</span></p>
                          <p className={`font-bold font-mono ${dif > 0.01 ? 'text-green-600' : dif < -0.01 ? 'text-destructive' : ''}`}>Δ {fmtBRL(dif)}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(g)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                    <CollapsibleContent>
                      <div className="border-t px-4 pb-4 pt-2">
                        <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                          <div>Valor Liberado: <strong className="font-mono">{fmtBRL(g.valor_liberado)}</strong></div>
                          <div>Comissão Recebida: <strong className="font-mono text-green-600">{fmtBRL(g.comissao_recebida)}</strong></div>
                          <div>Comissão Esperada: <strong className="font-mono">{fmtBRL(g.comissao_esperada)}</strong></div>
                        </div>
                        {detalhes.length === 0 ? (
                          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                        ) : (
                          <div className="border rounded-lg max-h-[400px] overflow-auto">
                            <Table className="min-w-[900px]">
                              <TableHeader>
                                <tr>
                                  <TSHead label="Contrato" sortKey="num_contrato" sort={detailSort} toggle={toggleDetailSort} tooltip={TOOLTIPS_HISTORICO.num_contrato} className="text-xs" />
                                  <TSHead label="Data" sortKey="data_pago" sort={detailSort} toggle={toggleDetailSort} tooltip="Data de pagamento" className="text-xs" />
                                  <TSHead label="Banco" sortKey="banco" sort={detailSort} toggle={toggleDetailSort} tooltip={TOOLTIPS_HISTORICO.banco} className="text-xs" />
                                  <TSHead label="Produto" sortKey="produto" sort={detailSort} toggle={toggleDetailSort} tooltip={TOOLTIPS_HISTORICO.produto} className="text-xs" />
                                  <TSHead label="Valor Lib." sortKey="valor_liberado" sort={detailSort} toggle={toggleDetailSort} tooltip={TOOLTIPS_HISTORICO.valor_liberado} className="text-xs text-right" />
                                  <TSHead label="Recebida" sortKey="comissao_recebida" sort={detailSort} toggle={toggleDetailSort} tooltip={TOOLTIPS_HISTORICO.comissao_recebida} className="text-xs text-right" />
                                  <TSHead label="Esperada" sortKey="comissao_esperada" sort={detailSort} toggle={toggleDetailSort} tooltip={TOOLTIPS_HISTORICO.comissao_esperada} className="text-xs text-right" />
                                  <TSHead label="Diferença" sortKey="diferenca" sort={detailSort} toggle={toggleDetailSort} tooltip={TOOLTIPS_HISTORICO.diferenca} className="text-xs text-right" />
                                </tr>
                              </TableHeader>
                              <TableBody>
                                {sortedDetalhes.map(d => {
                                  const dd = d.diferenca ?? 0;
                                  return (
                                    <TableRow key={d.id} className={Math.abs(dd) > 0.01 ? 'bg-destructive/5' : ''}>
                                      <TableCell className="text-xs font-mono">{d.num_contrato || '-'}</TableCell>
                                      <TableCell className="text-xs font-mono whitespace-nowrap">{fmtDate(d.data_pago)}</TableCell>
                                      <TableCell className="text-xs">{d.banco}</TableCell>
                                      <TableCell className="text-xs">{d.produto}</TableCell>
                                      <TableCell className="text-xs text-right font-mono">{fmtBRL(d.valor_liberado)}</TableCell>
                                      <TableCell className="text-xs text-right font-mono">{fmtBRL(d.comissao_recebida)}</TableCell>
                                      <TableCell className="text-xs text-right font-mono">{fmtBRL(d.comissao_esperada)}</TableCell>
                                      <TableCell className={`text-xs text-right font-mono font-bold ${dd > 0.01 ? 'text-green-600' : dd < -0.01 ? 'text-destructive' : ''}`}>{fmtBRL(dd)}</TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" /> Excluir Fechamento</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Excluir <strong>"{deleteTarget?.nome}"</strong> e todos os <strong>{deleteTarget?.qtd_propostas}</strong> detalhes associados?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Excluir'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
