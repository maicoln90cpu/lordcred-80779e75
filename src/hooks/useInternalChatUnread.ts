import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

const NOTIFICATION_SOUND = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGczHjqIr9fNdkQkMF2Yw9zEaTojNIGo0NvGdUMlOXCPt87JgVcsNmiIsMnMnWdFMDdljK3FzKlsSzM3W4WmwsyxdVIxMFWCobzIupVlTT4zVICjvL+rjHVfSD9LaoyfsrmzrZVsUjoxRGuJo7Kvq5Z7Zl1KNDpWhZ2rqpyKfnRmVkM2PVGBm6GckoZ7cmhcS0BAQ4ucnZaPh4V+dGxeTz05PUh3iZCNgoSDfnduY1RCP0FGcIWLhoGDhIF8dmtiVUlDQURBbICIhYOGhoR/eXJoX1VOSkRCQW5+hoODhoeFgHx1bWRcVk9KREFAbH2Eg4OGh4aAfHVtZF1XUUpFQUBtfYOCg4aGhYB8dW1kXVdRSkVBQGx8g4KDhoaFgHx1bWRdV1FKRUFAYH2EgoOGhoV/fHVtZF1XT0pEQQ==';

let audioInstance: HTMLAudioElement | null = null;

function playNotificationSound() {
  try {
    if (!audioInstance) {
      audioInstance = new Audio(NOTIFICATION_SOUND);
      audioInstance.volume = 0.3;
    }
    audioInstance.currentTime = 0;
    audioInstance.play().catch(() => {});
  } catch {}
}

export function useInternalChatUnread() {
  const { user } = useAuth();
  const [totalUnread, setTotalUnread] = useState(0);
  const unreadMap = useRef<Record<string, number>>({});
  const channelIdsRef = useRef<string[]>([]);
  const profilesRef = useRef<Record<string, { name: string | null; email: string }>>({});
  const initDoneRef = useRef(false);

  // Load user's channels and profiles
  useEffect(() => {
    if (!user) return;

    const init = async () => {
      const [membershipRes, profilesRes] = await Promise.all([
        supabase
          .from('internal_channel_members')
          .select('channel_id')
          .eq('user_id', user.id),
        supabase.rpc('get_internal_chat_profiles'),
      ]);

      if (membershipRes.data) {
        channelIdsRef.current = membershipRes.data.map(m => m.channel_id);
      }

      if (profilesRes.data) {
        const map: Record<string, { name: string | null; email: string }> = {};
        (profilesRes.data as any[]).forEach((p: any) => {
          map[p.user_id] = { name: p.name, email: p.email };
        });
        profilesRef.current = map;
      }
      
      initDoneRef.current = true;
    };

    init();
  }, [user]);

  // Subscribe to new messages globally
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('unread-badge-tracker')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'internal_messages',
      }, (payload) => {
        const msg = payload.new as any;
        if (msg.user_id === user.id) return;
        if (!channelIdsRef.current.includes(msg.channel_id)) return;

        // Increment unread
        unreadMap.current[msg.channel_id] = (unreadMap.current[msg.channel_id] || 0) + 1;
        const total = Object.values(unreadMap.current).reduce((a, b) => a + b, 0);
        setTotalUnread(total);

        // Play notification sound
        playNotificationSound();

        // Show toast notification
        const sender = profilesRef.current[msg.user_id];
        const senderName = sender?.name || sender?.email?.split('@')[0] || 'Alguém';
        toast({
          title: `💬 ${senderName}`,
          description: (msg.content as string).slice(0, 100),
        });
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Retry after 3 seconds
          setTimeout(() => {
            supabase.removeChannel(channel);
          }, 3000);
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markAsRead = useCallback((channelId: string) => {
    delete unreadMap.current[channelId];
    const total = Object.values(unreadMap.current).reduce((a, b) => a + b, 0);
    setTotalUnread(total);
  }, []);

  return { totalUnread, markAsRead };
}
