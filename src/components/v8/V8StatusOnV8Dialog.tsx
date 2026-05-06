import { useState, useCallback, forwardRef } from 'react';
import { Loader2, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { JsonTreeView } from '@/components/admin/JsonTreeView';
import { extractAvailableMargin, formatMarginBRL } from '@/lib/v8MarginExtractor';
import { supabase } from '@/integrations/supabase/client';

/**
 * Dialog reutilizável "Ver status na V8".
 *
 * Mostra (quando disponível na resposta da V8):
 *  - Status / Nome / Data
 *  - Resultado da simulação (valor liberado, parcela, margem, prazo, banco, taxa)
 *  - Histórico de todas as consultas para o CPF
 *  - Payload bruto (JSON) colapsável para inspeção total
 */
export function useV8StatusOnV8() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{
    cpf: string;
    loading: boolean;
    result: any | null;
    error: string | null;
  }>({ cpf: '', loading: false, result: null, error: null });

  /**
   * Busca o status na V8 e, se um `simulationId` for fornecido, também grava o
   * snapshot na própria linha (raw_response.v8_status_snapshot). Assim a tabela
   * passa a mostrar o resultado inline mesmo sem esperar o poller automático.
   */
  const check = useCallback(async (cpf: string, simulationId?: string) => {
    setOpen(true);
    setData({ cpf, loading: true, result: null, error: null });
    try {
      const { data: resp, error } = await supabase.functions.invoke('v8-clt-api', {
        body: { action: 'check_consult_status', params: { cpf } },
      });
      if (error) throw error;
      if (!resp?.success) {
        setData({ cpf, loading: false, result: null, error: resp?.user_message || resp?.error || 'Falha ao consultar' });
        return;
      }
      setData({ cpf, loading: false, result: resp.data, error: null });

      // Persiste snapshot na linha — best-effort, não bloqueia o usuário se falhar.
      if (simulationId && resp?.data) {
        try {
          const probedAtIso = new Date().toISOString();
          const { data: current } = await supabase
            .from('v8_simulations')
            .select('raw_response')
            .eq('id', simulationId)
            .maybeSingle();
          const baseRaw = (current?.raw_response as any) ?? {};
          await supabase
            .from('v8_simulations')
            .update({
              raw_response: {
                ...baseRaw,
                v8_status_snapshot: { ...(resp.data as object), probed_at: probedAtIso },
              },
              v8_status_snapshot_at: probedAtIso,
            })
            .eq('id', simulationId);
        } catch (_) { /* ignore — UI já mostrou resultado */ }
      }
    } catch (err: any) {
      setData({ cpf, loading: false, result: null, error: err?.message || String(err) });
    }
  }, []);

  return { open, setOpen, data, check };
}

function formatBRL(n: any): string | null {
  const num = Number(n);
  if (!Number.isFinite(num)) return null;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Extrai os campos financeiros que a V8 retorna (variam de plano para plano).
 * Procura tanto no nó "latest" quanto em "raw" / "data" / sub-objetos comuns.
 */
function extractSimulationData(latest: any) {
  if (!latest || typeof latest !== 'object') return null;
  // V8 às vezes aninha em "result", "simulation", "data", etc.
  const candidates = [latest, latest.result, latest.simulation, latest.data, latest.proposal].filter(Boolean);
  const out: Record<string, any> = {};
  for (const c of candidates) {
    out.released_value ??= c.released_value ?? c.disbursed_amount ?? c.valor_liberado;
    out.installment_value ??= c.installment_value ?? c.installment_face_value ?? c.valor_parcela;
    out.installments ??= c.installments ?? c.number_of_installments ?? c.parcelas ?? c.prazo;
    out.interest_rate ??= c.interest_rate ?? c.rate ?? c.taxa;
    out.bank_name ??= c.bank_name ?? c.bank ?? c.banco;
    out.company_margin ??= c.company_margin ?? c.margem ?? c.margin;
    out.amount_to_charge ??= c.amount_to_charge ?? c.total_value ?? c.valor_total;
  }
  const hasAny = Object.values(out).some((v) => v != null);
  return hasAny ? out : null;
}

/**
 * Extrai os "Limites V8" oficiais (`simulationLimit` + `admissionDateMonthsDifference`)
 * do payload de consulta SUCCESS. Vem direto da doc oficial V8.
 */
function extractV8Limits(result: any) {
  if (!result || typeof result !== 'object') return null;
  const candidates = [result, result.latest, result.data, result.result].filter(Boolean);
  const num = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  let admission: number | null = null;
  let monthMin: number | null = null, monthMax: number | null = null;
  let instMin: number | null = null, instMax: number | null = null;
  let valueMin: number | null = null, valueMax: number | null = null;
  for (const c of candidates) {
    admission ??= num(c?.admissionDateMonthsDifference);
    monthMin ??= num(c?.simulationLimit?.monthMin);
    monthMax ??= num(c?.simulationLimit?.monthMax);
    instMin ??= num(c?.simulationLimit?.installmentsMin);
    instMax ??= num(c?.simulationLimit?.installmentsMax);
    valueMin ??= num(c?.simulationLimit?.valueMin);
    valueMax ??= num(c?.simulationLimit?.valueMax);
  }
  const hasAny = [admission, monthMin, monthMax, instMin, instMax, valueMin, valueMax].some((v) => v != null);
  return hasAny ? { admission, monthMin, monthMax, instMin, instMax, valueMin, valueMax } : null;
}

export function V8StatusOnV8Dialog({
  open,
  onOpenChange,
  data,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: { cpf: string; loading: boolean; result: any | null; error: string | null };
}) {
  const [showJson, setShowJson] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const latest = data.result?.latest ?? null;
  const all: any[] = Array.isArray(data.result?.all) ? data.result.all : [];
  const sim = extractSimulationData(latest);
  const limits = extractV8Limits(data.result);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Status da consulta na V8</DialogTitle>
          <DialogDescription>
            CPF: <span className="font-mono">{data.cpf}</span>
          </DialogDescription>
        </DialogHeader>

        {data.loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Buscando na V8...
          </div>
        ) : data.error ? (
          <div className="text-sm text-destructive whitespace-pre-line">{data.error}</div>
        ) : data.result?.found === false ? (
          <div className="text-sm text-muted-foreground">
            {data.result.message || 'Nenhuma consulta encontrada na V8 para este CPF.'}
          </div>
        ) : latest ? (
          <div className="space-y-4 text-sm">
            {/* Bloco DESTAQUE — Margem Disponível do trabalhador */}
            {(() => {
              const margin =
                extractAvailableMargin(data.result) ??
                extractAvailableMargin(latest) ??
                (Array.isArray(data.result?.all)
                  ? data.result.all
                      .map((c: any) => extractAvailableMargin(c))
                      .find((v: number | null) => v != null) ?? null
                  : null);
              if (margin == null) return null;
              return (
                <div
                  className="rounded-lg border-2 border-emerald-500/40 bg-emerald-500/10 p-4"
                  title="Margem consignável disponível do trabalhador (vem da V8). Diferente da Margem LordCred (cálculo interno de 5%)."
                >
                  <div className="text-xs uppercase tracking-wide text-emerald-700 font-semibold flex items-center gap-1">
                    💰 Margem disponível
                  </div>
                  <div className="text-2xl font-bold text-emerald-700 mt-1">
                    {formatMarginBRL(margin)} <span className="text-xs font-normal text-emerald-700/80">/ mês</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Teto de parcela CLT consignável que o cliente pode contratar.
                  </div>
                </div>
              );
            })()}

            {/* Bloco DESTAQUE — Limites de Simulação V8 (doc oficial: simulationLimit + admissionDateMonthsDifference) */}
            {limits && (
              <div
                className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3"
                title="Limites operacionais retornados pela V8 (simulationLimit). Use para escolher tabela e parcelas dentro do que a V8 aceita para este CPF."
              >
                <div className="text-xs uppercase tracking-wide text-blue-700 font-semibold mb-2">
                  📐 Limites de simulação V8
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {(limits.monthMin != null || limits.monthMax != null) && (
                    <div>
                      <div className="text-muted-foreground">Faixa de meses</div>
                      <div className="font-semibold">{limits.monthMin ?? '?'}–{limits.monthMax ?? '?'} m</div>
                    </div>
                  )}
                  {(limits.instMin != null || limits.instMax != null) && (
                    <div>
                      <div className="text-muted-foreground">Parcelas</div>
                      <div className="font-semibold">{limits.instMin ?? '?'}–{limits.instMax ?? '?'} x</div>
                    </div>
                  )}
                  {(limits.valueMin != null || limits.valueMax != null) && (
                    <div>
                      <div className="text-muted-foreground">Valor da operação</div>
                      <div className="font-semibold">
                        {formatBRL(limits.valueMin) ?? '?'} – {formatBRL(limits.valueMax) ?? '?'}
                      </div>
                    </div>
                  )}
                  {limits.admission != null && (
                    <div className="col-span-3">
                      <div className="text-muted-foreground">Tempo desde admissão</div>
                      <div className="font-semibold">{limits.admission} meses</div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <section className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Última consulta
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <Badge
                    variant={latest.status === 'CONSENT_APPROVED' || latest.status === 'SUCCESS' ? 'default' : latest.status === 'REJECTED' ? 'destructive' : 'secondary'}
                  >
                    {latest.status ?? '—'}
                  </Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Criada em</div>
                  <div>
                    {latest.createdAt ? new Date(latest.createdAt).toLocaleString('pt-BR') : '—'}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground">Nome</div>
                  <div>{latest.name ?? '—'}</div>
                </div>
                {latest.detail && (
                  <div className="col-span-2">
                    <div className="text-xs text-muted-foreground">Motivo / detalhe</div>
                    <div className="text-muted-foreground whitespace-pre-line">{latest.detail}</div>
                  </div>
                )}
              </div>
            </section>

            {/* Bloco 2 — Resultado da simulação (quando V8 já calculou) */}
            {sim && (
              <section className="space-y-2 border-t pt-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Resultado da simulação
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {sim.released_value != null && (
                    <div>
                      <div className="text-muted-foreground">Valor liberado</div>
                      <div className="font-semibold">{formatBRL(sim.released_value) ?? '—'}</div>
                    </div>
                  )}
                  {sim.installment_value != null && (
                    <div>
                      <div className="text-muted-foreground">Valor da parcela</div>
                      <div className="font-semibold">{formatBRL(sim.installment_value) ?? '—'}</div>
                    </div>
                  )}
                  {sim.installments != null && (
                    <div>
                      <div className="text-muted-foreground">Parcelas</div>
                      <div className="font-semibold">{sim.installments}x</div>
                    </div>
                  )}
                  {sim.interest_rate != null && (
                    <div>
                      <div className="text-muted-foreground">Taxa</div>
                      <div className="font-semibold">{sim.interest_rate}{typeof sim.interest_rate === 'number' && sim.interest_rate < 1 ? '%' : ''}</div>
                    </div>
                  )}
                  {sim.bank_name && (
                    <div>
                      <div className="text-muted-foreground">Banco</div>
                      <div className="font-semibold">{sim.bank_name}</div>
                    </div>
                  )}
                  {sim.company_margin != null && (
                    <div>
                      <div className="text-muted-foreground">Margem LordCred</div>
                      <div className="font-semibold">{formatBRL(sim.company_margin) ?? '—'}</div>
                    </div>
                  )}
                  {sim.amount_to_charge != null && (
                    <div>
                      <div className="text-muted-foreground">A cobrar</div>
                      <div className="font-semibold">{formatBRL(sim.amount_to_charge) ?? '—'}</div>
                    </div>
                  )}
                </div>

                {(() => {
                  // Composição financeira — Etapa 6: explica liberado vs total pago.
                  // Só renderiza quando temos os 3 valores essenciais.
                  // eslint-disable-next-line @typescript-eslint/no-var-requires
                  const { computeFinancialBreakdown } = require('@/lib/v8FinancialComposition');
                  const b = computeFinancialBreakdown(sim.released_value, sim.installment_value, sim.installments);
                  if (!b) return null;
                  return (
                    <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs space-y-1">
                      <div className="font-semibold text-amber-700 dark:text-amber-400">
                        💡 Composição financeira (entenda os números)
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <div><span className="text-muted-foreground">Total a pagar:</span> <strong>{formatBRL(b.totalPaid)}</strong> ({b.installments}× {formatBRL(b.installment)})</div>
                        <div><span className="text-muted-foreground">Juros totais:</span> <strong>{formatBRL(b.totalInterest)}</strong></div>
                        <div><span className="text-muted-foreground">Markup sobre o liberado:</span> <strong>{b.markupPct.toFixed(1)}%</strong></div>
                        {b.monthlyRatePct != null && (
                          <div><span className="text-muted-foreground">CET aprox.:</span> <strong>{b.monthlyRatePct.toFixed(2)}% a.m.</strong> ({b.annualRatePct?.toFixed(1)}% a.a.)</div>
                        )}
                      </div>
                      <div className="text-muted-foreground italic mt-1">
                        O cliente recebe {formatBRL(b.released)} hoje e devolve {formatBRL(b.totalPaid)} ao final — a diferença ({formatBRL(b.totalInterest)}) é o custo do crédito.
                      </div>
                    </div>
                  );
                })()}
              </section>
            )}

            {/* Bloco 3 — Histórico de todas as consultas */}
            {all.length > 1 && (
              <section className="space-y-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground"
                >
                  {showAll ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  Todas as consultas ({all.length})
                </button>
                {showAll && (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {all.map((c: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs border rounded px-2 py-1">
                        <Badge variant={c.status === 'REJECTED' ? 'destructive' : c.status === 'CONSENT_APPROVED' ? 'default' : 'secondary'}>
                          {c.status ?? '—'}
                        </Badge>
                        <span className="text-muted-foreground">
                          {c.createdAt ? new Date(c.createdAt).toLocaleString('pt-BR') : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Bloco 4 — JSON bruto */}
            <section className="space-y-2 border-t pt-3">
              <button
                type="button"
                onClick={() => setShowJson((v) => !v)}
                className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground"
              >
                {showJson ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Ver dados completos (JSON)
              </button>
              {showJson && (
                <div className="border rounded p-2 max-h-64 overflow-auto bg-muted/30">
                  <JsonTreeView data={data.result} />
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Sem dados.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Botão padrão "Ver status na V8" — reutilizado nas tabelas de Nova Simulação e Histórico.
 * Usa forwardRef porque pode ser embrulhado em <TooltipTrigger asChild>.
 */
export const ViewV8StatusButton = forwardRef<
  HTMLButtonElement,
  { onClick: () => void } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(function ViewV8StatusButton({ onClick, ...rest }, ref) {
  return (
    <Button ref={ref} size="sm" variant="outline" onClick={onClick} {...rest}>
      <Search className="w-3 h-3 mr-1" /> Ver status na V8
    </Button>
  );
});
