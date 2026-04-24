import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type HRNotificationStatus = 'pending' | 'sent' | 'failed';
export type HRRecipientType = 'candidate' | 'interviewer' | 'both';
export type HRMessageTemplate = 'template_1' | 'template_2';
export type HREntityType = 'interview' | 'meeting';

export interface HRNotification {
  id: string;
  entity_type: HREntityType;
  entity_id: string;
  recipient_type: HRRecipientType;
  phone_candidate: string | null;
  phone_interviewer: string | null;
  chip_instance_id: string | null;
  message_template: HRMessageTemplate;
  send_at: string;
  offset_minutes: number;
  status: HRNotificationStatus;
  sent_at: string | null;
  created_at: string;
}

export interface HRNotificationSettings {
  id: string;
  offset_1_minutes: number;
  offset_2_minutes: number;
  template_1_text: string;
  template_2_text: string;
  updated_at: string;
}

export interface ScheduleParams {
  entity_type: HREntityType;
  entity_id: string;
  scheduled_at: string;       // ISO
  recipient_type: HRRecipientType;
  phone_candidate?: string | null;
  phone_interviewer?: string | null;
  chip_instance_id: string;
}

export function useHRNotifications() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<HRNotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('hr_notification_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      setSettings(data as HRNotificationSettings | null);
    } catch (err: any) {
      toast({ title: 'Erro ao carregar configurações', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const updateSettings = useCallback(async (patch: Partial<HRNotificationSettings>) => {
    if (!settings) return;
    const { error } = await (supabase as any)
      .from('hr_notification_settings')
      .update(patch)
      .eq('id', settings.id);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      throw error;
    }
    toast({ title: 'Configurações salvas' });
    await fetchSettings();
  }, [settings, fetchSettings, toast]);

  /**
   * Cria 2 notificações pendentes (offset_1 e offset_2 antes do scheduled_at).
   */
  const scheduleNotifications = useCallback(async (params: ScheduleParams) => {
    if (!settings) {
      throw new Error('Configurações de notificação não carregadas');
    }
    const baseTime = new Date(params.scheduled_at).getTime();
    const rows = [
      {
        offset_minutes: settings.offset_1_minutes,
        message_template: 'template_1' as HRMessageTemplate,
      },
      {
        offset_minutes: settings.offset_2_minutes,
        message_template: 'template_2' as HRMessageTemplate,
      },
    ].map(r => ({
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      recipient_type: params.recipient_type,
      phone_candidate: params.phone_candidate ?? null,
      phone_interviewer: params.phone_interviewer ?? null,
      chip_instance_id: params.chip_instance_id,
      message_template: r.message_template,
      offset_minutes: r.offset_minutes,
      send_at: new Date(baseTime - r.offset_minutes * 60_000).toISOString(),
      status: 'pending' as HRNotificationStatus,
    }));

    const { error } = await (supabase as any).from('hr_notifications').insert(rows);
    if (error) {
      toast({ title: 'Erro ao agendar notificações', description: error.message, variant: 'destructive' });
      throw error;
    }
    toast({ title: 'Notificações agendadas' });
  }, [settings, toast]);

  const listForEntity = useCallback(async (entityId: string) => {
    const { data, error } = await (supabase as any)
      .from('hr_notifications')
      .select('*')
      .eq('entity_id', entityId)
      .order('send_at', { ascending: true });
    if (error) throw error;
    return (data || []) as HRNotification[];
  }, []);

  return { settings, loading, updateSettings, scheduleNotifications, listForEntity, refetch: fetchSettings };
}
