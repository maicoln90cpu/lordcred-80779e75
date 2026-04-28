import { useEffect, useRef, useState } from 'react';
import { Loader2, Wifi, WifiOff, Activity, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useV8Settings } from '@/hooks/useV8Settings';
import { isRetriableErrorKind, MAX_AUTO_RETRY_ATTEMPTS } from '@/lib/v8ErrorClassification';
import { playBatchCompleteSound } from '@/lib/v8Sound';
import { toast } from 'sonner';

type ConnectionState = 'connecting' | 'live' | 'polling' | 'offline';

interface BatchAggregate {
  active_batches: number;
  retrying_simulations: number;
  stale_retrying_simulations: number;
  awaiting_v8: number; // active_consult / pending sem kind — V8 ainda vai responder, NÃO é retry nosso
  last_cron_at: string | null;
}

/**
 * Barra global no topo de /admin/v8-simulador.
 *
 * Mostra:
 *  - 🟢/🟡/🔴 conexão WebSocket Realtime
 *  - "Auto-retry: X simulações em N lotes"
 *  - Fallback automático para polling de 10s se o WS cair
 *
 * Também dispara o som de "lote concluído" se o usuário ativou o toggle
 * em Configurações.
 */
export function V8RealtimeStatusBar() {
  const { settings } = useV8Settings();
  const maxAttempts = settings?.max_auto_retry_attempts ?? MAX_AUTO_RETRY_ATTEMPTS;
  const soundOn = settings?.sound_on_complete ?? false;

  const [agg, setAgg] = useState<BatchAggregate>({ active_batches: 0, retrying_simulations: 0, stale_retrying_simulations: 0 });
  const [conn, setConn] = useState<ConnectionState>('connecting');
  const lastBatchStateRef = useRef<Map<string, { status: string; success: number; failure: number }>>(new Map());
  const aggRef = useRef(agg);
  aggRef.current = agg;

  const refresh = async () => {
    const last24hIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const activeSinceIso = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // Lotes ativos visíveis = recentes; lotes antigos não entram na badge do topo.
    const { data: batches } = await supabase
      .from('v8_batches')
      .select('id, status, success_count, failure_count, total_count, created_at')
      .gte('created_at', last24hIso)
      .order('created_at', { ascending: false })
      .limit(50);

    const activeBatches = (batches || []).filter(
      (b: any) => b.status !== 'completed' && b.status !== 'cancelled',
    );

    // Sons de conclusão: detectar transição (qualquer status → completed)
    if (soundOn && batches) {
      for (const b of batches as any[]) {
        const prev = lastBatchStateRef.current.get(b.id);
        if (prev && prev.status !== 'completed' && b.status === 'completed') {
          // sucesso quando >50% ok; do contrário, "falha"
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

    if (activeBatches.length === 0) {
      setAgg({ active_batches: 0, retrying_simulations: 0, stale_retrying_simulations: 0 });
      return;
    }

    const ids = activeBatches.map((b: any) => b.id);
    const { data: sims } = await supabase
      .from('v8_simulations')
      .select('status, error_kind, last_attempt_at, raw_response')
      .in('batch_id', ids)
      .in('status', ['failed', 'pending']);

    const retriableSims = (sims || []).filter((s: any) => {
      const kind = s.error_kind || s.raw_response?.kind || s.raw_response?.error_kind || null;
      return isRetriableErrorKind(kind);
    });

    const retryingCount = retriableSims.filter((s: any) => s.last_attempt_at && s.last_attempt_at >= activeSinceIso).length;
    const staleRetryingCount = retriableSims.length - retryingCount;

    setAgg({ active_batches: activeBatches.length, retrying_simulations: retryingCount, stale_retrying_simulations: staleRetryingCount });
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
          // Fallback: polling de 10 em 10s enquanto o WS estiver caído
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

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/50 px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <span className={`inline-block w-2 h-2 rounded-full ${dot} ${conn === 'live' ? 'animate-pulse' : ''}`} />
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="font-medium">{label}</span>
      </div>

      <div className="flex items-center gap-3">
        {agg.retrying_simulations > 0 && (
          <span className="inline-flex items-center gap-1 text-amber-600">
            <Loader2 className="w-3 h-3 animate-spin" />
            <strong>Auto-retry:</strong> {agg.retrying_simulations} simulação(ões) em {agg.active_batches} lote(s) ativo(s)
            <span className="text-muted-foreground">· teto {maxAttempts} tent.</span>
          </span>
        )}
        {agg.retrying_simulations === 0 && agg.active_batches > 0 && (
          <span className="text-muted-foreground">
            {agg.active_batches} lote(s) ativo(s) — todas as simulações estão respondendo normalmente
            {agg.stale_retrying_simulations > 0 && ` · ${agg.stale_retrying_simulations} retentável(eis) sem tentativa recente`}
          </span>
        )}
        {agg.active_batches === 0 && (
          <span className="text-muted-foreground">Sem lotes em processamento</span>
        )}
      </div>
    </div>
  );
}
