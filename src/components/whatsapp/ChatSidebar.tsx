import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, MessageSquare, Loader2, Pin, Archive, ChevronLeft, Tag, MoreVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { getCachedChats, setCachedChats } from '@/hooks/useMessageCache';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import LabelBadge from './LabelBadge';
import ManageLabelsDialog from './ManageLabelsDialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { ChatContact } from '@/pages/WhatsApp';

function formatPhoneNumber(raw: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 12) {
    // +55 48 98119529 -> +55 48 9811-9529
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

interface ChatSidebarProps {
  selectedChatId: string | null;
  onSelectChat: (chat: ChatContact) => void;
  chipId: string | null;
  onUnreadUpdate?: (chipId: string, totalUnread: number) => void;
}

interface LabelItem {
  label_id: string;
  name: string;
  color_hex: string | null;
}

export default function ChatSidebar({ selectedChatId, onSelectChat, chipId, onUnreadUpdate }: ChatSidebarProps) {
  const [search, setSearch] = useState('');
  const [chats, setChats] = useState<(ChatContact & { is_archived?: boolean; label_ids?: string[] })[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [filterUnread, setFilterUnread] = useState(false);
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [filterLabel, setFilterLabel] = useState<string | null>(null);
  const [manageLabelsOpen, setManageLabelsOpen] = useState(false);
  const prevChipRef = useRef<string | null>(null);
  const activeChipRef = useRef<string | null>(chipId);
  const { toast } = useToast();

  // Immediately clear chats when chip changes and force fresh fetch
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
      setShowArchived(false);
      setFilterLabel(null);
      // Force a fresh DB fetch to ensure unread counts are up-to-date
      if (chipId) {
        setTimeout(() => fetchChats(1, false), 100);
      }
    }
  }, [chipId]);

  // Fetch labels for this chip
  useEffect(() => {
    if (!chipId) return;
    (supabase as any)
      .from('labels')
      .select('label_id, name, color_hex')
      .eq('chip_id', chipId)
      .then(({ data }: any) => {
        if (data) setLabels(data);
      });
    // Also trigger a sync from UazAPI
    supabase.functions.invoke('uazapi-api', {
      body: { action: 'fetch-labels', chipId },
    }).then(() => {
      (supabase as any)
        .from('labels')
        .select('label_id, name, color_hex')
        .eq('chip_id', chipId)
        .then(({ data: fresh }: any) => {
          if (fresh) setLabels(fresh);
        });
    }).catch(() => {});
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

      const mapped = (dbConvos || []).map((r: any) => {
        const displayName = r.contact_name || r.wa_name || formatPhoneNumber(r.contact_phone || r.remote_jid?.split('@')[0] || '');
        return {
          id: r.id,
          remoteJid: r.remote_jid,
          name: displayName || 'Desconhecido',
          phone: r.contact_phone || r.remote_jid?.split('@')[0] || '',
          lastMessage: r.last_message_text || '',
          lastMessageAt: r.last_message_at,
          unreadCount: r.unread_count || 0,
          isGroup: r.is_group || false,
          isPinned: false,
          profilePicUrl: r.profile_pic_url || null,
          is_archived: r.is_archived || false,
          label_ids: r.label_ids || [],
        };
      });

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

          const displayName = record.contact_name || record.wa_name || formatPhoneNumber(record.contact_phone || record.remote_jid?.split('@')[0] || '');

          setChats(prev => {
            const existing = prev.findIndex(c => c.remoteJid === record.remote_jid);
            const updated: any = {
              id: record.id,
              remoteJid: record.remote_jid,
              name: displayName || 'Desconhecido',
              phone: record.contact_phone || '',
              lastMessage: record.last_message_text || '',
              lastMessageAt: record.last_message_at,
              unreadCount: record.unread_count || 0,
              isGroup: record.is_group || false,
              is_archived: record.is_archived || false,
              label_ids: record.label_ids || [],
              profilePicUrl: record.profile_pic_url || null,
            };

            let newChats;
            if (existing >= 0) {
              newChats = [...prev];
              newChats[existing] = { ...newChats[existing], ...updated };
            } else {
              newChats = [updated, ...prev];
            }

            newChats.sort((a, b) => {
              if (a.isPinned && !b.isPinned) return -1;
              if (!a.isPinned && b.isPinned) return 1;
              const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
              const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
              return tb - ta;
            });

            setCachedChats(chipId, newChats);

            if (onUnreadUpdate) {
              const totalUnread = newChats
                .filter(c => !c.is_archived)
                .reduce((sum, c) => sum + (c.unreadCount || 0), 0);
              onUnreadUpdate(chipId, totalUnread);
            }

            return newChats;
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chipId, onUnreadUpdate]);

  const handleArchive = async (chat: ChatContact & { is_archived?: boolean }, archive: boolean) => {
    if (!chipId) return;
    try {
      const res = await supabase.functions.invoke('uazapi-api', {
        body: { action: 'archive-chat', chipId, chatId: chat.remoteJid, archive },
      });
      if (res.data?.success) {
        setChats(prev => prev.map(c =>
          c.remoteJid === chat.remoteJid ? { ...c, is_archived: archive } : c
        ));
        toast({ title: archive ? 'Conversa arquivada' : 'Conversa desarquivada' });
      }
    } catch {
      toast({ title: 'Erro', variant: 'destructive' });
    }
  };

  // Filter chats
  const filteredChats = chats.filter(chat => {
    // Archive filter
    if (showArchived) {
      if (!chat.is_archived) return false;
    } else {
      if (chat.is_archived) return false;
    }
    // Unread filter
    if (filterUnread && (chat.unreadCount || 0) === 0) return false;
    // Label filter
    if (filterLabel && (!chat.label_ids || !chat.label_ids.includes(filterLabel))) return false;
    // Search filter
    if (search) {
      return chat.name.toLowerCase().includes(search.toLowerCase()) || chat.phone.includes(search);
    }
    return true;
  });

  const sortedChats = [...filteredChats].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return tb - ta;
  });

  const archivedCount = chats.filter(c => c.is_archived).length;

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

  const getLabelName = (labelId: string) => labels.find(l => l.label_id === labelId);

  return (
    <div className="flex flex-col h-full">
      {/* Header with search and filters */}
      <div className="p-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary/50 border-0 h-9 text-sm"
          />
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {showArchived ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs shrink-0"
              onClick={() => setShowArchived(false)}
            >
              <ChevronLeft className="w-3 h-3 mr-1" />
              Voltar
            </Button>
          ) : archivedCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs shrink-0 text-muted-foreground"
              onClick={() => setShowArchived(true)}
            >
              <Archive className="w-3 h-3 mr-1" />
              Arquivadas ({archivedCount})
            </Button>
          ) : null}

          {/* Unread filter */}
          <Button
            variant={filterUnread ? "default" : "ghost"}
            size="sm"
            className={cn("h-7 text-xs shrink-0", !filterUnread && "text-muted-foreground")}
            onClick={() => setFilterUnread(!filterUnread)}
          >
            Não lidas
          </Button>

          {/* Labels filter - always show */}
          {filterLabel ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs shrink-0"
              onClick={() => setFilterLabel(null)}
            >
              <Tag className="w-3 h-3 mr-1" />
              {labels.find(l => l.label_id === filterLabel)?.name || 'Etiqueta'}
              <span className="ml-1 text-muted-foreground">✕</span>
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0 text-muted-foreground">
                  <Tag className="w-3 h-3 mr-1" />
                  Etiquetas
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {labels.length > 0 ? (
                  labels.map(label => (
                    <DropdownMenuItem key={label.label_id} onClick={() => setFilterLabel(label.label_id)}>
                      <LabelBadge name={label.name} colorHex={label.color_hex} className="mr-2" />
                      {label.name}
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                    Nenhuma etiqueta encontrada
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setManageLabelsOpen(true)}>
                  <Tag className="w-3.5 h-3.5 mr-2" />
                  Gerenciar Etiquetas
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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
            {showArchived ? 'Nenhuma conversa arquivada' : 'Nenhuma conversa encontrada'}
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {sortedChats.map((chat) => (
              <div key={chat.remoteJid} className="group relative">
                <button
                  onClick={() => onSelectChat(chat)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 text-left transition-colors",
                    selectedChatId === chat.remoteJid ? "bg-secondary" : "hover:bg-secondary/50"
                  )}
                >
                  <Avatar className="w-10 h-10 shrink-0">
                    {chat.profilePicUrl && (
                      <AvatarImage src={chat.profilePicUrl} alt={chat.name} />
                    )}
                    <AvatarFallback className="bg-primary/20 text-primary text-sm font-medium">
                      {chat.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
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
                    {/* Labels */}
                    {chat.label_ids && chat.label_ids.length > 0 && (
                      <div className="flex gap-1 mt-1 overflow-hidden">
                        {chat.label_ids.slice(0, 3).map(lid => {
                          const label = getLabelName(lid);
                          return label ? (
                            <LabelBadge key={lid} name={label.name} colorHex={label.color_hex} />
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                </button>

                {/* Context menu button */}
                <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <MoreVertical className="w-3.5 h-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleArchive(chat, !chat.is_archived)}>
                        <Archive className="w-4 h-4 mr-2" />
                        {chat.is_archived ? 'Desarquivar' : 'Arquivar'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {labels.length > 0 && labels.map(label => {
                        const hasLabel = chat.label_ids?.includes(label.label_id);
                        return (
                          <DropdownMenuItem
                            key={label.label_id}
                            onClick={async () => {
                              if (!chipId) return;
                              const newLabelIds = hasLabel
                                ? (chat.label_ids || []).filter(id => id !== label.label_id)
                                : [...(chat.label_ids || []), label.label_id];
                              try {
                                await supabase.functions.invoke('uazapi-api', {
                                  body: {
                                    action: 'set-chat-labels',
                                    chipId,
                                    chatId: chat.remoteJid,
                                    ...(hasLabel ? { removeLabelId: label.label_id } : { addLabelId: label.label_id }),
                                  },
                                });
                                setChats(prev => prev.map(c =>
                                  c.remoteJid === chat.remoteJid ? { ...c, label_ids: newLabelIds } : c
                                ));
                              } catch {
                                toast({ title: 'Erro ao atualizar etiqueta', variant: 'destructive' });
                              }
                            }}
                          >
                            <LabelBadge name={label.name} colorHex={label.color_hex} className="mr-2" />
                            {hasLabel ? `Remover ${label.name}` : label.name}
                          </DropdownMenuItem>
                        );
                      })}
                      <DropdownMenuItem onClick={() => setManageLabelsOpen(true)}>
                        <Tag className="w-4 h-4 mr-2" />
                        Gerenciar Etiquetas
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
            {loadingMore && (
              <div className="flex justify-center py-3">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <ManageLabelsDialog
        open={manageLabelsOpen}
        onOpenChange={setManageLabelsOpen}
        chipId={chipId}
        onLabelsUpdated={() => {
          // Re-fetch labels
          if (!chipId) return;
          (supabase as any)
            .from('labels')
            .select('label_id, name, color_hex')
            .eq('chip_id', chipId)
            .then(({ data }: any) => {
              if (data) setLabels(data);
            });
        }}
      />
    </div>
  );
}
