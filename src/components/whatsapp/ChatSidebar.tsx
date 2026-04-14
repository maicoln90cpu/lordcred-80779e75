import { useState } from 'react';
import { Search, MessageSquare, Loader2, Archive, ChevronLeft, Tag, Star, Ban, MessageSquarePlus, UserCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import LabelBadge from './LabelBadge';
import ManageLabelsDialog from './ManageLabelsDialog';
import ChatContactItem from './ChatContactItem';
import NewChatDialog from './NewChatDialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useConversations, formatPhoneNumber } from '@/hooks/useConversations';
import { useChatActions } from '@/hooks/useChatActions';
import type { ExtendedChat } from '@/hooks/useConversations';
import type { ChatContact } from '@/pages/WhatsApp';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ChatSidebarProps {
  selectedChatId: string | null;
  onSelectChat: (chat: ChatContact) => void;
  chipId: string | null;
  onUnreadUpdate?: (chipId: string, totalUnread: number) => void;
  isSyncing?: boolean;
  syncProgress?: string;
  refreshKey?: number;
}

export default function ChatSidebar({ selectedChatId, onSelectChat, chipId, onUnreadUpdate, isSyncing, syncProgress, refreshKey }: ChatSidebarProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterStarred, setFilterStarred] = useState(false);
  const [filterMine, setFilterMine] = useState(false);
  const [filterLabel, setFilterLabel] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'people' | 'groups'>('all');
  const [filterBlocked, setFilterBlocked] = useState(false);
  const [manageLabelsOpen, setManageLabelsOpen] = useState(false);
  const [deleteChatTarget, setDeleteChatTarget] = useState<ExtendedChat | null>(null);
  const [newChatDialogOpen, setNewChatDialogOpen] = useState(false);

  const { chats, setChats, loading, loadingMore, hasMore, labels, kanbanColumns, refreshLabels, loadMore } = useConversations({ chipId, onUnreadUpdate, refreshKey });

  const actions = useChatActions({ chipId, chats, setChats, kanbanColumns });

  // Filter & sort
  const filteredChats = chats.filter(chat => {
    if (!chat.lastMessage && !chat.lastMessageAt) return false;
    if (showArchived ? !chat.is_archived : chat.is_archived) return false;
    if (filterUnread && (chat.unreadCount || 0) === 0) return false;
    if (filterStarred && !chat.is_starred) return false;
    if (filterMine && chat.assigned_user_id !== user?.id) return false;
    if (filterLabel && (!chat.label_ids || !chat.label_ids.includes(filterLabel))) return false;
    if (filterBlocked && !chat.is_blocked) return false;
    if (filterType === 'people' && chat.isGroup) return false;
    if (filterType === 'groups' && !chat.isGroup) return false;
    if (search) return chat.name.toLowerCase().includes(search.toLowerCase()) || chat.phone.includes(search);
    return true;
  });

  const sortedChats = [...filteredChats].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return tb - ta;
  });

  const archivedCount = chats.filter(c => c.is_archived).length;

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][date.getDay()];
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const handleStartNewChat = async (phoneNumber: string) => {
    if (!chipId || !phoneNumber || phoneNumber.length < 10) return;
    let normalized = phoneNumber.replace(/\D/g, '');
    if (normalized.length === 10 || normalized.length === 11) normalized = '55' + normalized;
    const jid = `${normalized}@s.whatsapp.net`;
    try {
      const { data, error } = await supabase.from('conversations')
        .upsert({ chip_id: chipId, remote_jid: jid, contact_phone: normalized }, { onConflict: 'chip_id,remote_jid' })
        .select().single();
      if (error) throw error;
      onSelectChat({
        id: data.id, remoteJid: data.remote_jid,
        name: data.contact_name || data.wa_name || formatPhoneNumber(phoneNumber),
        phone: phoneNumber, lastMessage: data.last_message_text || '',
        lastMessageAt: data.last_message_at, unreadCount: data.unread_count || 0, isGroup: false,
      });
      setNewChatDialogOpen(false);
      toast({ title: 'Conversa iniciada' });
    } catch (err: any) {
      toast({ title: 'Erro ao criar conversa', description: err.message, variant: 'destructive' });
    }
  };

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

  return (
    <div className="flex flex-col h-full">
      {isSyncing && (
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground bg-muted/50 border-b border-border/50 animate-pulse">
          <Loader2 className="w-3 h-3 animate-spin" />
          Sincronizando{syncProgress ? ` ${syncProgress}` : '...'}
        </div>
      )}

      {/* Header */}
      <div className="p-3 space-y-2.5 bg-gradient-to-b from-card/80 to-transparent">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
            <Input placeholder="Buscar conversa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-secondary/30 border border-border/20 h-9 text-sm rounded-xl focus-visible:ring-primary/30" />
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground" title="Nova conversa" onClick={() => setNewChatDialogOpen(true)}>
            <MessageSquarePlus className="w-4 h-4" />
          </Button>
        </div>

        {/* Filters */}
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

          <Button variant={filterUnread ? "default" : "ghost"} size="sm" className={cn("h-7 text-xs shrink-0", !filterUnread && "text-muted-foreground")} onClick={() => setFilterUnread(!filterUnread)}>Não lidas</Button>
          {filterUnread && <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0 text-destructive hover:text-destructive" onClick={actions.handleClearAllUnread}>Limpar todas</Button>}
          <Button variant={filterStarred ? "default" : "ghost"} size="sm" className={cn("h-7 text-xs shrink-0", !filterStarred && "text-muted-foreground")} onClick={() => setFilterStarred(!filterStarred)}><Star className="w-3 h-3 mr-1" /> Favoritas</Button>
          <Button variant={filterType === 'people' ? "default" : "ghost"} size="sm" className={cn("h-7 text-xs shrink-0", filterType !== 'people' && "text-muted-foreground")} onClick={() => setFilterType(filterType === 'people' ? 'all' : 'people')}>Pessoas</Button>
          <Button variant={filterType === 'groups' ? "default" : "ghost"} size="sm" className={cn("h-7 text-xs shrink-0", filterType !== 'groups' && "text-muted-foreground")} onClick={() => setFilterType(filterType === 'groups' ? 'all' : 'groups')}>Grupos</Button>
          <Button variant={filterBlocked ? "default" : "ghost"} size="sm" className={cn("h-7 text-xs shrink-0", !filterBlocked && "text-muted-foreground")} onClick={() => setFilterBlocked(!filterBlocked)}><Ban className="w-3 h-3 mr-1" /> Bloqueados</Button>
          <Button variant={filterMine ? "default" : "ghost"} size="sm" className={cn("h-7 text-xs shrink-0", !filterMine && "text-muted-foreground")} onClick={() => setFilterMine(!filterMine)}><UserCheck className="w-3 h-3 mr-1" /> Minhas</Button>

          {filterLabel ? (
            <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={() => setFilterLabel(null)}>
              <Tag className="w-3 h-3 mr-1" />{labels.find(l => l.label_id === filterLabel)?.name || 'Etiqueta'}<span className="ml-1 text-muted-foreground">✕</span>
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0 text-muted-foreground"><Tag className="w-3 h-3 mr-1" /> Etiquetas</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {labels.length > 0 ? labels.map(label => (
                  <DropdownMenuItem key={label.label_id} onClick={() => setFilterLabel(label.label_id)}>
                    <LabelBadge name={label.name} colorHex={label.color_hex} className="mr-2" />{label.name}
                  </DropdownMenuItem>
                )) : (
                  <DropdownMenuItem disabled className="text-xs text-muted-foreground">Nenhuma etiqueta encontrada</DropdownMenuItem>
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

      {/* Chat list */}
      <ScrollArea className="flex-1" onScrollCapture={(e) => {
        const target = e.currentTarget.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
        if (!target) return;
        if (target.scrollTop + target.clientHeight >= target.scrollHeight - 100) loadMore();
      }}>
        {sortedChats.length === 0 && !loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {showArchived ? 'Nenhuma conversa arquivada' : 'Nenhuma conversa encontrada'}
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {sortedChats.map((chat) => (
              <ChatContactItem
                key={chat.remoteJid}
                chat={chat}
                isSelected={selectedChatId === chat.remoteJid}
                labels={labels}
                kanbanColumns={kanbanColumns}
                formatTime={formatTime}
                onSelect={() => {
                  if (chat.unreadCount > 0) {
                    setChats(prev => prev.map(c => c.remoteJid === chat.remoteJid ? { ...c, unreadCount: 0 } : c));
                    if (onUnreadUpdate && chipId) {
                      const newTotal = chats.filter(c => !c.is_archived && c.remoteJid !== chat.remoteJid).reduce((sum, c) => sum + (c.unreadCount || 0), 0);
                      onUnreadUpdate(chipId, newTotal);
                    }
                  }
                  onSelectChat(chat);
                }}
                onPin={() => actions.handlePin(chat)}
                onStar={() => actions.handleStar(chat)}
                onArchive={(a) => actions.handleArchive(chat, a)}
                onMarkUnread={() => actions.handleMarkUnread(chat)}
                onRename={(name) => actions.handleRenameContact(chat, name)}
                onToggleLabel={(lid) => actions.handleToggleLabel(chat, lid)}
                onMute={(d) => actions.handleMuteChat(chat, d)}
                onBlock={(b) => actions.handleBlockContact(chat, b)}
                onDelete={() => setDeleteChatTarget(chat)}
                onAddToKanban={(cid) => actions.handleAddToKanban(chat, cid)}
                onRemoveFromKanban={() => actions.handleRemoveFromKanban(chat)}
                onManageLabels={() => setManageLabelsOpen(true)}
              />
            ))}
            {loadingMore && (
              <div className="flex justify-center py-3"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            )}
          </div>
        )}
      </ScrollArea>

      <ManageLabelsDialog open={manageLabelsOpen} onOpenChange={setManageLabelsOpen} chipId={chipId} onLabelsUpdated={refreshLabels} />

      <AlertDialog open={!!deleteChatTarget} onOpenChange={(open) => !open && setDeleteChatTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversa</AlertDialogTitle>
            <AlertDialogDescription>Esta ação irá excluir a conversa e todas as mensagens do WhatsApp e do banco local. Não é possível desfazer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteChatTarget) { actions.handleDeleteChat(deleteChatTarget); setDeleteChatTarget(null); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <NewChatDialog open={newChatDialogOpen} onOpenChange={setNewChatDialogOpen} onStartChat={handleStartNewChat} />
    </div>
  );
}
