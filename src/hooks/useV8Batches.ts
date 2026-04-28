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
  error_message: string | null;
  error_kind?: string | null;
  attempt_count?: number | null;
  last_attempt_at?: string | null;
  last_step?: string | null;
  raw_response: any;
  processed_at: string | null;
  created_at: string;
  webhook_status?: string | null;
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

    // Subscribe-then-fetch: primeiro liga o canal, depois faz a 1ª carga.
    // Assim qualquer UPDATE que chegue durante o fetch já vai ser refletido
    // no próximo reload disparado pelo evento.
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
        if (status === 'SUBSCRIBED' && !cancelled) {
          reload();
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [batchId, reload]);

  return { simulations, loading, reload, lastUpdateAt };
}
