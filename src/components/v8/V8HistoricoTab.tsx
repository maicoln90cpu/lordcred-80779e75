import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, RefreshCw, Loader2 } from 'lucide-react';
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
import { useV8StatusOnV8, V8StatusOnV8Dialog, ViewV8StatusButton } from './V8StatusOnV8Dialog';
import { AutoRetryIndicator, RealtimeFreshness } from './V8RealtimeIndicators';

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

// Botão "Retentar agora (N)" no header de cada lote — não exige expandir o detalhe.
function BatchRetryHeaderButton({ batchId }: { batchId: string }) {
  const { toast } = useToast();
  const [counts, setCounts] = useState<{ now: number; soon: number }>({ now: 0, soon: 0 });
  const [retrying, setRetrying] = useState(false);

  const loadCount = async () => {
    const { data } = await supabase
      .from('v8_simulations')
      .select('id, status, raw_response, error_kind, last_attempt_at')
      .eq('batch_id', batchId)
      .in('status', ['failed', 'pending']);
    const list = data || [];
    setCounts({
      now: list.filter((s: any) => isRetriableNow(s)).length,
      soon: list.filter((s: any) => isRetriableSoon(s)).length,
    });
  };

  useEffect(() => {
    loadCount();
    const channel = supabase
      .channel(`v8-retry-count-${batchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'v8_simulations', filter: `batch_id=eq.${batchId}` },
        () => loadCount(),
      )
      .subscribe();
    // tick a cada 30s para reavaliar "soon → now" mesmo sem evento
    const tick = setInterval(loadCount, 30_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(tick);
    };
  }, [batchId]);

  const handleRetry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (counts.now === 0) return;
    setRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke('v8-retry-cron', {
        body: { batch_id: batchId, manual: true },
      });
      if (error) throw error;
      toast({
        title: 'Retentativa iniciada',
        description: `${(data as any)?.eligible ?? counts.now} simulações reenviadas. Resultados aparecerão nesta tela em segundos.`,
      });
      setTimeout(loadCount, 3000);
    } catch (err: any) {
      toast({ title: 'Erro ao retentar', description: err?.message || String(err), variant: 'destructive' });
    } finally {
      setRetrying(false);
    }
  };

  if (counts.now === 0 && counts.soon === 0) return null;

  const tooltip = `Conta apenas linhas que já passaram do tempo de espera (60s). Linhas recentes serão retentadas automaticamente pelo cron a cada 1 min.${counts.soon > 0 ? `\n\n${counts.soon} pendente(s) ainda no cooldown.` : ''}`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRetry}
            disabled={retrying || counts.now === 0}
            className="h-7 border-yellow-500/40 text-yellow-600 hover:bg-yellow-500/10"
          >
            {retrying ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            Retentar agora ({counts.now})
            {counts.soon > 0 && (
              <span className="ml-1 text-[10px] text-muted-foreground">+{counts.soon} aguard.</span>
            )}
          </Button>
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
                  Refaz a consulta do zero na V8 para falhas temporárias (rate limit / análise pendente).
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
                  Busca na V8 respostas de consultas já enviadas que não chegaram pelo webhook.
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
                <th className="px-2 py-1 text-right">Liberado</th>
                <th className="px-2 py-1 text-right">Parcela</th>
                <th className="px-2 py-1 text-right">Margem</th>
                <th className="px-2 py-1 text-right">A cobrar</th>
                <th className="px-2 py-1 text-center">Tentativas</th>
                <th className="px-2 py-1 text-left">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {simulations.map((s) => {
                const kind = s.error_kind || s.raw_response?.kind || s.raw_response?.error_kind || null;
                const isActiveConsult = kind === 'active_consult';
                const message = getV8ErrorMessageDeduped(s.raw_response, s.error_message);
                const meta = getV8ErrorMeta(s.raw_response);
                const hasInfo = !!(message || s.raw_response);
                const snapshot = isActiveConsult ? getV8StatusSnapshot(s.raw_response) : null;
                const isRetryingRow = retryingIds.has(s.id);
                return (
                  <tr key={s.id} className={`border-t ${isRetryingRow ? 'animate-pulse bg-amber-500/5' : ''}`}>
                    <td className="px-2 py-1 font-mono">{s.cpf}</td>
                    <td className="px-2 py-1">{s.name || '—'}</td>
                    <td className="px-2 py-1">
                      <Badge
                        variant={s.status === 'success' ? 'default' : s.status === 'failed' ? 'destructive' : 'secondary'}
                      >
                        {translateV8Status(s.status)}
                      </Badge>
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
                              <div className="font-medium text-amber-600">
                                Consulta ativa na V8
                              </div>
                              <div className="text-[11px] space-y-0.5">
                                {snapshot.status && (
                                  <div>
                                    <span className="text-muted-foreground">Status:</span>{' '}
                                    <span className={`font-semibold ${snapshot.status === 'REJECTED' ? 'text-destructive' : snapshot.status === 'CONSENT_APPROVED' ? 'text-emerald-600' : ''}`}>
                                      {snapshot.status}
                                    </span>
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
                                    onClick={() => status.check(s.cpf)}
                                    className="text-[10px] underline text-muted-foreground hover:text-foreground"
                                  >
                                    Ver todas as {snapshot.totalConsults} consultas
                                  </button>
                                )}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="whitespace-pre-line font-medium text-amber-600">
                                Já existe consulta ativa para este CPF na V8
                              </div>
                              <div className="text-[10px] text-muted-foreground italic">
                                Buscando status na V8... (atualiza em até 1 min)
                              </div>
                              <ViewV8StatusButton onClick={() => status.check(s.cpf)} />
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Lotes</CardTitle>
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
                  <Badge variant="outline">{b.success_count}/{b.total_count} ok</Badge>
                  <Badge variant="outline">{successRate}%</Badge>
                  <BatchRetryHeaderButton batchId={b.id} />
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
