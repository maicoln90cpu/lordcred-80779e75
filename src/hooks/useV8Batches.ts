import { useEffect, useState, useCallback } from 'react';
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
  raw_response: any;
  processed_at: string | null;
  created_at: string;
}

export function useV8BatchSimulations(batchId: string | null) {
  const [simulations, setSimulations] = useState<V8Simulation[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!batchId) {
      setSimulations([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('v8_simulations')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: true });
    if (!error && data) setSimulations(data as unknown as V8Simulation[]);
    setLoading(false);
  }, [batchId]);

  useEffect(() => {
    reload();
    if (!batchId) return;
    const channel = supabase
      .channel(`v8-sims-${batchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'v8_simulations', filter: `batch_id=eq.${batchId}` },
        () => reload()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [batchId, reload]);

  return { simulations, loading, reload };
}
