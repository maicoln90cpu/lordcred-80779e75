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
  created_by: string | null;
  google_event_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Etapa 4C (abr/2026): hook de eventos manuais do RH.
 * Integração Google Calendar fica reservada para o futuro
 * (campo google_event_id já existe no schema).
 */
export function useHRCalendarEvents() {
  const { toast } = useToast();
  const [events, setEvents] = useState<HRCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`hr_calendar_events_${Math.random().toString(36).slice(2, 9)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hr_calendar_events' },
        () => fetchEvents(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchEvents]);

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
        created_by: u.user?.id ?? null,
      })
      .select()
      .single();
    if (error) {
      toast({ title: 'Erro ao criar evento', description: error.message, variant: 'destructive' });
      throw error;
    }
    toast({ title: 'Evento criado' });
    return data as HRCalendarEvent;
  }, [toast]);

  const updateEvent = useCallback(async (id: string, patch: Partial<HRCalendarEvent>) => {
    const { error } = await (supabase as any)
      .from('hr_calendar_events')
      .update(patch)
      .eq('id', id);
    if (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      throw error;
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
