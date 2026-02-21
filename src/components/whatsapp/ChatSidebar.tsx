import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, MessageSquare, Loader2, Pin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { getCachedChats, setCachedChats } from '@/hooks/useMessageCache';
import type { ChatContact } from '@/pages/WhatsApp';

interface ChatSidebarProps {
  selectedChatId: string | null;
  onSelectChat: (chat: ChatContact) => void;
  chipId: string | null;
  onUnreadUpdate?: (chipId: string, totalUnread: number) => void;
}

export default function ChatSidebar({ selectedChatId, onSelectChat, chipId, onUnreadUpdate }: ChatSidebarProps) {
  const [search, setSearch] = useState('');
  const [chats, setChats] = useState<ChatContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const prevChipRef = useRef<string | null>(null);
  const activeChipRef = useRef<string | null>(chipId);

  // Immediately clear chats when chip changes
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
    }
  }, [chipId]);

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
      // Database-first: query conversations table directly
      const from = (pageNum - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: dbConvos, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('chip_id', requestChipId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .range(from, to);

      if (activeChipRef.current !== requestChipId) return;

      if (error) {
        console.error('Error fetching chats from DB:', error);
        return;
      }

      const mapped: ChatContact[] = (dbConvos || []).map((r: any) => ({
        id: r.id,
        remoteJid: r.remote_jid,
        name: r.contact_name || r.contact_phone || r.remote_jid?.split('@')[0] || 'Desconhecido',
        phone: r.contact_phone || r.remote_jid?.split('@')[0] || '',
        lastMessage: r.last_message_text || '',
        lastMessageAt: r.last_message_at,
        unreadCount: r.unread_count || 0,
        isGroup: r.is_group || false,
        isPinned: false,
        profilePicUrl: null,
      }));

      if (mapped.length < PAGE_SIZE) setHasMore(false);

      if (pageNum === 1 && !append) {
        setChats(mapped);
        setCachedChats(requestChipId, mapped);
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
      if (activeChipRef.current === requestChipId) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [chipId]);

  useEffect(() => {
    if (chipId) fetchChats();
  }, [fetchChats, chipId]);

  // Subscribe to conversations realtime updates
  useEffect(() => {
    if (!chipId) return;

    const channel = supabase
      .channel(`conversations-${chipId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `chip_id=eq.${chipId}`,
        },
        (payload) => {
          const record = payload.new as any;
          if (!record) return;

          setChats(prev => {
            const existing = prev.findIndex(c => c.remoteJid === record.remote_jid);
            const updated: ChatContact = {
              id: record.id,
              remoteJid: record.remote_jid,
              name: record.contact_name || record.contact_phone || 'Desconhecido',
              phone: record.contact_phone || '',
              lastMessage: record.last_message_text || '',
              lastMessageAt: record.last_message_at,
              unreadCount: record.unread_count || 0,
              isGroup: record.is_group || false,
            };

            let newChats;
            if (existing >= 0) {
              newChats = [...prev];
              newChats[existing] = { ...newChats[existing], ...updated };
            } else {
              newChats = [updated, ...prev];
            }

            // Sort: pinned first, then by last message
            newChats.sort((a, b) => {
              if (a.isPinned && !b.isPinned) return -1;
              if (!a.isPinned && b.isPinned) return 1;
              const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
              const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
              return tb - ta;
            });

            setCachedChats(chipId, newChats);

            // Notify parent about total unread count
            if (onUnreadUpdate) {
              const totalUnread = newChats.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
              onUnreadUpdate(chipId, totalUnread);
            }

            return newChats;
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chipId, onUnreadUpdate]);

  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(search.toLowerCase()) ||
    chat.phone.includes(search)
  );

  // Sort: pinned first, then by last message
  const sortedChats = [...filteredChats].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return tb - ta;
  });

  if (!chipId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
        <MessageSquare className="w-10 h-10 mb-3 opacity-50" />
        <p className="text-sm text-center">Selecione um chip para ver as conversas</p>
      </div>
    );
  }

  if (loading && chats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
        <Loader2 className="w-8 h-8 animate-spin mb-3" />
        <p className="text-sm">Carregando conversas...</p>
      </div>
    );
  }

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const handleScrollEnd = () => {
    if (loadingMore || !hasMore) return;
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    fetchChats(nextPage, true);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary/50 border-0 h-9 text-sm"
          />
        </div>
      </div>

      <ScrollArea className="flex-1" onScrollCapture={(e) => {
        const target = e.currentTarget.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
        if (!target) return;
        if (target.scrollTop + target.clientHeight >= target.scrollHeight - 100) {
          handleScrollEnd();
        }
      }}>
        {sortedChats.length === 0 && !loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Nenhuma conversa encontrada
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {sortedChats.map((chat) => (
              <button
                key={chat.remoteJid}
                onClick={() => onSelectChat(chat)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 text-left transition-colors",
                  selectedChatId === chat.remoteJid ? "bg-secondary" : "hover:bg-secondary/50"
                )}
              >
                {chat.profilePicUrl ? (
                  <img src={chat.profilePicUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }} />
                ) : null}
                <div className={cn("w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0", chat.profilePicUrl && "hidden")}>
                  <span className="text-sm font-medium text-primary">
                    {chat.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 min-w-0">
                      {chat.isPinned && <Pin className="w-3 h-3 text-muted-foreground shrink-0" />}
                      <span className="text-sm font-medium truncate">{chat.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatTime(chat.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs text-muted-foreground truncate">{chat.lastMessage}</span>
                    {chat.unreadCount > 0 && (
                      <span className="ml-2 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0">
                        {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
            {loadingMore && (
              <div className="flex justify-center py-3">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
