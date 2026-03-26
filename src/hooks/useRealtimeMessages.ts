import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface MessageHistory {
  id: string;
  chip_id: string;
  direction: string;
  message_content: string;
  recipient_phone: string | null;
  status: string;
  created_at: string;
}

type MessagePayload = RealtimePostgresChangesPayload<MessageHistory>;

export function useRealtimeMessages(
  onInsert: (message: MessageHistory) => void,
  chipIds?: string[]
) {
  const handleChange = useCallback(
    (payload: MessagePayload) => {
      if (payload.eventType === 'INSERT') {
        const newMessage = payload.new as MessageHistory;
        
        // If we have chip filter, only notify if message is for one of our chips
        if (chipIds && chipIds.length > 0) {
          if (!chipIds.includes(newMessage.chip_id)) {
            return;
          }
        }
        
        console.log('Realtime new message:', newMessage);
        onInsert(newMessage);
      }
    },
    [onInsert, chipIds]
  );

  useEffect(() => {
    // If we have specific chip IDs, create filtered subscriptions to reduce egress
    // Otherwise fall back to unfiltered (admin/global views)
    if (chipIds && chipIds.length > 0) {
      const channels = chipIds.map((cid, idx) =>
        supabase
          .channel(`messages-realtime-${cid}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'message_history',
              filter: `chip_id=eq.${cid}`,
            },
            handleChange
          )
          .subscribe()
      );

      return () => {
        channels.forEach(ch => supabase.removeChannel(ch));
      };
    } else {
      const channel = supabase
        .channel('messages-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'message_history',
          },
          handleChange
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [handleChange, chipIds]);
}
