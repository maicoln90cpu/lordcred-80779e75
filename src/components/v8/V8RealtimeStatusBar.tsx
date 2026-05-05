import { useEffect, useRef, useState } from 'react';
import { Loader2, Wifi, WifiOff, Activity, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useV8Settings } from '@/hooks/useV8Settings';
import { isRetriableErrorKind, MAX_AUTO_RETRY_ATTEMPTS } from '@/lib/v8ErrorClassification';
import { playBatchCompleteSound } from '@/lib/v8Sound';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { triggerLauncherShortLoop } from '@/lib/v8LauncherTrigger';

type ConnectionState = 'connecting' | 'live' | 'polling' | 'offline';

interface BatchAggregate {
  active_batches: number;
  retrying_consults: number;
  retrying_simulations: number;
  stale_retrying_simulations: number;
  awaiting_v8: number;
  last_cron_at: string | null;
  zombie_batches: Array<{ id: string; name: string; updated_at: string }>;
}

/**
 * Barra global no topo de /admin/v8-simulador.
 */
export function V8RealtimeStatusBar() {
  const { settings } = useV8Settings();
  const maxAttempts = settings?.max_auto_retry_attempts ?? MAX_AUTO_RETRY_ATTEMPTS;
  const soundOn = settings?.sound_on_complete ?? false;

  const [agg, setAgg] = useState<BatchAggregate>({ active_batches: 0, retrying_consults: 0, retrying_simulations: 0, stale_retrying_simulations: 0, awaiting_v8: 0, last_cron_at: null, zombie_batches: [] });
  const [conn, setConn] = useState<ConnectionState>('connecting');
  const lastBatchStateRef = useRef<Map<string, { status: string; success: number; failure: number }>>(new Map());
  const aggRef = useRef(agg);
  aggRef.current = agg;
  const [forcingZombie, setForcingZombie] = useState<string | null>(null);

  const refresh = async () => {
    const last24hIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const activeSinceIso = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: cronLog } = await supabase
      .from('audit_logs')
      .select('created_at')
      .eq('action', 'v8_retry_cron_cycle')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastCronAt = cronLog?.created_at ?? null;

    const { data: batches } = await supabase
      .from('v8_batches')
      .select('id, status, success_count, failure_count, total_count, created_at, updated_at, name, created_by')
      .gte('created_at', last24hIso)
      .order('created_at', { ascending: false })
      .limit(50);

    const activeBatches = (batches || []).filter(
      (b: any) => b.status !== 'completed' && b.status !== 'cancelled',
    );

    // Detectar lotes zumbi: processing há >10 min sem update
    const zombieCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: { user } } = await supabase.auth.getUser();
    const zombies = (batches || []).filter(
      (b: any) => b.status === 'processing' && b.updated_at < zombieCutoff && b.created_by === user?.id,
    ).map((b: any) => ({ id: b.id, name: b.name || '(sem nome)', updated_at: b.updated_at }));

    // Sons de conclusão
    if (soundOn && batches) {
      for (const b of batches as any[]) {
        const prev = lastBatchStateRef.current.get(b.id);
        if (prev && prev.status !== 'completed' && b.status === 'completed') {
          const ok = b.success_count >= b.failure_count;
          playBatchCompleteSound(ok);
          toast(ok ? '✅ Lote concluído com sucesso' : '⚠️ Lote concluído com falhas', {
            description: `${b.success_count} ok · ${b.failure_count} falha de ${b.total_count}`,
          });
        }
        lastBatchStateRef.current.set(b.id, {
          status: b.status,
          success: b.success_count,
          failure: b.failure_count,
        });
      }
    }

    if (activeBatches.length === 0 && zombies.length === 0) {
      setAgg({ active_batches: 0, retrying_consults: 0, retrying_simulations: 0, stale_retrying_simulations: 0, awaiting_v8: 0, last_cron_at: lastCronAt, zombie_batches: [] });
      return;
    }

    const ids = activeBatches.map((b: any) => b.id);
    let retriableSims: any[] = [];
    let awaitingV8 = 0;
    if (ids.length > 0) {
      const { data: sims } = await supabase
        .from('v8_simulations')
        .select('status, error_kind, last_attempt_at, raw_response, last_step')
        .in('batch_id', ids)
        .in('status', ['failed', 'pending']);

      retriableSims = (sims || []).filter((s: any) => {
        const kind = s.error_kind || s.raw_response?.kind || s.raw_response?.error_kind || null;
        return isRetriableErrorKind(kind);
      });

      awaitingV8 = (sims || []).filter((s: any) => {
        const kind = s.error_kind || s.raw_response?.kind || s.raw_response?.error_kind || null;
        if (isRetriableErrorKind(kind)) return false;
        return kind === 'active_consult' || (s.status === 'pending' && !kind);
      }).length;
    }

    const recentRetriable = retriableSims.filter(
      (s: any) => s.last_attempt_at && s.last_attempt_at >= activeSinceIso,
    );
    const retryingConsults = recentRetriable.filter((s: any) => {
      const step = String(s.last_step ?? '');
      return step === '' || step.startsWith('consult');
    }).length;
    const retryingSimulations = recentRetriable.filter((s: any) => {
      const step = String(s.last_step ?? '');
      return step.startsWith('simulate');
    }).length;
    const staleRetryingCount = retriableSims.length - recentRetriable.length;

    setAgg({
      active_batches: activeBatches.length,
      retrying_consults: retryingConsults,
      retrying_simulations: retryingSimulations,
      stale_retrying_simulations: staleRetryingCount,
      awaiting_v8: awaitingV8,
      last_cron_at: lastCronAt,
      zombie_batches: zombies,
    });

    // Etapa 3: Watchdog do front. Se há lote queued há >2min do usuário atual
    // e não há nenhum processing ativo, re-dispara o launcher (idempotente).
    // Cobre o caso do cron atrasar ou a salva inicial ter falhado.
    try {
      const watchdogCutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const myQueuedStuck = (batches || []).filter(
        (b: any) =>
          b.status === 'queued' &&
          b.created_by === user?.id &&
          b.created_at < watchdogCutoff,
      );
      const anyProcessing = (batches || []).some((b: any) => b.status === 'processing');
      if (myQueuedStuck.length > 0 && !anyProcessing) {
        triggerLauncherShortLoop({ reason: 'watchdog-queued-stuck' });
      }
    } catch {}
  };

  const forceCloseZombie = async (batchId: string) => {
    setForcingZombie(batchId);
    try {
      const { error } = await supabase
        .from('v8_batches')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', batchId)
        .eq('status', 'processing');
      if (error) throw error;
      toast.success('Lote zumbi encerrado. Fila desbloqueada.');
      // Trigger launcher to promote next queued batch (short-loop 3x).
      triggerLauncherShortLoop({ reason: 'zombie-close' });
      await refresh();
    } catch (e: any) {
      toast.error('Falha ao encerrar lote: ' + (e?.message || e));
    } finally {
      setForcingZombie(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    void refresh();

    const channel = supabase
      .channel('v8-global-status-bar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'v8_batches' }, () => {
        if (!cancelled) void refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'v8_simulations' }, () => {
        if (!cancelled) void refresh();
      })
      .subscribe((status) => {
        if (cancelled) return;
        if (status === 'SUBSCRIBED') {
          setConn('live');
          if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConn('polling');
          if (!pollTimer) {
            pollTimer = setInterval(() => {
              if (!cancelled) void refresh();
            }, 10_000);
          }
        }
      });

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundOn]);

  const dot =
    conn === 'live' ? 'bg-emerald-500' : conn === 'polling' ? 'bg-amber-500' : conn === 'offline' ? 'bg-destructive' : 'bg-muted-foreground';

  const label =
    conn === 'live'
      ? 'Tempo real ativo'
      : conn === 'polling'
        ? 'Conexão instável — atualizando a cada 10s'
        : conn === 'offline'
          ? 'Sem conexão'
          : 'Conectando…';

  const Icon = conn === 'live' ? Wifi : conn === 'polling' ? Activity : WifiOff;

  const isHealthy =
    conn === 'live' &&
    agg.active_batches === 0 &&
    agg.awaiting_v8 === 0 &&
    agg.retrying_simulations === 0 &&
    agg.stale_retrying_simulations === 0 &&
    agg.zombie_batches.length === 0;

  const [forceExpanded, setForceExpanded] = useState(false);
  const collapsed = isHealthy && !forceExpanded;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setForceExpanded(true)}
        className="group inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition"
        title="Tudo certo — clique para ver detalhes da V8"
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="font-medium">V8 estável</span>
        <span className="text-emerald-600/70 dark:text-emerald-500/70 group-hover:underline">expandir</span>
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/50 px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${dot} ${conn === 'live' ? 'animate-pulse' : ''}`} />
          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-medium">{label}</span>
          {settings?.max_concurrent_batches_per_owner && settings.max_concurrent_batches_per_owner > 1 && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
              title={`Você pode rodar até ${settings.max_concurrent_batches_per_owner} lotes em paralelo (configurável em Configurações).`}
            >
              ⚡ Paralelismo {settings.max_concurrent_batches_per_owner}x
            </span>
          )}
          {isHealthy && forceExpanded && (
            <button
              type="button"
              onClick={() => setForceExpanded(false)}
              className="ml-2 text-[10px] text-muted-foreground hover:text-foreground underline"
            >
              recolher
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 justify-end">
          {agg.retrying_consults > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-600" title="Consultas (etapa /consult) com erro retentável que tiveram tentativa nos últimos 5 min.">
              <Loader2 className="w-3 h-3 animate-spin" />
              <strong>{agg.retrying_consults} consulta(s) em retry</strong>
            </span>
          )}
          {agg.retrying_simulations > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-600" title="Simulações (etapa /simulate) com erro retentável que tiveram tentativa nos últimos 5 min.">
              <Loader2 className="w-3 h-3 animate-spin" />
              <strong>{agg.retrying_simulations} simulação(ões) em retry</strong>
            </span>
          )}
          {(agg.retrying_consults > 0 || agg.retrying_simulations > 0) && (
            <span
              className="text-muted-foreground underline decoration-dotted cursor-help"
              title={`Cada simulação tenta no máximo ${maxAttempts} ciclos internos automáticos (consulta + aceite + cálculo). Após esgotar, fica como falha definitiva. Esse limite NÃO conta novas simulações manuais — cada novo disparo do mesmo CPF gera um novo registro com seu próprio contador de ciclos.`}
            >· teto {maxAttempts} ciclos por simulação ⓘ</span>
          )}
          {agg.awaiting_v8 > 0 && (
            <span className="inline-flex items-center gap-1 text-sky-600" title="Aguardando a V8: 'consulta ativa' bloqueada ou pending sem resposta. NÃO é nosso retry — é a V8 quem precisa responder/liberar.">
              <Clock className="w-3 h-3" />
              <strong>{agg.awaiting_v8} aguardando V8</strong>
            </span>
          )}
          {agg.stale_retrying_simulations > 0 && (
            <span className="text-muted-foreground" title="Retentáveis sem tentativa nos últimos 5 min — o cron pode estar atrasado.">
              · {agg.stale_retrying_simulations} sem tentativa recente
            </span>
          )}
          {agg.active_batches > 0 && (
            <span className="text-muted-foreground">
              · {agg.active_batches} lote(s) ativo(s)
            </span>
          )}
          {agg.active_batches === 0 && agg.awaiting_v8 === 0 && agg.retrying_consults === 0 && agg.retrying_simulations === 0 && agg.zombie_batches.length === 0 && (
            <span className="text-muted-foreground">Sem lotes em processamento</span>
          )}
          {agg.last_cron_at && (
            <span className="text-[11px] text-muted-foreground" title="Última execução do cron de retry (varredura a cada ~20s).">
              · varredura {timeAgo(agg.last_cron_at)}
            </span>
          )}
        </div>
      </div>

      {/* Alerta de lotes zumbi */}
      {agg.zombie_batches.length > 0 && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm space-y-2">
          <div className="flex items-center gap-2 text-red-400 font-medium">
            <AlertTriangle className="w-4 h-4" />
            {agg.zombie_batches.length} lote(s) zumbi bloqueando sua fila
          </div>
          <p className="text-xs text-red-300/80">
            Esses lotes estão em "processing" há mais de 10 min sem atualização. Eles impedem que novos lotes da fila comecem. Clique em "Forçar encerramento" para desbloqueá-los.
          </p>
          <div className="space-y-1">
            {agg.zombie_batches.map(z => (
              <div key={z.id} className="flex items-center justify-between gap-2 rounded border border-red-500/30 bg-red-950/30 px-2 py-1.5 text-xs">
                <div>
                  <span className="font-medium text-red-300">{z.name}</span>
                  <span className="text-red-400/60 ml-2">parado há {timeAgo(z.updated_at)}</span>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-6 text-[10px] px-2"
                  disabled={forcingZombie === z.id}
                  onClick={() => forceCloseZombie(z.id)}
                >
                  {forcingZombie === z.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Forçar encerramento'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `há ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  return `há ${h}h`;
}
