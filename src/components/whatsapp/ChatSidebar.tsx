import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, MessageSquare, Loader2, Pin, Archive, ChevronLeft, Tag, MoreVertical, Star, CircleDot, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { getCachedChats, setCachedChats } from '@/hooks/useMessageCache';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import LabelBadge from './LabelBadge';
import ManageLabelsDialog from './ManageLabelsDialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { ChatContact } from '@/pages/WhatsApp';

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

interface ChatSidebarProps {
  selectedChatId: string | null;
  onSelectChat: (chat: ChatContact) => void;
  chipId: string | null;
  onUnreadUpdate?: (chipId: string, totalUnread: number) => void;
  isSyncing?: boolean;
  syncProgress?: string;
  refreshKey?: number;
}

interface LabelItem {
  label_id: string;
  name: string;
  color_hex: string | null;
}

type ConversationStatus = null | 'aguardando' | 'em_andamento' | 'finalizado' | 'urgente';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  aguardando: { label: 'Aguardando', color: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' },
  em_andamento: { label: 'Em andamento', color: 'bg-blue-500/20 text-blue-700 dark:text-blue-400' },
  finalizado: { label: 'Finalizado', color: 'bg-green-500/20 text-green-700 dark:text-green-400' },
  urgente: { label: 'Urgente', color: 'bg-red-500/20 text-red-700 dark:text-red-400' },
};

interface ExtendedChat extends ChatContact {
  is_archived?: boolean;
  label_ids?: string[];
  is_pinned?: boolean;
  is_starred?: boolean;
  custom_status?: ConversationStatus;
}

export default function ChatSidebar({ selectedChatId, onSelectChat, chipId, onUnreadUpdate, isSyncing, syncProgress, refreshKey }: ChatSidebarProps) {
  const [search, setSearch] = useState('');
  const [chats, setChats] = useState<ExtendedChat[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterStarred, setFilterStarred] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [filterLabel, setFilterLabel] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'people' | 'groups'>('all');
  const [manageLabelsOpen, setManageLabelsOpen] = useState(false);
  const [editingContactJid, setEditingContactJid] = useState<string | null>(null);
  const [editContactName, setEditContactName] = useState('');
  const prevChipRef = useRef<string | null>(null);
  const activeChipRef = useRef<string | null>(chipId);
  const { toast } = useToast();

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
      setFilterStarred(false);
      setFilterStatus(null);
      if (chipId) {
        setTimeout(() => fetchChats(1, false), 100);
      }
    }
  }, [chipId]);

  // Fetch labels locally
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
        let alternateJid: string | undefined;
        if (r.remote_jid?.includes('@lid') && r.contact_phone) {
          const cleanPhone = (r.contact_phone || '').replace(/\D/g, '');
          if (cleanPhone.length >= 10) {
            alternateJid = `${cleanPhone}@s.whatsapp.net`;
          }
        }
        return {
          id: r.id,
          remoteJid: r.remote_jid,
          alternateJid,
          name: displayName || 'Desconhecido',
          phone: r.contact_phone || r.remote_jid?.split('@')[0] || '',
          lastMessage: r.last_message_text || '',
          lastMessageAt: r.last_message_at,
          unreadCount: r.unread_count || 0,
          isGroup: r.is_group || false,
          isPinned: r.is_pinned || false,
          profilePicUrl: r.profile_pic_url || null,
          is_archived: r.is_archived || false,
          is_starred: r.is_starred || false,
          custom_status: r.custom_status || null,
          label_ids: r.label_ids || [],
        };
      });

      // DEBUG: log unread chats
      const unreadChats = mapped.filter(c => c.unreadCount > 0);
      if (unreadChats.length > 0) {
        console.log('[ChatSidebar] fetchChats: unread chats:', unreadChats.map(c => ({ name: c.name, unread: c.unreadCount, jid: c.remoteJid })));
      }

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
      if (activeChipRef.current === requestChipId) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [chipId, onUnreadUpdate]);

  // Initial fetch + refreshKey trigger
  useEffect(() => {
    if (chipId) fetchChats();
  }, [fetchChats, chipId, refreshKey]);

  // Polling: re-fetch every 10 seconds as safety net against lost realtime events
  useEffect(() => {
    if (!chipId) return;
    const interval = setInterval(() => {
      fetchChats(1, false);
    }, 10000);
    return () => clearInterval(interval);
  }, [chipId, fetchChats]);

  // Realtime: re-fetch completo do banco a cada mudança (evita perda de eventos durante sync em lote)
  useEffect(() => {
    if (!chipId) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel(`conversations-${chipId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations', filter: `chip_id=eq.${chipId}` },
        () => {
          // Debounce: durante sync em lote, muitos eventos chegam em sequência
          // Re-fetch completo garante dados consistentes com o banco
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            fetchChats(1, false);
          }, 500);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [chipId, fetchChats]);

  // === LOCAL HANDLERS ===

  const handleArchive = async (chat: ExtendedChat, archive: boolean) => {
    if (!chipId) return;
    try {
      await supabase
        .from('conversations')
        .update({ is_archived: archive } as any)
        .eq('chip_id', chipId)
        .eq('remote_jid', chat.remoteJid);
      setChats(prev => prev.map(c =>
        c.remoteJid === chat.remoteJid ? { ...c, is_archived: archive } : c
      ));
      toast({ title: archive ? 'Conversa arquivada' : 'Conversa desarquivada' });
    } catch {
      toast({ title: 'Erro', variant: 'destructive' });
    }
  };

  const handlePin = async (chat: ExtendedChat) => {
    if (!chipId) return;
    const newVal = !chat.is_pinned;
    try {
      await supabase
        .from('conversations')
        .update({ is_pinned: newVal } as any)
        .eq('chip_id', chipId)
        .eq('remote_jid', chat.remoteJid);
      setChats(prev => {
        const updated = prev.map(c =>
          c.remoteJid === chat.remoteJid ? { ...c, is_pinned: newVal, isPinned: newVal } : c
        );
        updated.sort((a, b) => {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return tb - ta;
        });
        return updated;
      });
      toast({ title: newVal ? 'Conversa fixada' : 'Conversa desafixada' });
    } catch {
      toast({ title: 'Erro', variant: 'destructive' });
    }
  };

  const handleStar = async (chat: ExtendedChat) => {
    if (!chipId) return;
    const newVal = !chat.is_starred;
    try {
      await supabase
        .from('conversations')
        .update({ is_starred: newVal } as any)
        .eq('chip_id', chipId)
        .eq('remote_jid', chat.remoteJid);
      setChats(prev => prev.map(c =>
        c.remoteJid === chat.remoteJid ? { ...c, is_starred: newVal } : c
      ));
      toast({ title: newVal ? '⭐ Conversa favorita' : 'Removida dos favoritos' });
    } catch {
      toast({ title: 'Erro', variant: 'destructive' });
    }
  };

  const handleSetStatus = async (chat: ExtendedChat, status: ConversationStatus) => {
    if (!chipId) return;
    try {
      await supabase
        .from('conversations')
        .update({ custom_status: status } as any)
        .eq('chip_id', chipId)
        .eq('remote_jid', chat.remoteJid);
      setChats(prev => prev.map(c =>
        c.remoteJid === chat.remoteJid ? { ...c, custom_status: status } : c
      ));
      toast({ title: status ? `Status: ${STATUS_CONFIG[status]?.label}` : 'Status removido' });
    } catch {
      toast({ title: 'Erro', variant: 'destructive' });
    }
  };

  const handleToggleLabel = async (chat: ExtendedChat, labelId: string) => {
    if (!chipId) return;
    const hasLabel = chat.label_ids?.includes(labelId);
    const newLabelIds = hasLabel
      ? (chat.label_ids || []).filter(id => id !== labelId)
      : [...(chat.label_ids || []), labelId];
    try {
      await supabase
        .from('conversations')
        .update({ label_ids: newLabelIds } as any)
        .eq('chip_id', chipId)
        .eq('remote_jid', chat.remoteJid);
      setChats(prev => prev.map(c =>
        c.remoteJid === chat.remoteJid ? { ...c, label_ids: newLabelIds } : c
      ));
    } catch {
      toast({ title: 'Erro ao atualizar etiqueta', variant: 'destructive' });
    }
  };

  const handleRenameContact = async (chat: ExtendedChat) => {
    if (!chipId || !editContactName.trim()) return;
    try {
      await supabase
        .from('conversations')
        .update({ contact_name: editContactName.trim() } as any)
        .eq('chip_id', chipId)
        .eq('remote_jid', chat.remoteJid);
      setChats(prev => prev.map(c =>
        c.remoteJid === chat.remoteJid ? { ...c, name: editContactName.trim() } : c
      ));
      setEditingContactJid(null);
      toast({ title: 'Nome atualizado' });
    } catch {
      toast({ title: 'Erro', variant: 'destructive' });
    }
  };

  const handleClearAllUnread = async () => {
    if (!chipId) return;
    try {
      const unreadChats = chats.filter(c => (c.unreadCount || 0) > 0 && !c.is_archived);
      // Send mark-read to UazAPI for each unread chat (edge function updates DB)
      const promises = unreadChats.map(c =>
        supabase.functions.invoke('uazapi-api', {
          body: { action: 'mark-read', chipId, chatId: c.remoteJid },
        }).catch(() => {})
      );
      await Promise.all(promises);
      toast({ title: 'Todas as conversas marcadas como lidas' });
    } catch {
      toast({ title: 'Erro ao limpar não lidas', variant: 'destructive' });
    }
  };

  const handleMarkUnread = async (chat: ExtendedChat) => {
    if (!chipId) return;
    try {
      await supabase.functions.invoke('uazapi-api', {
        body: { action: 'mark-unread', chipId, chatId: chat.remoteJid },
      });
      toast({ title: 'Conversa marcada como não lida' });
    } catch {
      toast({ title: 'Erro', variant: 'destructive' });
    }
  };

  // Filter chats
  const filteredChats = chats.filter(chat => {
    if (showArchived) {
      if (!chat.is_archived) return false;
    } else {
      if (chat.is_archived) return false;
    }
    if (filterUnread && (chat.unreadCount || 0) === 0) return false;
    if (filterStarred && !chat.is_starred) return false;
    if (filterStatus && chat.custom_status !== filterStatus) return false;
    if (filterLabel && (!chat.label_ids || !chat.label_ids.includes(filterLabel))) return false;
    if (filterType === 'people' && chat.isGroup) return false;
    if (filterType === 'groups' && !chat.isGroup) return false;
    if (search) {
      return chat.name.toLowerCase().includes(search.toLowerCase()) || chat.phone.includes(search);
    }
    return true;
  });

  const sortedChats = [...filteredChats].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    const aHasMsg = !!a.lastMessage;
    const bHasMsg = !!b.lastMessage;
    if (aHasMsg && !bHasMsg) return -1;
    if (!aHasMsg && bHasMsg) return 1;
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
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Ontem';
    }
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
      const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      return dias[date.getDay()];
    }
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
      {/* Sync indicator */}
      {isSyncing && (
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground bg-muted/50 border-b border-border/50 animate-pulse">
          <Loader2 className="w-3 h-3 animate-spin" />
          Sincronizando{syncProgress ? ` ${syncProgress}` : '...'}
        </div>
      )}
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
        <div className="flex items-center gap-1.5 flex-wrap">
          {showArchived ? (
            <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={() => setShowArchived(false)}>
              <ChevronLeft className="w-3 h-3 mr-1" /> Voltar
            </Button>
          ) : archivedCount > 0 ? (
            <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0 text-muted-foreground" onClick={() => setShowArchived(true)}>
              <Archive className="w-3 h-3 mr-1" /> Arquivadas ({archivedCount})
            </Button>
          ) : null}

          <Button
            variant={filterUnread ? "default" : "ghost"}
            size="sm"
            className={cn("h-7 text-xs shrink-0", !filterUnread && "text-muted-foreground")}
            onClick={() => setFilterUnread(!filterUnread)}
          >
            Não lidas
          </Button>

          {filterUnread && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs shrink-0 text-destructive hover:text-destructive"
              onClick={handleClearAllUnread}
            >
              Limpar todas
            </Button>
          )}

          <Button
            variant={filterStarred ? "default" : "ghost"}
            size="sm"
            className={cn("h-7 text-xs shrink-0", !filterStarred && "text-muted-foreground")}
            onClick={() => setFilterStarred(!filterStarred)}
          >
            <Star className="w-3 h-3 mr-1" /> Favoritas
          </Button>

          <Button
            variant={filterType === 'people' ? "default" : "ghost"}
            size="sm"
            className={cn("h-7 text-xs shrink-0", filterType !== 'people' && "text-muted-foreground")}
            onClick={() => setFilterType(filterType === 'people' ? 'all' : 'people')}
          >
            Pessoas
          </Button>

          <Button
            variant={filterType === 'groups' ? "default" : "ghost"}
            size="sm"
            className={cn("h-7 text-xs shrink-0", filterType !== 'groups' && "text-muted-foreground")}
            onClick={() => setFilterType(filterType === 'groups' ? 'all' : 'groups')}
          >
            Grupos
          </Button>

          {/* Status filter */}
          {filterStatus ? (
            <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={() => setFilterStatus(null)}>
              <CircleDot className="w-3 h-3 mr-1" />
              {STATUS_CONFIG[filterStatus]?.label}
              <span className="ml-1 text-muted-foreground">✕</span>
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0 text-muted-foreground">
                  <CircleDot className="w-3 h-3 mr-1" /> Status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <DropdownMenuItem key={key} onClick={() => setFilterStatus(key)}>
                    <Badge variant="outline" className={cn("mr-2 text-[10px]", cfg.color)}>{cfg.label}</Badge>
                    {cfg.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Labels filter */}
          {filterLabel ? (
            <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={() => setFilterLabel(null)}>
              <Tag className="w-3 h-3 mr-1" />
              {labels.find(l => l.label_id === filterLabel)?.name || 'Etiqueta'}
              <span className="ml-1 text-muted-foreground">✕</span>
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0 text-muted-foreground">
                  <Tag className="w-3 h-3 mr-1" /> Etiquetas
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {labels.length > 0 ? labels.map(label => (
                  <DropdownMenuItem key={label.label_id} onClick={() => setFilterLabel(label.label_id)}>
                    <LabelBadge name={label.name} colorHex={label.color_hex} className="mr-2" />
                    {label.name}
                  </DropdownMenuItem>
                )) : (
                  <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                    Nenhuma etiqueta encontrada
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setManageLabelsOpen(true)}>
                  <Tag className="w-3.5 h-3.5 mr-2" /> Gerenciar Etiquetas
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
            {sortedChats.map((chat) => {
              if (chat.unreadCount > 0) console.log('[RENDER]', chat.name, 'unread:', chat.unreadCount, 'lastMsg:', chat.lastMessage?.substring(0, 20), 'at:', chat.lastMessageAt);
              return (
              <div key={chat.remoteJid} className="group relative">
                <button
                  onClick={() => onSelectChat(chat)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 text-left transition-colors",
                    selectedChatId === chat.remoteJid ? "bg-secondary" : "hover:bg-secondary/50",
                    chat.unreadCount > 0 && "bg-primary/5"
                  )}
                >
                  <Avatar className="w-10 h-10 shrink-0">
                    {chat.profilePicUrl && <AvatarImage src={chat.profilePicUrl} alt={chat.name} />}
                    <AvatarFallback className="bg-primary/20 text-primary text-sm font-medium">
                      {chat.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 min-w-0">
                        {chat.is_pinned && <Pin className="w-3 h-3 text-muted-foreground shrink-0" />}
                        {chat.is_starred && <Star className="w-3 h-3 text-yellow-500 shrink-0 fill-yellow-500" />}
                        <span className={cn("text-sm truncate", chat.unreadCount > 0 ? "font-bold text-foreground" : "font-medium")}>{chat.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {formatTime(chat.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className={cn("text-xs truncate", chat.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground")}>{chat.lastMessage || chat.phone || 'Abrir conversa'}</span>
                      {chat.unreadCount > 0 && (
                        <span className="ml-2 min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0" style={{ backgroundColor: '#25D366', color: '#ffffff' }}>
                          {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                        </span>
                      )}
                    </div>
                    {/* Status + Labels row */}
                    <div className="flex gap-1 mt-1 overflow-hidden items-center">
                      {chat.custom_status && STATUS_CONFIG[chat.custom_status] && (
                        <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4", STATUS_CONFIG[chat.custom_status].color)}>
                          {STATUS_CONFIG[chat.custom_status].label}
                        </Badge>
                      )}
                      {chat.label_ids && chat.label_ids.slice(0, 3).map(lid => {
                        const label = getLabelName(lid);
                        return label ? <LabelBadge key={lid} name={label.name} colorHex={label.color_hex} /> : null;
                      })}
                    </div>
                  </div>
                </button>

                {/* Context menu button */}
                <div className="absolute right-2 top-2 z-10 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <MoreVertical className="w-3.5 h-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => handlePin(chat)}>
                        <Pin className="w-4 h-4 mr-2" />
                        {chat.is_pinned ? 'Desafixar' : 'Fixar no topo'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStar(chat)}>
                        <Star className="w-4 h-4 mr-2" />
                        {chat.is_starred ? 'Remover favorito' : 'Favoritar'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleArchive(chat, !chat.is_archived)}>
                        <Archive className="w-4 h-4 mr-2" />
                        {chat.is_archived ? 'Desarquivar' : 'Arquivar'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleMarkUnread(chat)}>
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Marcar como não lida
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setEditingContactJid(chat.remoteJid);
                        setEditContactName(chat.name);
                      }}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Editar nome
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      {/* Status submenu */}
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <CircleDot className="w-4 h-4 mr-2" /> Status
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                            <DropdownMenuItem
                              key={key}
                              onClick={() => handleSetStatus(chat, key as ConversationStatus)}
                            >
                              <Badge variant="outline" className={cn("mr-2 text-[10px]", cfg.color)}>{cfg.label}</Badge>
                              {chat.custom_status === key ? '✓ ' : ''}{cfg.label}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleSetStatus(chat, null)}>
                            Remover status
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>

                      <DropdownMenuSeparator />

                      {/* Labels */}
                      {labels.length > 0 && labels.map(label => {
                        const hasLabel = chat.label_ids?.includes(label.label_id);
                        return (
                          <DropdownMenuItem key={label.label_id} onClick={() => handleToggleLabel(chat, label.label_id)}>
                            <LabelBadge name={label.name} colorHex={label.color_hex} className="mr-2" />
                            {hasLabel ? `✓ ${label.name}` : label.name}
                          </DropdownMenuItem>
                        );
                      })}
                      <DropdownMenuItem onClick={() => setManageLabelsOpen(true)}>
                        <Tag className="w-4 h-4 mr-2" /> Gerenciar Etiquetas
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Inline rename */}
                {editingContactJid === chat.remoteJid && (
                  <div className="absolute inset-0 bg-background/95 flex items-center gap-2 px-3 z-10">
                    <Input
                      value={editContactName}
                      onChange={(e) => setEditContactName(e.target.value)}
                      className="h-8 text-sm flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameContact(chat);
                        if (e.key === 'Escape') setEditingContactJid(null);
                      }}
                    />
                    <Button size="sm" className="h-8" onClick={() => handleRenameContact(chat)}>Salvar</Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingContactJid(null)}>✕</Button>
                  </div>
                )}
              </div>
              );
            })}

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
          if (!chipId) return;
          supabase
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
