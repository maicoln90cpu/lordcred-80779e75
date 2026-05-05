import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';

export interface V8Batch {
  id: string;
  name: string;
  created_by: string;
  config_id: string | null;
  config_name: string | null;
  installments: number | null;
  status: string;
  total_count: number;
  pending_count: number;
  success_count: number;
  failure_count: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  /** Etapa 2 (item 6): pausa lógica do lote — cron e poller pulam quando true. */
  is_paused?: boolean;
  paused_at?: string | null;
  paused_by?: string | null;
}

export interface UseV8BatchesOptions {
  /** Tamanho da página (default 50). */
  pageSize?: number;
  /** Página 0-indexed (default 0). */
  page?: number;
  /** Filtro por nome do lote (ILIKE). */
  search?: string;
  /** Filtro por status exato. Vazio/undefined = todos. */
  status?: string;
}

export function useV8Batches(options: UseV8BatchesOptions = {}) {
  const { isMenuOnly, userId } = useFeatureAccess('v8_simulador');
  const { pageSize = 50, page = 0, search = '', status = '' } = options;
  const [batches, setBatches] = useState<V8Batch[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const from = page * pageSize;
    const to = from + pageSize - 1;
    let q = supabase
      .from('v8_batches')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (isMenuOnly && userId) q = q.eq('created_by', userId);
    if (search.trim()) q = q.ilike('name', `%${search.trim()}%`);
    if (status) q = q.eq('status', status);
    const { data, error, count } = await q;
    if (!error && data) {
      setBatches(data as unknown as V8Batch[]);
      setTotalCount(count ?? 0);
    }
    setLoading(false);
  }, [isMenuOnly, userId, page, pageSize, search, status]);

  useEffect(() => {
    reload();
    const channel = supabase
      .channel('v8-batches-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'v8_batches' },
        () => reload()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [reload]);

  return { batches, loading, reload, totalCount, page, pageSize };
}

export interface V8Simulation {
  id: string;
  batch_id: string;
  cpf: string;
  name: string | null;
  birth_date: string | null;
  config_id: string | null;
  config_name: string | null;
  installments: number | null;
  status: string;
  released_value: number | null;
  installment_value: number | null;
  interest_rate: number | null;
  total_value: number | null;
  company_margin: number | null;
  amount_to_charge: number | null;
  /** Margem CONSIGNÁVEL DISPONÍVEL do trabalhador (vem da V8 como `availableMarginValue`).
   *  É o teto de parcela CLT — a info que o operador usa para qualificar o lead. */
  margem_valor: number | null;
  error_message: string | null;
  error_kind?: string | null;
  attempt_count?: number | null;
  last_attempt_at?: string | null;
  last_step?: string | null;
  raw_response: any;
  processed_at: string | null;
  created_at: string;
  webhook_status?: string | null;
  consult_id?: string | null;
  phone?: string | null;
  email?: string | null;
}

/**
 * Hook realtime para simulações de um lote.
 *
 * Padrão "subscribe-then-fetch" para evitar perder updates rápidos entre
 * o fetch inicial e o subscribe. Também expõe `lastUpdateAt` para a UI
 * mostrar "atualizado há Xs" e dar feedback de que o realtime está vivo.
 *
 * Pré-requisito: tabela `v8_simulations` precisa estar na publicação
 * `supabase_realtime` com REPLICA IDENTITY FULL (migração 2026-04-28).
 */
export function useV8BatchSimulations(batchId: string | null) {
  const [simulations, setSimulations] = useState<V8Simulation[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdateAt, setLastUpdateAt] = useState<Date | null>(null);
  const reloadingRef = useRef(false);

  const reload = useCallback(async () => {
    if (!batchId) {
      setSimulations([]);
      return;
    }
    if (reloadingRef.current) return;
    reloadingRef.current = true;
    setLoading(true);
    const { data, error } = await supabase
      .from('v8_simulations')
      .select('*')
      .eq('batch_id', batchId)
      // Etapa 1 (item 8): ordem original do colado. Lotes antigos (sem paste_order)
      // caem no fallback created_at — Postgres trata NULLS por último automaticamente.
      .order('paste_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });
    if (!error && data) {
      setSimulations(data as unknown as V8Simulation[]);
      setLastUpdateAt(new Date());
    }
    setLoading(false);
    reloadingRef.current = false;
  }, [batchId]);

  useEffect(() => {
    if (!batchId) return;
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    // Fallback de polling 10s — pausa quando aba não está visível para economizar egress.
    const startPolling = () => {
      if (pollTimer) return;
      const tick = () => {
        if (!cancelled && document.visibilityState === 'visible') reload();
      };
      pollTimer = setInterval(tick, 10_000);
    };
    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
    // Ao voltar pra aba, refetch imediato se polling está ativo
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && pollTimer && !cancelled) reload();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const channel = supabase
      .channel(`v8-sims-${batchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'v8_simulations',
          filter: `batch_id=eq.${batchId}`,
        },
        () => {
          if (!cancelled) reload();
        },
      )
      .subscribe((status) => {
        if (cancelled) return;
        if (status === 'SUBSCRIBED') {
          stopPolling();
          reload();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          startPolling();
        }
      });

    // Failsafe: se nada vier em 15s, liga polling de qualquer forma.
    const failsafe = setTimeout(() => {
      if (!cancelled) startPolling();
    }, 15_000);

    return () => {
      cancelled = true;
      clearTimeout(failsafe);
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibility);
      supabase.removeChannel(channel);
    };
  }, [batchId, reload]);

  return { simulations, loading, reload, lastUpdateAt };
}
