import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invokeUazapiWithRetry } from '@/lib/invokeEdgeWithRetry';
import { useToast } from '@/hooks/use-toast';
import type { ExtendedChat } from '@/hooks/useConversations';

interface UseChatActionsOptions {
  chipId: string | null;
  chats: ExtendedChat[];
  setChats: React.Dispatch<React.SetStateAction<ExtendedChat[]>>;
  kanbanColumns: { id: string; name: string; color_hex: string | null }[];
}

export function useChatActions({ chipId, chats, setChats, kanbanColumns }: UseChatActionsOptions) {
  const { toast } = useToast();

  const handleArchive = useCallback(async (chat: ExtendedChat, archive: boolean) => {
    if (!chipId) return;
    try {
      await supabase.from('conversations').update({ is_archived: archive } as any)
        .eq('chip_id', chipId).eq('remote_jid', chat.remoteJid);
      setChats(prev => prev.map(c => c.remoteJid === chat.remoteJid ? { ...c, is_archived: archive } : c));
      toast({ title: archive ? 'Conversa arquivada' : 'Conversa desarquivada' });
    } catch { toast({ title: 'Erro', variant: 'destructive' }); }
  }, [chipId, setChats, toast]);

  const handlePin = useCallback(async (chat: ExtendedChat) => {
    if (!chipId) return;
    const newVal = !chat.is_pinned;
    try {
      await supabase.from('conversations').update({ is_pinned: newVal } as any)
        .eq('chip_id', chipId).eq('remote_jid', chat.remoteJid);
      setChats(prev => {
        const updated = prev.map(c => c.remoteJid === chat.remoteJid ? { ...c, is_pinned: newVal, isPinned: newVal } : c);
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
    } catch { toast({ title: 'Erro', variant: 'destructive' }); }
  }, [chipId, setChats, toast]);

  const handleStar = useCallback(async (chat: ExtendedChat) => {
    if (!chipId) return;
    const newVal = !chat.is_starred;
    try {
      await supabase.from('conversations').update({ is_starred: newVal } as any)
        .eq('chip_id', chipId).eq('remote_jid', chat.remoteJid);
      setChats(prev => prev.map(c => c.remoteJid === chat.remoteJid ? { ...c, is_starred: newVal } : c));
      toast({ title: newVal ? '⭐ Conversa favorita' : 'Removida dos favoritos' });
    } catch { toast({ title: 'Erro', variant: 'destructive' }); }
  }, [chipId, setChats, toast]);

  const handleToggleLabel = useCallback(async (chat: ExtendedChat, labelId: string) => {
    if (!chipId) return;
    const hasLabel = chat.label_ids?.includes(labelId);
    const newLabelIds = hasLabel
      ? (chat.label_ids || []).filter(id => id !== labelId)
      : [...(chat.label_ids || []), labelId];
    try {
      await supabase.from('conversations').update({ label_ids: newLabelIds } as any)
        .eq('chip_id', chipId).eq('remote_jid', chat.remoteJid);
      setChats(prev => prev.map(c => c.remoteJid === chat.remoteJid ? { ...c, label_ids: newLabelIds } : c));
    } catch { toast({ title: 'Erro ao atualizar etiqueta', variant: 'destructive' }); }
  }, [chipId, setChats, toast]);

  const handleRenameContact = useCallback(async (chat: ExtendedChat, newName: string) => {
    if (!chipId || !newName.trim()) return;
    try {
      await supabase.from('conversations').update({ contact_name: newName.trim() } as any)
        .eq('chip_id', chipId).eq('remote_jid', chat.remoteJid);
      setChats(prev => prev.map(c => c.remoteJid === chat.remoteJid ? { ...c, name: newName.trim() } : c));
      toast({ title: 'Nome atualizado' });
    } catch { toast({ title: 'Erro', variant: 'destructive' }); }
  }, [chipId, setChats, toast]);

  const handleClearAllUnread = useCallback(async () => {
    if (!chipId) return;
    try {
      const unreadChats = chats.filter(c => (c.unreadCount || 0) > 0 && !c.is_archived);
      for (const c of unreadChats) {
        await invokeUazapiWithRetry(
          { action: 'mark-read', chipId, chatId: c.remoteJid },
          { retries: 2, retryDelayMs: 250 }
        );
      }
      toast({ title: 'Todas as conversas marcadas como lidas' });
    } catch { toast({ title: 'Erro ao limpar não lidas', variant: 'destructive' }); }
  }, [chipId, chats, toast]);

  const handleMuteChat = useCallback(async (chat: ExtendedChat, duration: number) => {
    if (!chipId) return;
    try {
      await supabase.functions.invoke('uazapi-api', {
        body: { action: 'mute-chat', chipId, chatId: chat.remoteJid, duration },
      });
      const isMuted = duration !== 0;
      await supabase.from('conversations').update({ is_muted: isMuted } as any)
        .eq('chip_id', chipId).eq('remote_jid', chat.remoteJid);
      setChats(prev => prev.map(c => c.remoteJid === chat.remoteJid ? { ...c, is_muted: isMuted } : c));
      const labels: Record<number, string> = { 0: 'Conversa desmutada', 8: 'Silenciado por 8 horas', 168: 'Silenciado por 1 semana', [-1]: 'Silenciado para sempre' };
      toast({ title: labels[duration] || `Silenciado (${duration}h)` });
    } catch { toast({ title: 'Erro ao silenciar', variant: 'destructive' }); }
  }, [chipId, setChats, toast]);

  const handleBlockContact = useCallback(async (chat: ExtendedChat, block: boolean) => {
    if (!chipId) return;
    try {
      await supabase.functions.invoke('uazapi-api', {
        body: { action: 'block-contact', chipId, chatId: chat.remoteJid, block },
      });
      await supabase.from('conversations').update({ is_blocked: block } as any)
        .eq('chip_id', chipId).eq('remote_jid', chat.remoteJid);
      setChats(prev => prev.map(c => c.remoteJid === chat.remoteJid ? { ...c, is_blocked: block } : c));
      toast({ title: block ? '🚫 Contato bloqueado' : '✅ Contato desbloqueado' });
    } catch { toast({ title: 'Erro', variant: 'destructive' }); }
  }, [chipId, setChats, toast]);

  const handleDeleteChat = useCallback(async (chat: ExtendedChat) => {
    if (!chipId) return;
    try {
      await supabase.functions.invoke('uazapi-api', {
        body: { action: 'delete-chat', chipId, chatId: chat.remoteJid },
      });
      setChats(prev => prev.filter(c => c.remoteJid !== chat.remoteJid));
      toast({ title: 'Conversa excluída' });
    } catch { toast({ title: 'Erro ao excluir', variant: 'destructive' }); }
  }, [chipId, setChats, toast]);

  const handleMarkUnread = useCallback(async (chat: ExtendedChat) => {
    if (!chipId) return;
    try {
      await supabase.functions.invoke('uazapi-api', {
        body: { action: 'mark-unread', chipId, chatId: chat.remoteJid },
      });
      toast({ title: 'Conversa marcada como não lida' });
    } catch { toast({ title: 'Erro', variant: 'destructive' }); }
  }, [chipId, toast]);

  const handleAddToKanban = useCallback(async (chat: ExtendedChat, columnId: string) => {
    if (!chipId) return;
    try {
      const { data: conv } = await supabase.from('conversations').select('id')
        .eq('chip_id', chipId).eq('remote_jid', chat.remoteJid).single();
      if (!conv) return;
      const col = kanbanColumns.find(c => c.id === columnId);
      await supabase.from('kanban_cards').upsert(
        { conversation_id: conv.id, column_id: columnId, sort_order: 0 } as any,
        { onConflict: 'conversation_id' }
      );
      if (col) {
        await supabase.from('conversations').update({ custom_status: col.name } as any)
          .eq('chip_id', chipId).eq('remote_jid', chat.remoteJid);
        setChats(prev => prev.map(c => c.remoteJid === chat.remoteJid ? { ...c, custom_status: col.name } : c));
      }
      toast({ title: `Adicionado ao Kanban: ${col?.name || 'coluna'}` });
    } catch { toast({ title: 'Erro ao adicionar ao Kanban', variant: 'destructive' }); }
  }, [chipId, setChats, kanbanColumns, toast]);

  const handleRemoveFromKanban = useCallback(async (chat: ExtendedChat) => {
    if (!chipId) return;
    try {
      const { data: conv } = await supabase.from('conversations').select('id')
        .eq('chip_id', chipId).eq('remote_jid', chat.remoteJid).single();
      if (!conv) return;
      await supabase.from('kanban_cards').delete().eq('conversation_id', conv.id);
      await supabase.from('conversations').update({ custom_status: null } as any)
        .eq('chip_id', chipId).eq('remote_jid', chat.remoteJid);
      setChats(prev => prev.map(c => c.remoteJid === chat.remoteJid ? { ...c, custom_status: null } : c));
      toast({ title: 'Removido do Kanban' });
    } catch { toast({ title: 'Erro ao remover do Kanban', variant: 'destructive' }); }
  }, [chipId, setChats, toast]);

  return {
    handleArchive, handlePin, handleStar, handleToggleLabel,
    handleRenameContact, handleClearAllUnread, handleMuteChat,
    handleBlockContact, handleDeleteChat, handleMarkUnread,
    handleAddToKanban, handleRemoveFromKanban,
  };
}
