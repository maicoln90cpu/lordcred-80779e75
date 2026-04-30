import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getCachedChats, setCachedChats } from '@/hooks/useMessageCache';
import { useVisibilityAwareInterval } from '@/hooks/useVisibilityAwareInterval';
import type { ChatContact } from '@/pages/WhatsApp';

export interface ExtendedChat extends ChatContact {
  is_archived?: boolean;
  label_ids?: string[];
  is_pinned?: boolean;
  is_starred?: boolean;
  custom_status?: string | null;
  is_blocked?: boolean;
  is_muted?: boolean;
  assigned_user_id?: string | null;
  closed_at?: string | null;
  closed_reason?: string | null;
}

export interface LabelItem {
  label_id: string;
  name: string;
  color_hex: string | null;
}

function formatPhoneNumber(raw: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 12) {
    const cc = digits.slice(0, 2);
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length === 9) return `+${cc} ${ddd} ${rest.slice(0, 5)}-${rest.slice(5)}`;
    if (rest.length === 8) return `+${cc} ${ddd} ${rest.slice(0, 4)}-${rest.slice(4)}`;
    return `+${cc} ${ddd} ${rest}`;
  }
  if (digits.length >= 10) {
    const ddd = digits.slice(0, 2);
    const rest = digits.slice(2);
    if (rest.length === 9) return `+55 ${ddd} ${rest.slice(0, 5)}-${rest.slice(5)}`;
    if (rest.length === 8) return `+55 ${ddd} ${rest.slice(0, 4)}-${rest.slice(4)}`;
    return `+55 ${ddd} ${rest}`;
  }
  return raw;
}

export { formatPhoneNumber };

interface UseConversationsOptions {
  chipId: string | null;
  onUnreadUpdate?: (chipId: string, totalUnread: number) => void;
  refreshKey?: number;
}

export function useConversations({ chipId, onUnreadUpdate, refreshKey }: UseConversationsOptions) {
  const [chats, setChats] = useState<ExtendedChat[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [kanbanColumns, setKanbanColumns] = useState<{ id: string; name: string; color_hex: string | null }[]>([]);
  const prevChipRef = useRef<string | null>(null);
  const activeChipRef = useRef<string | null>(chipId);

  // Chip change: restore cache or reset
  useEffect(() => {
    activeChipRef.current = chipId;
    if (chipId !== prevChipRef.current) {
      prevChipRef.current = chipId;
      if (chipId) {
        const cached = getCachedChats(chipId);
        if (cached && cached.length > 0) {
          setChats(cached);
        } else {
          setChats([]);
        }
      } else {
        setChats([]);
      }
      setCurrentPage(1);
      setHasMore(true);
      if (chipId) {
        setTimeout(() => fetchChats(1, false), 100);
      }
    }
  }, [chipId]);

  // Fetch labels
  useEffect(() => {
    if (!chipId) return;
    supabase
      .from('labels')
      .select('label_id, name, color_hex')
      .eq('chip_id', chipId)
      .then(({ data }: any) => {
        if (data) setLabels(data);
      });
  }, [chipId]);

  const refreshLabels = useCallback(() => {
    if (!chipId) return;
    supabase
      .from('labels')
      .select('label_id, name, color_hex')
      .eq('chip_id', chipId)
      .then(({ data }: any) => {
        if (data) setLabels(data);
      });
  }, [chipId]);

  // Fetch kanban columns
  useEffect(() => {
    supabase
      .from('kanban_columns')
      .select('id, name, color_hex')
      .order('sort_order')
      .then(({ data }) => {
        if (data) setKanbanColumns(data);
      });
  }, []);

  const fetchChats = useCallback(async (pageNum = 1, append = false) => {
    if (!chipId) return;
    const requestChipId = chipId;
    const PAGE_SIZE = 200;

    if (pageNum === 1 && !append) {
      const cached = getCachedChats(chipId);
      setLoading(!cached || cached.length === 0);
    } else {
      setLoadingMore(true);
    }

    try {
      const from = (pageNum - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: dbConvos, error } = await supabase
        .from('conversations')
        .select('id, remote_jid, contact_name, wa_name, contact_phone, last_message_text, last_message_at, unread_count, is_group, is_pinned, is_archived, is_starred, is_blocked, is_muted, custom_status, label_ids, profile_pic_url, assigned_user_id, closed_at, closed_reason')
        .eq('chip_id', requestChipId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .range(from, to);

      if (activeChipRef.current !== requestChipId) return;
      if (error) { console.error('Error fetching chats from DB:', error); return; }

      const mapped: ExtendedChat[] = (dbConvos || []).map((r: any) => {
        const displayName = r.contact_name || r.wa_name || formatPhoneNumber(r.contact_phone || r.remote_jid?.split('@')[0] || '');
        let alternateJid: string | undefined;
        if (r.remote_jid?.includes('@lid') && r.contact_phone) {
          const cleanPhone = (r.contact_phone || '').replace(/\D/g, '');
          if (cleanPhone.length >= 10) alternateJid = `${cleanPhone}@s.whatsapp.net`;
        }
        return {
          id: r.id, remoteJid: r.remote_jid, alternateJid,
          name: displayName || 'Desconhecido',
          phone: r.contact_phone || r.remote_jid?.split('@')[0] || '',
          lastMessage: r.last_message_text || '',
          lastMessageAt: r.last_message_at,
          unreadCount: r.unread_count || 0,
          isGroup: r.is_group || false,
          isPinned: r.is_pinned || false,
          is_pinned: r.is_pinned || false,
          profilePicUrl: r.profile_pic_url || null,
          is_archived: r.is_archived || false,
          is_starred: r.is_starred || false,
          custom_status: r.custom_status || null,
          label_ids: r.label_ids || [],
          is_blocked: r.is_blocked || false,
          is_muted: r.is_muted || false,
          assigned_user_id: r.assigned_user_id || null,
        };
      });

      if (mapped.length < PAGE_SIZE) setHasMore(false);

      if (pageNum === 1 && !append) {
        setChats(mapped);
        setCachedChats(requestChipId, mapped);
        if (onUnreadUpdate && requestChipId) {
          const totalUnread = mapped
            .filter(c => !c.is_archived)
            .reduce((sum, c) => sum + (c.unreadCount || 0), 0);
          onUnreadUpdate(requestChipId, totalUnread);
        }
      } else if (append && mapped.length > 0) {
        setChats(prev => {
          const existingJids = new Set(prev.map(c => c.remoteJid));
          const newChats = mapped.filter(c => !existingJids.has(c.remoteJid));
          const merged = [...prev, ...newChats];
          setCachedChats(requestChipId, merged);
          return merged;
        });
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      if (activeChipRef.current === chipId) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [chipId, onUnreadUpdate]);

  // Initial fetch + refreshKey trigger
  useEffect(() => {
    if (chipId) fetchChats();
  }, [fetchChats, chipId, refreshKey]);

  // Polling 30s — pausa automaticamente quando aba não está visível
  const pollFn = useCallback(() => { fetchChats(1, false); }, [fetchChats]);
  useVisibilityAwareInterval(pollFn, chipId ? 30000 : null);

  // Realtime subscription
  useEffect(() => {
    if (!chipId) return;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`conversations-${chipId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations', filter: `chip_id=eq.${chipId}` },
        () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => fetchChats(1, false), 500);
        }
      )
      .subscribe();
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [chipId, fetchChats]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    fetchChats(nextPage, true);
  }, [loadingMore, hasMore, currentPage, fetchChats]);

  return {
    chats, setChats, loading, loadingMore, hasMore,
    labels, kanbanColumns, refreshLabels, loadMore,
    formatPhoneNumber,
  };
}
