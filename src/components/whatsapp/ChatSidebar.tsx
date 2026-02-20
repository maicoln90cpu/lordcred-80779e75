import { useState, useEffect, useCallback } from 'react';
import { Search, MessageSquare, Loader2 } from 'lucide-react';
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
}

export default function ChatSidebar({ selectedChatId, onSelectChat, chipId }: ChatSidebarProps) {
  const [search, setSearch] = useState('');
  const [chats, setChats] = useState<ChatContact[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchChats = useCallback(async () => {
    if (!chipId) return;

    // 1. Load from cache instantly — never clear existing chats
    const cached = getCachedChats(chipId);
    if (cached && cached.length > 0) {
      setChats(cached);
    }

    // 2. Fetch from API — only show spinner if no cached data at all
    const hasCachedOrExisting = (cached && cached.length > 0);
    setLoading(hasCachedOrExisting ? false : true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await supabase.functions.invoke('uazapi-api', {
        body: { action: 'fetch-chats', chipId, limit: 50 },
      });

      if (response.data?.success && response.data.chats && response.data.chats.length > 0) {
        setChats(response.data.chats);
        setCachedChats(chipId, response.data.chats);
      }
      // If API returns empty but we have cache, keep cached data (don't overwrite)
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  }, [chipId]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

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
              newChats[existing] = updated;
            } else {
              newChats = [updated, ...prev];
            }

            newChats.sort((a, b) => {
              const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
              const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
              return tb - ta;
            });

            // Update cache with realtime data
            setCachedChats(chipId, newChats);
            return newChats;
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chipId]);

  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(search.toLowerCase()) ||
    chat.phone.includes(search)
  );

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

      <ScrollArea className="flex-1">
        {filteredChats.length === 0 && !loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Nenhuma conversa encontrada
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {filteredChats.map((chat) => (
              <button
                key={chat.remoteJid}
                onClick={() => onSelectChat(chat)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 text-left transition-colors",
                  selectedChatId === chat.remoteJid ? "bg-secondary" : "hover:bg-secondary/50"
                )}
              >
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-sm font-medium text-primary">
                    {chat.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{chat.name}</span>
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
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
