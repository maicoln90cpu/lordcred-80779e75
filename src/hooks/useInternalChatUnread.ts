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
  const [unreadByChannel, setUnreadByChannel] = useState<Record<string, number>>({});
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const unreadMap = useRef<Record<string, number>>({});
  const channelIdsRef = useRef<string[]>([]);
  const profilesRef = useRef<Record<string, { name: string | null; email: string }>>({});
  const activeChannelRef = useRef<string | null>(null);

  // Allow external components to set which channel is currently active (suppress notifications for it)
  const setActiveChannel = useCallback((channelId: string | null) => {
    activeChannelRef.current = channelId;
  }, []);

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

        // If user is actively viewing this channel, don't count as unread
        if (activeChannelRef.current === msg.channel_id) return;

        // Increment unread
        unreadMap.current[msg.channel_id] = (unreadMap.current[msg.channel_id] || 0) + 1;
        const newMap = { ...unreadMap.current };
        setUnreadByChannel(newMap);
        const total = Object.values(newMap).reduce((a, b) => a + b, 0);
        setTotalUnread(total);

        // Play notification sound
        playNotificationSound();

        // Show toast notification
        const sender = profilesRef.current[msg.user_id];
        const senderName = sender?.name || sender?.email?.split('@')[0] || 'Alguém';
        const content = msg.media_type ? `📎 ${msg.media_type === 'image' ? 'Imagem' : msg.media_type === 'audio' ? 'Áudio' : msg.media_type === 'video' ? 'Vídeo' : 'Arquivo'}` : (msg.content as string);
        toast({
          title: `💬 ${senderName}`,
          description: content.slice(0, 100),
        });
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setTimeout(() => {
            supabase.removeChannel(channel);
          }, 3000);
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Presence tracking
  useEffect(() => {
    if (!user) return;

    const presenceChannel = supabase.channel('internal-chat-presence', {
      config: { presence: { key: user.id } },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const ids = new Set<string>(Object.keys(state));
        setOnlineUsers(ids);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user_id: user.id, online_at: new Date().toISOString() });
        }
      });

    return () => { supabase.removeChannel(presenceChannel); };
  }, [user]);

  const markAsRead = useCallback((channelId: string) => {
    delete unreadMap.current[channelId];
    const newMap = { ...unreadMap.current };
    setUnreadByChannel(newMap);
    const total = Object.values(newMap).reduce((a, b) => a + b, 0);
    setTotalUnread(total);
  }, []);

  return { totalUnread, unreadByChannel, onlineUsers, markAsRead, setActiveChannel };
}
