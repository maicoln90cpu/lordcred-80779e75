import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface KanbanColumn {
  id: string;
  name: string;
  color_hex: string;
  sort_order: number;
  auto_archive_days: number | null;
  created_at: string;
}

export interface KanbanCard {
  id: string;
  conversation_id: string;
  column_id: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joined conversation data
  conversation?: {
    id: string;
    chip_id: string;
    remote_jid: string;
    contact_name: string | null;
    contact_phone: string | null;
    wa_name: string | null;
    profile_pic_url: string | null;
    last_message_text: string | null;
    last_message_at: string | null;
    unread_count: number | null;
    is_group: boolean | null;
    label_ids: string[] | null;
    custom_status: string | null;
  };
  notesCount?: number;
}

export function useKanban() {
  const { user } = useAuth();
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchColumns = useCallback(async () => {
    const { data } = await supabase
      .from('kanban_columns')
      .select('*')
      .order('sort_order');
    if (data) setColumns(data as KanbanColumn[]);
  }, []);

  const fetchCards = useCallback(async () => {
    if (!user) return;

    // Get user's chips
    const { data: chips } = await supabase
      .from('chips')
      .select('id')
      .eq('user_id', user.id);
    if (!chips || chips.length === 0) { setCards([]); return; }

    const chipIds = chips.map(c => c.id);

    // Get kanban cards with conversation data
    const { data: kanbanCards } = await supabase
      .from('kanban_cards')
      .select('*')
      .order('sort_order');

    if (!kanbanCards || kanbanCards.length === 0) { setCards([]); return; }

    const convIds = kanbanCards.map(k => (k as any).conversation_id);

    // Get conversations for these cards
    const { data: convos } = await supabase
      .from('conversations')
      .select('id, chip_id, remote_jid, contact_name, contact_phone, wa_name, profile_pic_url, last_message_text, last_message_at, unread_count, is_group, label_ids, custom_status')
      .in('id', convIds)
      .in('chip_id', chipIds);

    // Get notes count per conversation
    const { data: notes } = await supabase
      .from('conversation_notes')
      .select('remote_jid, chip_id')
      .in('chip_id', chipIds);

    const notesMap: Record<string, number> = {};
    if (notes) {
      for (const n of notes) {
        const key = `${n.chip_id}:${n.remote_jid}`;
        notesMap[key] = (notesMap[key] || 0) + 1;
      }
    }

    const convoMap = new Map((convos || []).map(c => [c.id, c]));

    const enriched: KanbanCard[] = kanbanCards
      .filter(k => convoMap.has((k as any).conversation_id))
      .map(k => {
        const conv = convoMap.get((k as any).conversation_id)!;
        const noteKey = `${conv.chip_id}:${conv.remote_jid}`;
        return {
          ...(k as any),
          conversation: conv,
          notesCount: notesMap[noteKey] || 0,
        };
      });

    setCards(enriched);
  }, [user]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchColumns(), fetchCards()]);
    setLoading(false);
  }, [fetchColumns, fetchCards]);

  // Initial fetch
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime for kanban_cards
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('kanban-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kanban_cards' }, () => {
        fetchCards();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kanban_columns' }, () => {
        fetchColumns();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchCards, fetchColumns]);

  // Move card to a column
  const moveCard = useCallback(async (cardId: string, newColumnId: string, newSortOrder?: number) => {
    // Optimistic update
    setCards(prev => prev.map(c =>
      c.id === cardId ? { ...c, column_id: newColumnId, sort_order: newSortOrder ?? c.sort_order, updated_at: new Date().toISOString() } : c
    ));

    const updateData: any = { column_id: newColumnId, updated_at: new Date().toISOString() };
    if (newSortOrder !== undefined) updateData.sort_order = newSortOrder;

    await supabase.from('kanban_cards').update(updateData).eq('id', cardId);

    // Sync custom_status on conversation (use lowercase key matching STATUS_CONFIG)
    const card = cards.find(c => c.id === cardId);
    const col = columns.find(c => c.id === newColumnId);
    if (card?.conversation && col) {
      const statusKey = col.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
      await supabase.from('conversations').update({ custom_status: statusKey }).eq('id', card.conversation.id);
    }
  }, [cards, columns]);

  // Add card to kanban
  const addCard = useCallback(async (conversationId: string, columnId: string) => {
    const col = columns.find(c => c.id === columnId);
    await supabase.from('kanban_cards').upsert(
      { conversation_id: conversationId, column_id: columnId, sort_order: 0 },
      { onConflict: 'conversation_id' }
    );
    if (col) {
      await supabase.from('conversations').update({ custom_status: col.name }).eq('id', conversationId);
    }
    fetchCards();
  }, [columns, fetchCards]);

  // Remove card
  const removeCard = useCallback(async (cardId: string) => {
    const card = cards.find(c => c.id === cardId);
    await supabase.from('kanban_cards').delete().eq('id', cardId);
    if (card?.conversation) {
      await supabase.from('conversations').update({ custom_status: null }).eq('id', card.conversation.id);
    }
    setCards(prev => prev.filter(c => c.id !== cardId));
  }, [cards]);

  // Column CRUD (admin)
  const createColumn = useCallback(async (name: string, colorHex: string, autoArchiveDays: number | null) => {
    const maxOrder = columns.reduce((max, c) => Math.max(max, c.sort_order), -1);
    await supabase.from('kanban_columns').insert({ name, color_hex: colorHex, sort_order: maxOrder + 1, auto_archive_days: autoArchiveDays });
    fetchColumns();
  }, [columns, fetchColumns]);

  const updateColumn = useCallback(async (id: string, updates: Partial<KanbanColumn>) => {
    await supabase.from('kanban_columns').update(updates).eq('id', id);
    fetchColumns();
  }, [fetchColumns]);

  const deleteColumn = useCallback(async (id: string) => {
    await supabase.from('kanban_columns').delete().eq('id', id);
    fetchColumns();
    fetchCards();
  }, [fetchColumns, fetchCards]);

  const reorderColumns = useCallback(async (orderedIds: string[]) => {
    const updates = orderedIds.map((id, i) =>
      supabase.from('kanban_columns').update({ sort_order: i }).eq('id', id)
    );
    await Promise.all(updates);
    fetchColumns();
  }, [fetchColumns]);

  // Filter out auto-archived cards
  const getVisibleCards = useCallback((columnId: string) => {
    const col = columns.find(c => c.id === columnId);
    return cards.filter(card => {
      if (card.column_id !== columnId) return false;
      if (col?.auto_archive_days && card.updated_at) {
        const archiveDate = new Date(card.updated_at);
        archiveDate.setDate(archiveDate.getDate() + col.auto_archive_days);
        if (archiveDate < new Date()) return false;
      }
      return true;
    });
  }, [cards, columns]);

  return {
    columns,
    cards,
    loading,
    moveCard,
    addCard,
    removeCard,
    createColumn,
    updateColumn,
    deleteColumn,
    reorderColumns,
    getVisibleCards,
    refetch: fetchAll,
  };
}
