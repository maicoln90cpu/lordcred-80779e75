import { useEffect, useCallback } from 'react';
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

export function useRealtimeChips(
  onUpdate: (chips: Chip[]) => void,
  userId?: string
) {
  const handleChange = useCallback(
    async (payload: ChipPayload) => {
      console.log('Realtime chip update:', payload.eventType, payload);
      
      // Refetch all chips to ensure consistency
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
    },
    [onUpdate, userId]
  );

  useEffect(() => {
    const channel = supabase
      .channel('chips-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chips',
        },
        handleChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [handleChange]);
}
