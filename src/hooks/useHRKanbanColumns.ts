import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface HRKanbanColumn {
  id: string;
  board: 'candidates' | 'employees';
  slug: string;
  name: string;
  color_hex: string;
  sort_order: number;
}

export function useHRKanbanColumns(board: 'candidates' | 'employees') {
  const { toast } = useToast();
  const [columns, setColumns] = useState<HRKanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchColumns = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('hr_kanban_columns')
        .select('*')
        .eq('board', board)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setColumns((data || []) as HRKanbanColumn[]);
    } catch (err: any) {
      console.error('useHRKanbanColumns fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [board]);

  useEffect(() => { fetchColumns(); }, [fetchColumns]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`hr_kanban_columns_${board}_${Math.random().toString(36).slice(2, 9)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hr_kanban_columns' },
        () => { fetchColumns(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [board, fetchColumns]);

  const createColumn = useCallback(async (name: string, colorHex: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const maxOrder = columns.length > 0 ? Math.max(...columns.map(c => c.sort_order)) : 0;
    const { error } = await (supabase as any).from('hr_kanban_columns').insert({
      board, slug, name, color_hex: colorHex, sort_order: maxOrder + 1,
    });
    if (error) {
      toast({ title: 'Erro ao criar coluna', description: error.message, variant: 'destructive' });
      throw error;
    }
    toast({ title: 'Coluna criada' });
    await fetchColumns();
  }, [board, columns, toast, fetchColumns]);

  const updateColumn = useCallback(async (id: string, patch: Partial<HRKanbanColumn>) => {
    const { error } = await (supabase as any).from('hr_kanban_columns').update(patch).eq('id', id);
    if (error) {
      toast({ title: 'Erro ao atualizar coluna', description: error.message, variant: 'destructive' });
      throw error;
    }
    await fetchColumns();
  }, [toast, fetchColumns]);

  const deleteColumn = useCallback(async (id: string) => {
    const { error } = await (supabase as any).from('hr_kanban_columns').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao remover coluna', description: error.message, variant: 'destructive' });
      throw error;
    }
    toast({ title: 'Coluna removida' });
    await fetchColumns();
  }, [toast, fetchColumns]);

  const reorderColumns = useCallback(async (orderedIds: string[]) => {
    // Update sort_order based on position in array
    const promises = orderedIds.map((id, idx) =>
      (supabase as any).from('hr_kanban_columns').update({ sort_order: idx + 1 }).eq('id', id)
    );
    const results = await Promise.all(promises);
    const err = results.find(r => r.error);
    if (err?.error) {
      toast({ title: 'Erro ao reordenar', description: err.error.message, variant: 'destructive' });
    }
    await fetchColumns();
  }, [toast, fetchColumns]);

  return { columns, loading, createColumn, updateColumn, deleteColumn, reorderColumns, refetch: fetchColumns };
}
