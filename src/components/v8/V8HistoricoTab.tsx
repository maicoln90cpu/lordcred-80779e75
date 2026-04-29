import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useV8Batches, useV8BatchSimulations } from '@/hooks/useV8Batches';
import { useV8Settings } from '@/hooks/useV8Settings';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { isRetriableErrorKind, MAX_AUTO_RETRY_ATTEMPTS } from '@/lib/v8ErrorClassification';
import {
  getV8ErrorMessageDeduped,
  getV8ErrorMeta,
  getV8StatusSnapshot,
  translateV8Status,
} from '@/lib/v8ErrorPresentation';
import { extractAvailableMargin, formatMarginBRL } from '@/lib/v8MarginExtractor';
import { MargemDispCell } from './MargemDispCell';
import { useV8StatusOnV8, V8StatusOnV8Dialog, ViewV8StatusButton } from './V8StatusOnV8Dialog';
import { AutoRetryIndicator, RealtimeFreshness } from './V8RealtimeIndicators';
import { AnimatedCountBadge } from './V8AnimatedCountBadge';
import { V8StatusGlossary } from './V8StatusGlossary';
import { ReuseMarginButton } from './ReuseMarginButton';
import CreateOperationButton from './CreateOperationButton';

// Retentável imediatamente: failed retentável OU pending preso (>60s sem novidade).
function isRetriableNow(s: any): boolean {
  const kind = s?.error_kind || s?.raw_response?.kind || s?.raw_response?.error_kind || null;
  if (!kind || !isRetriableErrorKind(kind)) return false;
  if (s.status === 'failed') return true;
  if (s.status === 'pending') {
    if (!s.last_attempt_at) return false;
    const ageMs = Date.now() - new Date(s.last_attempt_at).getTime();
    return ageMs > 60_000;
  }
  return false;
}

// Pending dentro do "cooldown" — vai entrar no próximo ciclo do cron.
function isRetriableSoon(s: any): boolean {
  const kind = s?.error_kind || s?.raw_response?.kind || s?.raw_response?.error_kind || null;
  if (!kind || !isRetriableErrorKind(kind)) return false;
  if (s.status !== 'pending' || !s.last_attempt_at) return false;
  const ageMs = Date.now() - new Date(s.last_attempt_at).getTime();
  return ageMs <= 60_000;
}

// Frente C: 1 query agregada + 1 subscribe global com debounce, em vez de 50
// queries + 50 canais realtime (1 por lote). Compartilhado por todos os
// BatchRetryHeaderBadge via contexto-leve baseado em estado de módulo.
const retryCountListeners = new Set<() => void>();
let retryCountCache: Record<string, { now: number; soon: number }> = {};
let retryCountLoaded = false;
let retryCountLoading = false;
let retryCountChannel: ReturnType<typeof supabase.channel> | null = null;
let retryDebounceTimer: ReturnType<typeof setTimeout> | null = null;

async function loadAllRetryCounts(batchIds: string[]) {
  if (retryCountLoading || batchIds.length === 0) return;
  retryCountLoading = true;
  try {
    const { data } = await supabase
      .from('v8_simulations')
      .select('batch_id, status, raw_response, error_kind, last_attempt_at')
      .in('batch_id', batchIds)
      .in('status', ['failed', 'pending']);
    const next: Record<string, { now: number; soon: number }> = {};
    for (const id of batchIds) next[id] = { now: 0, soon: 0 };
    (data ?? []).forEach((s: any) => {
      if (isRetriableNow(s)) next[s.batch_id].now += 1;
      else if (isRetriableSoon(s)) next[s.batch_id].soon += 1;
    });
    retryCountCache = next;
    retryCountLoaded = true;
    retryCountListeners.forEach((cb) => cb());
  } finally {
    retryCountLoading = false;
  }
}

function ensureRetryRealtime(batchIds: string[]) {
  if (retryCountChannel) return;
  retryCountChannel = supabase
    .channel('v8-retry-counts-global')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'v8_simulations' },
      () => {
        if (retryDebounceTimer) clearTimeout(retryDebounceTimer);
        retryDebounceTimer = setTimeout(() => loadAllRetryCounts(batchIds), 2000);
      },
    )
    .subscribe();
}

function BatchRetryHeaderBadge({ batchId }: { batchId: string }) {
  const [counts, setCounts] = useState<{ now: number; soon: number }>(
    () => retryCountCache[batchId] ?? { now: 0, soon: 0 },
  );

  useEffect(() => {
    const update = () => setCounts(retryCountCache[batchId] ?? { now: 0, soon: 0 });
    retryCountListeners.add(update);
    update();
    return () => {
      retryCountListeners.delete(update);
    };
  }, [batchId]);

  if (counts.now === 0 && counts.soon === 0) return null;

  const tooltip = `${counts.now} simulação(ões) prontas para retentar (clique no lote para abrir e usar "Retentar falhados").${counts.soon > 0 ? `\n${counts.soon} ainda em cooldown — o auto-retry pega automaticamente.` : ''}`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="border-yellow-500/40 text-yellow-600 cursor-help">
            {counts.now > 0 ? `${counts.now} p/ retentar` : `${counts.soon} aguard.`}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs whitespace-pre-line text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function BatchDetail({ batchId }: { batchId: string }) {
  const { simulations, lastUpdateAt } = useV8BatchSimulations(batchId);
  const { settings } = useV8Settings();
  const maxAttempts = settings?.max_auto_retry_attempts ?? MAX_AUTO_RETRY_ATTEMPTS;
  const { toast } = useToast();
  const [retrying, setRetrying] = useState(false);
  const [replaying, setReplaying] = useState(false);
  // IDs em retry "otimista": mantemos spinner na linha até o attempt_count
  // mudar no banco (via realtime), o que confirma que a V8 já recebeu.
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const status = useV8StatusOnV8();

  const failedRetriable = simulations.filter((s) => isRetriableNow(s));
  const autoRetryActive = simulations.filter(
    (s) => isRetriableNow(s) || isRetriableSoon(s),
  ).length;
  const hasPending = simulations.some((s) => s.status === 'pending');

  // Limpa o "retryingIds" assim que vemos attempt_count avançar.
  useEffect(() => {
    if (retryingIds.size === 0) return;
    setRetryingIds((prev) => {
      const next = new Set(prev);
      for (const sim of simulations) {
        if (next.has(sim.id) && (sim.attempt_count ?? 0) > 0) {
          // se atualização chegou pelo realtime, removemos o spinner.
          if (sim.last_attempt_at && new Date(sim.last_attempt_at).getTime() > Date.now() - 30_000) {
            next.delete(sim.id);
          }
        }
      }
      return next;
    });
  }, [simulations]);

  const handleRetry = async () => {
    if (failedRetriable.length === 0) return;
    setRetrying(true);
    const ids = new Set(failedRetriable.map((s) => s.id));
    setRetryingIds((prev) => new Set([...prev, ...ids]));
    try {
      const { data, error } = await supabase.functions.invoke('v8-retry-cron', {
        body: { batch_id: batchId, manual: true },
      });
      if (error) throw error;
      toast({
        title: '🔄 Retentativa enviada para a V8',
        description: `${(data as any)?.eligible ?? failedRetriable.length} simulação(ões) reenviadas. Acompanhe pela coluna "Tentativas" — atualiza ao vivo.`,
        duration: 6000,
      });
    } catch (err: any) {
      // Limpa optimistic em caso de erro
      setRetryingIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      toast({ title: 'Erro ao retentar', description: err?.message || String(err), variant: 'destructive' });
    } finally {
      setRetrying(false);
      // failsafe: limpa após 30s mesmo se realtime falhar
      setTimeout(() => {
        setRetryingIds((prev) => {
          const next = new Set(prev);
          for (const id of ids) next.delete(id);
          return next;
        });
      }, 30_000);
    }
  };

  const handleReplayPending = async () => {
    setReplaying(true);
    try {
      const { data, error } = await supabase.functions.invoke('v8-webhook', {
        body: { action: 'replay_pending', limit: 500, batch_id: batchId },
      });
      if (error) throw error;
      toast({
        title: 'Resultados pendentes buscados',
        description: `${data?.success ?? 0} ok · ${data?.failed ?? 0} falhas (de ${data?.total ?? 0})`,
      });
    } catch (err: any) {
      toast({ title: 'Falha ao buscar pendentes', description: err?.message || String(err), variant: 'destructive' });
    } finally {
      setReplaying(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-2 mt-2">
        <AutoRetryIndicator retryCount={autoRetryActive} maxAttempts={maxAttempts} />

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <RealtimeFreshness since={lastUpdateAt} />
          <div className="flex gap-2">
            {failedRetriable.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" onClick={handleRetry} disabled={retrying} className="h-7">
                    {retrying ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                    Retentar falhados ({failedRetriable.length})
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  Pede para a V8 fazer a consulta de novo nos CPFs que falharam por instabilidade ou análise pendente. Aumenta o número de "Tentativas".
                </TooltipContent>
              </Tooltip>
            )}
            {hasPending && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" onClick={handleReplayPending} disabled={replaying} className="h-7">
                    {replaying ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                    Buscar resultados pendentes
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  Pergunta à V8 se ela já tem resposta para consultas que enviamos mas que ainda não chegaram pelo webhook. Não conta como nova tentativa.
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        <div className="border rounded overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted">
              <tr>
                <th className="px-2 py-1 text-left">CPF</th>
                <th className="px-2 py-1 text-left">Nome</th>
                <th className="px-2 py-1 text-left">Status</th>
                <th className="px-2 py-1 text-right" title="Margem consignável disponível do trabalhador na V8 (availableMarginValue). É o teto de parcela CLT que o cliente pode contratar.">
                  💰 Margem Disponível
                </th>
                <th className="px-2 py-1 text-left" title="Faixa de meses e valores que a V8 aceita simular para este trabalhador (simulationLimit).">
                  📐 Limites V8
                </th>
                <th className="px-2 py-1 text-right">Liberado</th>
                <th className="px-2 py-1 text-right">Parcela</th>
                <th className="px-2 py-1 text-right" title="Cálculo interno LordCred — não é enviado à V8">Margem LordCred</th>
                <th className="px-2 py-1 text-right" title="Valor liberado menos a margem LordCred">A cobrar</th>
                <th className="px-2 py-1 text-center">Tentativas</th>
                <th className="px-2 py-1 text-left">Motivo</th>
                <th className="px-2 py-1 text-center">Ação</th>
              </tr>
            </thead>
            <tbody>
              {simulations.map((s) => {
                const kind = s.error_kind || s.raw_response?.kind || s.raw_response?.error_kind || null;
                const ws = ((s as any).webhook_status || '').toUpperCase();
                const isActiveConsult = kind === 'active_consult';
                // NOVO: pending+WAITING_EXTERNAL (active_consult que aguarda promoção) também mostra snapshot
                const isWaitingExternal = s.status === 'pending' && (isActiveConsult || ws === 'WAITING_EXTERNAL');
                const isCanceled = kind === 'canceled';
                const message = getV8ErrorMessageDeduped(s.raw_response, s.error_message);
                const meta = getV8ErrorMeta(s.raw_response);
                const hasInfo = !!(message || s.raw_response);
                const snapshot = (isActiveConsult || isWaitingExternal) ? getV8StatusSnapshot(s.raw_response) : null;
                const isRetryingRow = retryingIds.has(s.id);
                // Badge: amarelo (outline) para waiting_external e canceled
                const badgeVariant: any = isWaitingExternal || isCanceled
                  ? 'outline'
                  : s.status === 'success' ? 'default' : s.status === 'failed' ? 'destructive' : 'secondary';
                const badgeLabel = isWaitingExternal
                  ? 'aguardando consulta antiga'
                  : isCanceled
                    ? 'cancelado'
                    : translateV8Status(s.status);
                return (
                  <tr key={s.id} className={`border-t ${isRetryingRow ? 'animate-pulse bg-amber-500/5' : ''}`}>
                    <td className="px-2 py-1 font-mono">{s.cpf}</td>
                    <td className="px-2 py-1">{s.name || '—'}</td>
                    <td className="px-2 py-1">
                      <div className="flex items-center gap-1">
                        <Badge
                          variant={badgeVariant}
                          className={isWaitingExternal ? 'border-yellow-500/50 text-yellow-700 bg-yellow-500/10' : undefined}
                        >
                          {badgeLabel}
                        </Badge>
                        {(() => {
                          // Frente B: simulate_status vira ícone discreto, NÃO outro badge "failed"
                          // que confunde com o status principal. Só mostra quando relevante.
                          const ss = (s as any).simulate_status as string | null | undefined;
                          if (s.status !== 'success' || !ss || ss === 'not_started') return null;
                          if (ss === 'done') {
                            return (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 text-[10px] font-bold cursor-help">✓</span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs max-w-xs">
                                  Auto-simulação concluída — valores liberado/parcela são reais (não estimativa).
                                </TooltipContent>
                              </Tooltip>
                            );
                          }
                          if (ss === 'queued') {
                            return (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Loader2 className="w-3 h-3 text-blue-600 animate-spin cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs max-w-xs">
                                  Auto-simulação na fila — em breve teremos os valores reais.
                                </TooltipContent>
                              </Tooltip>
                            );
                          }
                          if (ss === 'failed') {
                            return (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertTriangle className="w-3 h-3 text-amber-500 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs max-w-xs">
                                  Auto-simulação falhou. A consulta foi OK (margem disponível abaixo), mas o cálculo de parcela não rodou. Use "Simular selecionados" no topo do lote para tentar de novo.
                                </TooltipContent>
                              </Tooltip>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </td>
                    <td className="px-2 py-1 text-right">
                      <MargemDispCell simulation={s as any} />
                    </td>
                    <td className="px-2 py-1 text-left">
                      {(() => {
                        const mMin = (s as any).sim_month_min;
                        const mMax = (s as any).sim_month_max;
                        const vMin = (s as any).sim_value_min;
                        const vMax = (s as any).sim_value_max;
                        const hasMonth = mMin != null && mMax != null;
                        const hasValue = vMin != null && vMax != null;
                        if (!hasMonth && !hasValue) return <span className="text-muted-foreground">—</span>;
                        const fmtBR = (n: number) =>
                          n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                        // Frente B: 999 é sentinela "ilimitado" da V8 — exibir como "24+ meses"
                        const renderMonths = () => {
                          const min = Number(mMin);
                          const max = Number(mMax);
                          if (max >= 999) return <div>{min}+ meses</div>;
                          return <div>{min}–{max} meses</div>;
                        };
                        const renderValues = () => {
                          const min = Number(vMin);
                          const max = Number(vMax);
                          const maxLabel = max >= 999_999 ? 'sem teto' : `R$ ${fmtBR(max)}`;
                          return (
                            <div className="text-muted-foreground">
                              R$ {fmtBR(min)}–{maxLabel}
                            </div>
                          );
                        };
                        return (
                          <div className="text-[11px] leading-tight">
                            {hasMonth && renderMonths()}
                            {hasValue && renderValues()}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-2 py-1 text-right">{s.released_value != null ? `R$ ${Number(s.released_value).toFixed(2)}` : '—'}</td>
                    <td className="px-2 py-1 text-right">{s.installment_value != null ? `R$ ${Number(s.installment_value).toFixed(2)}` : '—'}</td>
                    <td className="px-2 py-1 text-right">{s.company_margin != null ? `R$ ${Number(s.company_margin).toFixed(2)}` : '—'}</td>
                    <td className="px-2 py-1 text-right">{s.amount_to_charge != null ? `R$ ${Number(s.amount_to_charge).toFixed(2)}` : '—'}</td>
                    <td className={`px-2 py-1 text-center ${(s.attempt_count ?? 0) >= 2 ? 'font-bold text-amber-600' : ''}`}>
                      {isRetryingRow ? (
                        <span className="inline-flex items-center gap-1 text-amber-600">
                          <Loader2 className="w-3 h-3 animate-spin" /> {s.attempt_count ?? 0}
                        </span>
                      ) : (
                        <>
                          {s.attempt_count ?? 0}
                          {(s.attempt_count ?? 0) >= maxAttempts && (
                            <span className="text-[10px] block text-destructive">(máx)</span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-2 py-1 align-top">
                      {isActiveConsult ? (
                        <div className="space-y-1">
                          {snapshot?.hasData ? (
                            <>
                              <div className="font-medium text-amber-600" title="Não conseguimos abrir uma consulta NOVA porque a V8 ainda tem uma consulta deste CPF em aberto. Os dados abaixo são da consulta antiga que está bloqueando.">
                                Consulta antiga já existe na V8
                              </div>
                              <div className="text-[11px] space-y-0.5">
                                {snapshot.status && (
                                  <div>
                                    <span className="text-muted-foreground">Status da consulta antiga:</span>{' '}
                                    <span className={`font-semibold ${snapshot.status === 'REJECTED' || snapshot.status === 'FAILED' ? 'text-destructive' : (snapshot.status === 'SUCCESS' || snapshot.status === 'CONSENT_APPROVED') ? 'text-emerald-600' : ''}`}>
                                      {snapshot.status}
                                    </span>
                                    {snapshot.status === 'SUCCESS' && (
                                      <span className="text-[10px] text-emerald-600 ml-1">(margem já liberada — pode aproveitar)</span>
                                    )}
                                  </div>
                                )}
                                {snapshot.name && (
                                  <div>
                                    <span className="text-muted-foreground">Nome:</span> {snapshot.name}
                                  </div>
                                )}
                                {snapshot.detail && (
                                  <div className="text-muted-foreground italic">{snapshot.detail}</div>
                                )}
                                {snapshot.totalConsults > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => status.check(s.cpf, s.id)}
                                    className="text-[10px] underline text-muted-foreground hover:text-foreground"
                                  >
                                    Ver todas as {snapshot.totalConsults} consultas
                                  </button>
                                )}
                                <div className="pt-1">
                                  <ReuseMarginButton
                                    simulationId={s.id}
                                    rawResponse={s.raw_response}
                                  />
                                </div>
                              </div>
                            </>
                          ) : snapshot?.rateLimited ? (
                            <>
                              <div className="font-medium text-amber-600">Já existe consulta ativa para este CPF na V8</div>
                              <div className="text-[10px] text-muted-foreground italic">
                                V8 limitou as consultas. Nova tentativa automática em instantes.
                              </div>
                              <ViewV8StatusButton onClick={() => status.check(s.cpf, s.id)} />
                            </>
                          ) : snapshot?.probedAt ? (
                            <>
                              <div className="font-medium text-amber-600">Já existe consulta ativa para este CPF na V8</div>
                              <div className="text-[10px] text-muted-foreground italic">
                                {snapshot.message || 'Sem retorno da V8 nessa busca.'} Clique para consultar manualmente.
                              </div>
                              <ViewV8StatusButton onClick={() => status.check(s.cpf, s.id)} />
                            </>
                          ) : (
                            <>
                              <div className="whitespace-pre-line font-medium text-amber-600">
                                Já existe consulta ativa para este CPF na V8
                              </div>
                              <div className="text-[10px] text-muted-foreground italic">
                                Buscando status na V8... pode levar alguns instantes.
                              </div>
                              <ViewV8StatusButton onClick={() => status.check(s.cpf, s.id)} />
                            </>
                          )}
                        </div>
                      ) : hasInfo ? (
                        <div className="space-y-1">
                          <div className="whitespace-pre-line font-medium">
                            {message || 'Sem detalhe informado'}
                          </div>
                          {(meta.step || meta.kind) && (
                            <div className="text-[11px] text-muted-foreground">
                              {meta.step ? `etapa: ${meta.step}` : null}
                              {meta.step && meta.kind ? ' • ' : null}
                              {meta.kind ? `tipo: ${meta.kind}` : null}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-center">
                      {s.status === 'success' && s.consult_id ? (
                        <CreateOperationButton
                          consultId={s.consult_id}
                          simulationId={s.id}
                          origin="simulation"
                          originId={s.id}
                          prefill={{
                            cpf: s.cpf,
                            name: s.name || undefined,
                            birth_date: s.birth_date || undefined,
                            phone: s.phone || undefined,
                            email: s.email || undefined,
                          }}
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px]"
                          label="Criar proposta"
                        />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <V8StatusOnV8Dialog open={status.open} onOpenChange={status.setOpen} data={status.data} />
      </div>
    </TooltipProvider>
  );
}

export default function V8HistoricoTab() {
  const { batches, loading } = useV8Batches();
  const [expanded, setExpanded] = useState<string | null>(null);

  // Frente C: 1 query agregada + 1 subscribe global ao carregar os lotes.
  // Antes: cada BatchRetryHeaderBadge abria seu próprio canal realtime
  // (50 lotes = 50 canais + 50 queries individuais).
  useEffect(() => {
    if (batches.length === 0) return;
    const ids = batches.map((b) => b.id);
    void loadAllRetryCounts(ids);
    ensureRetryRealtime(ids);
  }, [batches]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Histórico de Lotes</span>
          <V8StatusGlossary />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!loading && batches.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum lote encontrado.</p>
        )}
        <div className="space-y-2">
          {batches.map((b) => {
            const successRate = b.total_count > 0 ? Math.round((b.success_count / b.total_count) * 100) : 0;
            const isOpen = expanded === b.id;
            return (
              <div key={b.id} className="border rounded">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpanded(isOpen ? null : b.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(isOpen ? null : b.id); } }}
                  className="w-full flex items-center gap-2 p-3 hover:bg-muted/50 transition-colors text-left cursor-pointer select-none"
                >
                  {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <div className="flex-1">
                    <div className="font-medium text-sm">{b.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {b.config_name || b.config_id} • {b.installments}x • {new Date(b.created_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <Badge variant={b.status === 'completed' ? 'default' : 'secondary'}>
                    {translateV8Status(b.status)}
                  </Badge>
                  <AnimatedCountBadge value={b.success_count} variant="outline" pulseClass="bg-emerald-500/20 border-emerald-500/40">
                    {b.success_count}/{b.total_count} ok
                  </AnimatedCountBadge>
                  <AnimatedCountBadge value={b.failure_count} variant="outline" pulseClass="bg-destructive/20 border-destructive/40">
                    {b.failure_count} falha
                  </AnimatedCountBadge>
                  <Badge variant="outline">{successRate}%</Badge>
                  <BatchRetryHeaderBadge batchId={b.id} />
                </div>
                {isOpen && <div className="px-3 pb-3"><BatchDetail batchId={b.id} /></div>}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
