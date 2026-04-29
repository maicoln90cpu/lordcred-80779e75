import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface QueuedBatch {
  id: string;
  name: string;
  total_count: number;
  queue_position: number;
  queued_at: string;
  config_name: string | null;
  installments: number | null;
  created_by: string;
}

/**
 * Etapa 4 (Item 10): hook que lê a fila de lotes do operador (status='queued').
 * Realtime: re-fetch quando v8_batches muda (insert/update/delete).
 */
export function useV8Queue() {
  const [queue, setQueue] = useState<QueuedBatch[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setQueue([]); setLoading(false); return; }
    const { data } = await supabase
      .from('v8_batches')
      .select('id, name, total_count, queue_position, queued_at, config_name, installments, created_by')
      .eq('queue_owner', user.id)
      .eq('status', 'queued')
      .order('queue_position', { ascending: true });
    setQueue((data ?? []) as QueuedBatch[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
    const ch = supabase
      .channel('v8-queue-watch')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'v8_batches' },
        () => refetch(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  return { queue, loading, refetch };
}
