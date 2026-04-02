import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface Chip {
  id: string;
  slot_number: number;
  instance_name: string;
  phone_number: string | null;
  status: string;
  activated_at: string | null;
  messages_sent_today: number;
  last_message_at: string | null;
  user_id: string;
}

type ChipPayload = RealtimePostgresChangesPayload<Chip>;

const DEBOUNCE_MS = 1000;

export function useRealtimeChips(
  onUpdate: (chips: Chip[]) => void,
  userId?: string
) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (payload: ChipPayload) => {
      // If we have a userId filter, skip events for other users
      const newRecord = payload.new as Chip | undefined;
      if (userId && newRecord && newRecord.user_id && newRecord.user_id !== userId) {
        return;
      }

      // Debounce refetch to avoid rapid-fire queries
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        const query = supabase
          .from('chips')
          .select('*')
          .order('slot_number');

        if (userId) {
          query.eq('user_id', userId);
        }

        const { data } = await query;
        if (data) {
          onUpdate(data as Chip[]);
        }
      }, DEBOUNCE_MS);
    },
    [onUpdate, userId]
  );

  useEffect(() => {
    const filter = userId ? `user_id=eq.${userId}` : undefined;
    
    const channel = supabase
      .channel(`chips-realtime-${userId || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chips',
          ...(filter ? { filter } : {}),
        },
        handleChange
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [handleChange, userId]);
}
