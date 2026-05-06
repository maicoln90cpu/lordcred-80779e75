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
  /** Etapa 2 (mai/2026): filtro por data de criação (ISO yyyy-mm-dd, inclusive). */
  dateFrom?: string;
  dateTo?: string;
  /** Etapa 2 (mai/2026): coluna para ordenação. Default created_at. */
  orderBy?: 'name' | 'config_name' | 'total_count' | 'success_count' | 'failure_count' | 'status' | 'created_at';
  orderDir?: 'asc' | 'desc';
}

export function useV8Batches(options: UseV8BatchesOptions = {}) {
  const { isMenuOnly, userId } = useFeatureAccess('v8_simulador');
  const {
    pageSize = 50, page = 0, search = '', status = '',
    dateFrom = '', dateTo = '',
    orderBy = 'created_at', orderDir = 'desc',
  } = options;
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
      .order(orderBy, { ascending: orderDir === 'asc' })
      .range(from, to);
    if (isMenuOnly && userId) q = q.eq('created_by', userId);
    if (search.trim()) q = q.ilike('name', `%${search.trim()}%`);
    if (status) q = q.eq('status', status);
    if (dateFrom) q = q.gte('created_at', `${dateFrom}T00:00:00-03:00`);
    if (dateTo) q = q.lte('created_at', `${dateTo}T23:59:59-03:00`);
    const { data, error, count } = await q;
    if (!error && data) {
      setBatches(data as unknown as V8Batch[]);
      setTotalCount(count ?? 0);
    }
    setLoading(false);
  }, [isMenuOnly, userId, page, pageSize, search, status, dateFrom, dateTo, orderBy, orderDir]);

  useEffect(() => {
    reload();
    // Mai/2026: debounce de 300ms — agrupa rajadas de UPDATE (ex.: contador
    // atômico atualizando success_count + failure_count em sequência) e evita
    // re-fetch sob pressão durante lotes grandes.
    let pending: ReturnType<typeof setTimeout> | null = null;
    const debouncedReload = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => { pending = null; reload(); }, 300);
    };
    const channel = supabase
      .channel('v8-batches-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'v8_batches' },
        debouncedReload
      )
      .subscribe();
    return () => {
      if (pending) clearTimeout(pending);
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
export interface V8BatchMeta {
  id: string;
  status: string;
  scheduled_payload: any;
  queue_position: number | null;
  queue_owner: string | null;
  installments: number | null;
  name: string;
  /** Etapa 2 (mai/2026 — item 6): pausa/auto-best expostos para a UI do histórico. */
  is_paused?: boolean;
  paused_at?: string | null;
  auto_best_enabled?: boolean;
  config_id?: string | null;
}

export function useV8BatchSimulations(batchId: string | null) {
  const [simulations, setSimulations] = useState<V8Simulation[]>([]);
  const [batch, setBatch] = useState<V8BatchMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdateAt, setLastUpdateAt] = useState<Date | null>(null);
  const reloadingRef = useRef(false);

  const reload = useCallback(async () => {
    if (!batchId) {
      setSimulations([]);
      setBatch(null);
      return;
    }
    if (reloadingRef.current) return;
    reloadingRef.current = true;
    setLoading(true);
    const [{ data, error }, { data: batchData }] = await Promise.all([
      supabase
        .from('v8_simulations')
        .select('*')
        .eq('batch_id', batchId)
        .order('paste_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true }),
      supabase
        .from('v8_batches')
        .select('id, status, scheduled_payload, queue_position, queue_owner, installments, name, is_paused, paused_at, auto_best_enabled, config_id')
        .eq('id', batchId)
        .maybeSingle(),
    ]);
    if (!error && data) {
      setSimulations(data as unknown as V8Simulation[]);
      setLastUpdateAt(new Date());
    }
    if (batchData) setBatch(batchData as unknown as V8BatchMeta);
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
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'v8_batches',
          filter: `id=eq.${batchId}`,
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

  // Etapa 2 (mai/2026 — item 4): polling adaptativo de 3s enquanto o lote
  // não materializou simulações (ex.: "Ver progresso" recém-aberto).
  // Corrige o lag de "tabela vazia" quando o usuário abre um lote queued/processing
  // antes do v8_simulations ser populado.
  useEffect(() => {
    if (!batchId) return;
    if (simulations.length > 0) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') reload();
    }, 3_000);
    return () => clearInterval(t);
  }, [batchId, simulations.length, reload]);

  return { simulations, batch, loading, reload, lastUpdateAt };
}
