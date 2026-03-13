import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export function useInternalChatUnread() {
  const { user } = useAuth();
  const [totalUnread, setTotalUnread] = useState(0);
  const unreadMap = useRef<Record<string, number>>({});
  const channelIdsRef = useRef<string[]>([]);
  const profilesRef = useRef<Record<string, { name: string | null; email: string }>>({});

  // Load user's channels and profiles
  useEffect(() => {
    if (!user) return;

    const init = async () => {
      const { data: memberships } = await supabase
        .from('internal_channel_members')
        .select('channel_id')
        .eq('user_id', user.id);

      if (memberships) {
        channelIdsRef.current = memberships.map(m => m.channel_id);
      }

      // Load profiles via RPC
      const { data: profiles } = await supabase.rpc('get_internal_chat_profiles');
      if (profiles) {
        const map: Record<string, { name: string | null; email: string }> = {};
        (profiles as any[]).forEach((p: any) => { map[p.user_id] = { name: p.name, email: p.email }; });
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

        // Increment unread
        unreadMap.current[msg.channel_id] = (unreadMap.current[msg.channel_id] || 0) + 1;
        const total = Object.values(unreadMap.current).reduce((a, b) => a + b, 0);
        setTotalUnread(total);

        // Show toast notification
        const sender = profilesRef.current[msg.user_id];
        const senderName = sender?.name || sender?.email?.split('@')[0] || 'Alguém';
        toast({
          title: `💬 ${senderName}`,
          description: (msg.content as string).slice(0, 100),
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markAsRead = useCallback((channelId: string) => {
    delete unreadMap.current[channelId];
    const total = Object.values(unreadMap.current).reduce((a, b) => a + b, 0);
    setTotalUnread(total);
  }, []);

  return { totalUnread, markAsRead };
}
