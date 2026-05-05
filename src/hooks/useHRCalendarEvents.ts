import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type HRCalendarEventType =
  | 'interview_e1'
  | 'interview_e2'
  | 'meeting'
  | 'reminder'
  | 'other';

export interface HRCalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: HRCalendarEventType;
  candidate_id: string | null;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  color: string | null;
  all_day: boolean;
  created_by: string | null;
  google_event_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Hook de eventos manuais do RH com estado local imediato + realtime granular.
 * Garante que criar/editar/excluir/arrastar reflitam na hora, sem F5.
 */
export function useHRCalendarEvents() {
  const { toast } = useToast();
  const [events, setEvents] = useState<HRCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('hr_calendar_events')
        .select('*')
        .order('starts_at', { ascending: true });
      if (error) throw error;
      setEvents((data || []) as HRCalendarEvent[]);
    } catch (err: any) {
      toast({ title: 'Erro ao carregar agenda', description: err.message, variant: 'destructive' });
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchEvents(true);
  }, [fetchEvents]);

  // Realtime granular: aplica payload localmente sem refetch global.
  useEffect(() => {
    const channel = supabase
      .channel(`hr_calendar_events_${Math.random().toString(36).slice(2, 9)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'hr_calendar_events' },
        (payload) => {
          const row = payload.new as HRCalendarEvent;
          setEvents((prev) => (prev.some((e) => e.id === row.id) ? prev : [...prev, row]
            .sort((a, b) => a.starts_at.localeCompare(b.starts_at))));
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'hr_calendar_events' },
        (payload) => {
          const row = payload.new as HRCalendarEvent;
          setEvents((prev) => prev.map((e) => (e.id === row.id ? { ...e, ...row } : e)));
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'hr_calendar_events' },
        (payload) => {
          const row = payload.old as { id: string };
          setEvents((prev) => prev.filter((e) => e.id !== row.id));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const createEvent = useCallback(async (input: Partial<HRCalendarEvent>) => {
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await (supabase as any)
      .from('hr_calendar_events')
      .insert({
        title: input.title,
        description: input.description ?? null,
        event_type: input.event_type ?? 'other',
        candidate_id: input.candidate_id ?? null,
        starts_at: input.starts_at,
        ends_at: input.ends_at ?? null,
        location: input.location ?? null,
        color: input.color ?? null,
        all_day: input.all_day ?? false,
        created_by: u.user?.id ?? null,
      })
      .select()
      .single();
    if (error) {
      toast({ title: 'Erro ao criar evento', description: error.message, variant: 'destructive' });
      throw error;
    }
    // atualização imediata sem esperar realtime
    const row = data as HRCalendarEvent;
    setEvents((prev) => (prev.some((e) => e.id === row.id) ? prev : [...prev, row]
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))));
    toast({ title: 'Evento criado' });
    return row;
  }, [toast]);

  const updateEvent = useCallback(async (id: string, patch: Partial<HRCalendarEvent>) => {
    const { data, error } = await (supabase as any)
      .from('hr_calendar_events')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      throw error;
    }
    if (data) {
      const row = data as HRCalendarEvent;
      setEvents((prev) => prev.map((e) => (e.id === row.id ? { ...e, ...row } : e)));
    }
  }, [toast]);

  const deleteEvent = useCallback(async (id: string) => {
    const { error } = await (supabase as any)
      .from('hr_calendar_events')
      .delete()
      .eq('id', id);
    if (error) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
      throw error;
    }
    setEvents((prev) => prev.filter((e) => e.id !== id));
    toast({ title: 'Evento removido' });
  }, [toast]);

  return { events, loading, refetch: fetchEvents, createEvent, updateEvent, deleteEvent };
}

export const EVENT_TYPE_LABEL: Record<HRCalendarEventType, string> = {
  interview_e1: 'Entrevista E1',
  interview_e2: 'Entrevista E2',
  meeting: 'Reunião',
  reminder: 'Lembrete',
  other: 'Outro',
};

export const EVENT_TYPE_TOKEN: Record<HRCalendarEventType, string> = {
  interview_e1: '--hr-scheduled-e1',
  interview_e2: '--hr-scheduled-e2',
  meeting: '--hr-contacted',
  reminder: '--hr-doubt',
  other: '--hr-new',
};
