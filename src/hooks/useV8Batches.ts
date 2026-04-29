import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
}

export function useV8Batches() {
  const [batches, setBatches] = useState<V8Batch[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('v8_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data) setBatches(data as unknown as V8Batch[]);
    setLoading(false);
  }, []);

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

  return { batches, loading, reload };
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

    // Fallback de polling 10s — garante que mesmo com WS caído a UI atualiza.
    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = setInterval(() => {
        if (!cancelled) reload();
      }, 10_000);
    };
    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

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
      supabase.removeChannel(channel);
    };
  }, [batchId, reload]);

  return { simulations, loading, reload, lastUpdateAt };
}
