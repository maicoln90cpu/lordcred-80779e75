import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

export type HRMeetingStatus = 'called' | 'include_next' | 'scheduled';
export type HRAcquisitionSource = 'interview' | 'referral';

export interface HRPartnerLead {
  id: string;
  full_name: string;
  phone: string;
  age: number | null;
  cpf: string | null;
  interview_date: string | null;
  observations: string | null;
  meeting_status: HRMeetingStatus;
  meeting_date: string | null;
  sent_link: boolean;
  accepted: boolean;
  mei_informed: boolean;
  mei_created: string | null;
  acquisition_source: HRAcquisitionSource;
  referred_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useHRPartnerLeads() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<HRPartnerLead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('hr_partner_leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLeads((data || []) as HRPartnerLead[]);
    } catch (err: any) {
      toast({ title: 'Erro ao carregar parceiros', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  useRealtimeSubscription(
    () => { fetchLeads(); },
    { table: 'hr_partner_leads', event: '*', debounceMs: 300 }
  );

  const createLead = useCallback(async (input: Partial<HRPartnerLead>) => {
    const { data, error } = await (supabase as any)
      .from('hr_partner_leads')
      .insert({
        full_name: input.full_name,
        phone: input.phone,
        age: input.age ?? null,
        cpf: input.cpf ?? null,
        interview_date: input.interview_date ?? null,
        observations: input.observations ?? null,
        meeting_status: input.meeting_status ?? 'called',
        meeting_date: input.meeting_date ?? null,
        sent_link: input.sent_link ?? false,
        accepted: input.accepted ?? false,
        mei_informed: input.mei_informed ?? false,
        mei_created: input.mei_created ?? null,
        acquisition_source: input.acquisition_source ?? 'interview',
        referred_by: input.referred_by ?? null,
      })
      .select()
      .single();
    if (error) {
      toast({ title: 'Erro ao criar lead', description: error.message, variant: 'destructive' });
      throw error;
    }
    toast({ title: 'Lead parceiro criado' });
    return data as HRPartnerLead;
  }, [toast]);

  const updateLead = useCallback(async (id: string, patch: Partial<HRPartnerLead>) => {
    const { error } = await (supabase as any)
      .from('hr_partner_leads')
      .update(patch)
      .eq('id', id);
    if (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      throw error;
    }
  }, [toast]);

  const deleteLead = useCallback(async (id: string) => {
    const { error } = await (supabase as any).from('hr_partner_leads').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
      throw error;
    }
    toast({ title: 'Lead removido' });
  }, [toast]);

  return { leads, loading, refetch: fetchLeads, createLead, updateLead, deleteLead };
}
