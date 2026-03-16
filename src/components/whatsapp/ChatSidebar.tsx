import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, MessageSquare, Loader2, Pin, Archive, ChevronLeft, Tag, MoreVertical, Star, Pencil, BellOff, Ban, Trash2, VolumeX, MessageSquarePlus, Phone, Users, Columns3 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { invokeUazapiWithRetry } from '@/lib/invokeEdgeWithRetry';
import { getCachedChats, setCachedChats } from '@/hooks/useMessageCache';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import LabelBadge from './LabelBadge';
import ManageLabelsDialog from './ManageLabelsDialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

type ConversationStatus = string | null;

interface ExtendedChat extends ChatContact {
  is_archived?: boolean;
  label_ids?: string[];
  is_pinned?: boolean;
  is_starred?: boolean;
  custom_status?: ConversationStatus;
  is_blocked?: boolean;
  is_muted?: boolean;
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
  
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [filterLabel, setFilterLabel] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'people' | 'groups'>('all');
  const [filterBlocked, setFilterBlocked] = useState(false);
  const [manageLabelsOpen, setManageLabelsOpen] = useState(false);
  const [editingContactJid, setEditingContactJid] = useState<string | null>(null);
  const [editContactName, setEditContactName] = useState('');
  const [deleteChatTarget, setDeleteChatTarget] = useState<ExtendedChat | null>(null);
  const [newChatDialogOpen, setNewChatDialogOpen] = useState(false);
  const [newChatNumber, setNewChatNumber] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [contactResults, setContactResults] = useState<ExtendedChat[]>([]);
  const [kanbanColumns, setKanbanColumns] = useState<{ id: string; name: string; color_hex: string | null }[]>([]);
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

  // Add contact to kanban column
  const handleAddToKanban = async (chat: ExtendedChat, columnId: string) => {
    if (!chipId) return;
    try {
      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('chip_id', chipId)
        .eq('remote_jid', chat.remoteJid)
        .single();
      if (!conv) return;

      const col = kanbanColumns.find(c => c.id === columnId);
      await supabase.from('kanban_cards').upsert(
        { conversation_id: conv.id, column_id: columnId, sort_order: 0 } as any,
        { onConflict: 'conversation_id' }
      );
      // Sync custom_status using column name directly
      if (col) {
        await supabase
          .from('conversations')
          .update({ custom_status: col.name } as any)
          .eq('chip_id', chipId)
          .eq('remote_jid', chat.remoteJid);
        setChats(prev => prev.map(c =>
          c.remoteJid === chat.remoteJid ? { ...c, custom_status: col.name as ConversationStatus } : c
        ));
      }
      toast({ title: `Adicionado ao Kanban: ${col?.name || 'coluna'}` });
    } catch {
      toast({ title: 'Erro ao adicionar ao Kanban', variant: 'destructive' });
    }
  };

  const handleRemoveFromKanban = async (chat: ExtendedChat) => {
    if (!chipId) return;
    try {
      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('chip_id', chipId)
        .eq('remote_jid', chat.remoteJid)
        .single();
      if (!conv) return;
      await supabase.from('kanban_cards').delete().eq('conversation_id', conv.id);
      await supabase
        .from('conversations')
        .update({ custom_status: null } as any)
        .eq('chip_id', chipId)
        .eq('remote_jid', chat.remoteJid);
      setChats(prev => prev.map(c =>
        c.remoteJid === chat.remoteJid ? { ...c, custom_status: null as any } : c
      ));
      toast({ title: 'Removido do Kanban' });
    } catch {
      toast({ title: 'Erro ao remover do Kanban', variant: 'destructive' });
    }
  };

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
          is_pinned: r.is_pinned || false,
          profilePicUrl: r.profile_pic_url || null,
          is_archived: r.is_archived || false,
          is_starred: r.is_starred || false,
          custom_status: r.custom_status || null,
          label_ids: r.label_ids || [],
          is_blocked: r.is_blocked || false,
          is_muted: r.is_muted || false,
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
      // Send mark-read in sequence to avoid edge burst 503s
      for (const c of unreadChats) {
        await invokeUazapiWithRetry(
          { action: 'mark-read', chipId, chatId: c.remoteJid },
          { retries: 2, retryDelayMs: 250 }
        );
      }
      toast({ title: 'Todas as conversas marcadas como lidas' });
    } catch {
      toast({ title: 'Erro ao limpar não lidas', variant: 'destructive' });
    }
  };

  const handleMuteChat = async (chat: ExtendedChat, duration: number) => {
    if (!chipId) return;
    try {
      await supabase.functions.invoke('uazapi-api', {
        body: { action: 'mute-chat', chipId, chatId: chat.remoteJid, duration },
      });
      const isMuted = duration !== 0;
      // Persist locally
      await supabase
        .from('conversations')
        .update({ is_muted: isMuted } as any)
        .eq('chip_id', chipId)
        .eq('remote_jid', chat.remoteJid);
      setChats(prev => prev.map(c =>
        c.remoteJid === chat.remoteJid ? { ...c, is_muted: isMuted } : c
      ));
      const labels: Record<number, string> = { 0: 'Conversa desmutada', 8: 'Silenciado por 8 horas', 168: 'Silenciado por 1 semana', [-1]: 'Silenciado para sempre' };
      toast({ title: labels[duration] || `Silenciado (${duration}h)` });
    } catch {
      toast({ title: 'Erro ao silenciar', variant: 'destructive' });
    }
  };

  const handleBlockContact = async (chat: ExtendedChat, block: boolean) => {
    if (!chipId) return;
    try {
      await supabase.functions.invoke('uazapi-api', {
        body: { action: 'block-contact', chipId, chatId: chat.remoteJid, block },
      });
      // Persist locally
      await supabase
        .from('conversations')
        .update({ is_blocked: block } as any)
        .eq('chip_id', chipId)
        .eq('remote_jid', chat.remoteJid);
      setChats(prev => prev.map(c =>
        c.remoteJid === chat.remoteJid ? { ...c, is_blocked: block } : c
      ));
      toast({ title: block ? '🚫 Contato bloqueado' : '✅ Contato desbloqueado' });
    } catch {
      toast({ title: 'Erro', variant: 'destructive' });
    }
  };

  const handleDeleteChat = async (chat: ExtendedChat) => {
    if (!chipId) return;
    try {
      await supabase.functions.invoke('uazapi-api', {
        body: { action: 'delete-chat', chipId, chatId: chat.remoteJid },
      });
      setChats(prev => prev.filter(c => c.remoteJid !== chat.remoteJid));
      toast({ title: 'Conversa excluída' });
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
    setDeleteChatTarget(null);
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
    if (!chat.lastMessage && !chat.lastMessageAt) return false;
    if (showArchived) {
      if (!chat.is_archived) return false;
    } else {
      if (chat.is_archived) return false;
    }
    if (filterUnread && (chat.unreadCount || 0) === 0) return false;
    if (filterStarred && !chat.is_starred) return false;
    
    if (filterLabel && (!chat.label_ids || !chat.label_ids.includes(filterLabel))) return false;
    if (filterBlocked && !chat.is_blocked) return false;
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
      <div className="p-3 space-y-2.5 bg-gradient-to-b from-card/80 to-transparent">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
            <Input
              placeholder="Buscar conversa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-secondary/30 border border-border/20 h-9 text-sm rounded-xl focus-visible:ring-primary/30"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
            title="Nova conversa"
            onClick={() => { setNewChatDialogOpen(true); setNewChatNumber(''); setContactSearch(''); setContactResults([]); }}
          >
            <MessageSquarePlus className="w-4 h-4" />
          </Button>
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

          <Button
            variant={filterBlocked ? "default" : "ghost"}
            size="sm"
            className={cn("h-7 text-xs shrink-0", !filterBlocked && "text-muted-foreground")}
            onClick={() => setFilterBlocked(!filterBlocked)}
          >
            <Ban className="w-3 h-3 mr-1" /> Bloqueados
          </Button>



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
          <div className="divide-y divide-border/20">
            {sortedChats.map((chat) => {
              return (
              <div key={chat.remoteJid} className="group relative">
                <button
                  onClick={() => {
                    // Optimistic: immediately clear unread badge
                    if (chat.unreadCount > 0) {
                      setChats(prev => prev.map(c =>
                        c.remoteJid === chat.remoteJid ? { ...c, unreadCount: 0 } : c
                      ));
                      // Update parent unread counts immediately
                      if (onUnreadUpdate && chipId) {
                        const newTotal = chats
                          .filter(c => !c.is_archived && c.remoteJid !== chat.remoteJid)
                          .reduce((sum, c) => sum + (c.unreadCount || 0), 0);
                        onUnreadUpdate(chipId, newTotal);
                      }
                    }
                    onSelectChat(chat);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 text-left transition-all duration-150",
                    selectedChatId === chat.remoteJid ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-secondary/40 border-l-2 border-transparent",
                    chat.unreadCount > 0 && "bg-primary/5"
                  )}
                >
                  <Avatar className="w-10 h-10 shrink-0 ring-1 ring-border/30">
                    {chat.profilePicUrl && <AvatarImage src={chat.profilePicUrl} alt={chat.name} />}
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-sm font-semibold">
                      {chat.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
                        {chat.is_blocked && <Ban className="w-3 h-3 text-destructive shrink-0" />}
                        {chat.is_muted && <VolumeX className="w-3 h-3 text-muted-foreground shrink-0" />}
                        {chat.is_pinned && <Pin className="w-3 h-3 text-muted-foreground shrink-0" />}
                        {chat.is_starred && <Star className="w-3 h-3 text-yellow-500 shrink-0 fill-yellow-500" />}
                        <span className={cn("text-sm truncate", chat.unreadCount > 0 ? "font-bold text-foreground" : "font-medium")}>{chat.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {formatTime(chat.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className={cn("text-xs truncate flex-1 min-w-0", chat.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground")}>{chat.lastMessage || chat.phone || 'Abrir conversa'}</span>
                      {chat.unreadCount > 0 && (
                        <span className="ml-2 min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0" style={{ backgroundColor: '#25D366', color: '#ffffff' }}>
                          {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                        </span>
                      )}
                    </div>
                    {/* Kanban badge + Labels row */}
                    <div className="flex gap-1 mt-1 overflow-hidden items-center">
                      {chat.custom_status && (() => {
                        const col = kanbanColumns.find(c => c.name === chat.custom_status);
                        if (!col) return null;
                        return (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted/80" style={{ color: col.color_hex || undefined }}>
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: col.color_hex || '#6b7280' }} />
                            {col.name}
                          </span>
                        );
                      })()}
                      {chat.label_ids && chat.label_ids.slice(0, 3).map(lid => {
                        const label = getLabelName(lid);
                        return label ? <LabelBadge key={lid} name={label.name} colorHex={label.color_hex} /> : null;
                      })}
                    </div>
                  </div>
                </button>

                {/* Context menu button */}
                <div className="absolute right-2 top-2 z-10 opacity-50 group-hover:opacity-100 transition-opacity">
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



                      {/* Kanban submenu */}
                      {kanbanColumns.length > 0 && (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <Columns3 className="w-4 h-4 mr-2" /> Kanban
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {kanbanColumns.map(col => (
                              <DropdownMenuItem key={col.id} onClick={() => handleAddToKanban(chat, col.id)}>
                                <span className="w-2.5 h-2.5 rounded-full mr-2 shrink-0" style={{ backgroundColor: col.color_hex || '#6b7280' }} />
                                {col.name}
                              </DropdownMenuItem>
                            ))}
                            {chat.custom_status && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleRemoveFromKanban(chat)} className="text-destructive focus:text-destructive">
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Remover do Kanban
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      )}

                      <DropdownMenuSeparator />

                      {/* Mute submenu */}
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <BellOff className="w-4 h-4 mr-2" /> Silenciar
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem onClick={() => handleMuteChat(chat, 8)}>8 horas</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleMuteChat(chat, 168)}>1 semana</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleMuteChat(chat, -1)}>Sempre</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleMuteChat(chat, 0)}>Desmutar</DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>

                      <DropdownMenuItem onClick={() => handleBlockContact(chat, !chat.is_blocked)}>
                        <Ban className="w-4 h-4 mr-2" />
                        {chat.is_blocked ? 'Desbloquear contato' : 'Bloquear contato'}
                      </DropdownMenuItem>

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

                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteChatTarget(chat)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Excluir conversa
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

      {/* Delete chat confirmation */}
      <AlertDialog open={!!deleteChatTarget} onOpenChange={(open) => !open && setDeleteChatTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversa</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá excluir a conversa e todas as mensagens do WhatsApp e do banco local. Não é possível desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteChatTarget && handleDeleteChat(deleteChatTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Chat Dialog */}
      <Dialog open={newChatDialogOpen} onOpenChange={setNewChatDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Conversa</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="number" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="number"><Phone className="w-3.5 h-3.5 mr-1.5" />Digitar número</TabsTrigger>
              <TabsTrigger value="contacts"><Users className="w-3.5 h-3.5 mr-1.5" />Buscar contato</TabsTrigger>
            </TabsList>
            <TabsContent value="number" className="space-y-3 mt-3">
              <Input
                placeholder="Ex: 5511999999999"
                value={newChatNumber}
                onChange={(e) => setNewChatNumber(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newChatNumber.length >= 10) {
                    handleStartNewChat(newChatNumber);
                  }
                }}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Digite o número completo com DDD e código do país (ex: 55 para Brasil)</p>
              <DialogFooter>
                <Button
                  disabled={newChatNumber.length < 10}
                  onClick={() => handleStartNewChat(newChatNumber)}
                >
                  Iniciar conversa
                </Button>
              </DialogFooter>
            </TabsContent>
            <TabsContent value="contacts" className="space-y-3 mt-3">
              <Input
                placeholder="Buscar por nome ou número..."
                value={contactSearch}
                onChange={(e) => {
                  const q = e.target.value;
                  setContactSearch(q);
                  if (q.length >= 2) {
                    const results = chats.filter(c =>
                      c.name.toLowerCase().includes(q.toLowerCase()) ||
                      c.phone.includes(q)
                    ).slice(0, 20);
                    setContactResults(results);
                  } else {
                    setContactResults([]);
                  }
                }}
                autoFocus
              />
              <ScrollArea className="max-h-60">
                {contactResults.length > 0 ? (
                  <div className="space-y-1">
                    {contactResults.map(c => (
                      <button
                        key={c.remoteJid}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-secondary/50 text-left transition-colors"
                        onClick={() => {
                          onSelectChat(c);
                          setNewChatDialogOpen(false);
                        }}
                      >
                        <Avatar className="w-8 h-8 shrink-0">
                          {c.profilePicUrl && <AvatarImage src={c.profilePicUrl} alt={c.name} />}
                          <AvatarFallback className="bg-primary/20 text-primary text-xs font-medium">
                            {c.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{c.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{c.phone}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : contactSearch.length >= 2 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum contato encontrado</p>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Digite pelo menos 2 caracteres</p>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );

  async function handleStartNewChat(phoneNumber: string) {
    if (!chipId || !phoneNumber || phoneNumber.length < 10) return;
    let normalized = phoneNumber.replace(/\D/g, '');
    if (normalized.length === 10 || normalized.length === 11) {
      normalized = '55' + normalized;
    }
    const jid = `${normalized}@s.whatsapp.net`;
    try {
      const { data, error } = await supabase
        .from('conversations')
        .upsert(
          { chip_id: chipId, remote_jid: jid, contact_phone: normalized },
          { onConflict: 'chip_id,remote_jid' }
        )
        .select()
        .single();
      if (error) throw error;
      const newChat: ChatContact = {
        id: data.id,
        remoteJid: data.remote_jid,
        name: data.contact_name || data.wa_name || formatPhoneNumber(phoneNumber),
        phone: phoneNumber,
        lastMessage: data.last_message_text || '',
        lastMessageAt: data.last_message_at,
        unreadCount: data.unread_count || 0,
        isGroup: false,
      };
      onSelectChat(newChat);
      setNewChatDialogOpen(false);
      toast({ title: 'Conversa iniciada' });
    } catch (err: any) {
      console.error('Error creating chat:', err);
      toast({ title: 'Erro ao criar conversa', description: err.message, variant: 'destructive' });
    }
  }
}
