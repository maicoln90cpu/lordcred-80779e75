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
  }, [handleChange]);
}
