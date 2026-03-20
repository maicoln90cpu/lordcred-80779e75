import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
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

interface UnreadContextType {
  totalUnread: number;
  unreadByChannel: Record<string, number>;
  onlineUsers: Set<string>;
  markAsRead: (channelId: string) => void;
  setActiveChannel: (channelId: string | null) => void;
  refreshUnread: () => void;
}

const InternalChatUnreadContext = createContext<UnreadContextType>({
  totalUnread: 0,
  unreadByChannel: {},
  onlineUsers: new Set(),
  markAsRead: () => {},
  setActiveChannel: () => {},
  refreshUnread: () => {},
});

export function useInternalChatUnreadContext() {
  return useContext(InternalChatUnreadContext);
}

export function InternalChatUnreadProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [totalUnread, setTotalUnread] = useState(0);
  const [unreadByChannel, setUnreadByChannel] = useState<Record<string, number>>({});
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const channelIdsRef = useRef<string[]>([]);
  const profilesRef = useRef<Record<string, { name: string | null; email: string }>>({});
  const activeChannelRef = useRef<string | null>(null);

  const setActiveChannel = useCallback((channelId: string | null) => {
    activeChannelRef.current = channelId;
  }, []);

  // Hydrate unread from server
  const refreshUnread = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.rpc('get_internal_unread_counts' as any);
    const map: Record<string, number> = {};
    if (data) {
      (data as any[]).forEach((row: any) => {
        map[row.channel_id] = Number(row.unread_count);
      });
    }
    setUnreadByChannel(map);
    setTotalUnread(Object.values(map).reduce((a, b) => a + b, 0));
  }, [user]);

  // Load channels + profiles
  const refreshChannels = useCallback(async () => {
    if (!user) return;
    const [membershipRes, profilesRes] = await Promise.all([
      supabase.from('internal_channel_members').select('channel_id').eq('user_id', user.id),
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
  }, [user]);

  useEffect(() => {
    refreshChannels().then(() => refreshUnread());
  }, [refreshChannels, refreshUnread]);

  // Listen for channel member changes
  useEffect(() => {
    if (!user) return;
    const memberChannel = supabase
      .channel('uchat-member-tracker')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internal_channel_members' }, (payload) => {
        const row = (payload.new || payload.old) as any;
        if (row?.user_id === user.id) {
          refreshChannels().then(() => refreshUnread());
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(memberChannel); };
  }, [user, refreshChannels, refreshUnread]);

  // Subscribe to new messages for real-time increment
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('uchat-unread-tracker')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'internal_messages' }, (payload) => {
        const msg = payload.new as any;
        if (msg.user_id === user.id) return;
        if (!channelIdsRef.current.includes(msg.channel_id)) return;

        // If user is actively viewing this channel on /chat page, mark as read instead
        if (activeChannelRef.current === msg.channel_id && window.location.pathname.includes('/chat')) {
          // Don't increment — user is watching this channel
          return;
        }

        // Increment locally
        setUnreadByChannel((prev: Record<string, number>) => {
          const next: Record<string, number> = { ...prev, [msg.channel_id]: (prev[msg.channel_id] || 0) + 1 };
          const total = Object.keys(next).reduce((sum, k) => sum + next[k], 0);
          setTotalUnread(total);
          return next;
        });

        playNotificationSound();

        const sender = profilesRef.current[msg.user_id];
        const senderName = sender?.name || sender?.email?.split('@')[0] || 'Alguém';
        const content = msg.media_type
          ? `📎 ${msg.media_type === 'image' ? 'Imagem' : msg.media_type === 'audio' ? 'Áudio' : msg.media_type === 'video' ? 'Vídeo' : 'Arquivo'}`
          : (msg.content as string);
        toast({ title: `💬 ${senderName}`, description: content.slice(0, 100) });
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setTimeout(() => { supabase.removeChannel(channel); }, 3000);
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
        setOnlineUsers(new Set<string>(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user_id: user.id, online_at: new Date().toISOString() });
        }
      });
    return () => { supabase.removeChannel(presenceChannel); };
  }, [user]);

  // Mark as read: update server + clear local
  const markAsRead = useCallback(async (channelId: string) => {
    await supabase.rpc('mark_channel_read' as any, { _channel_id: channelId });
    setUnreadByChannel(prev => {
      const next = { ...prev };
      delete next[channelId];
      setTotalUnread(Object.values(next).reduce((a, b) => a + b, 0));
      return next;
    });
  }, []);

  return (
    <InternalChatUnreadContext.Provider value={{ totalUnread, unreadByChannel, onlineUsers, markAsRead, setActiveChannel, refreshUnread }}>
      {children}
    </InternalChatUnreadContext.Provider>
  );
}
