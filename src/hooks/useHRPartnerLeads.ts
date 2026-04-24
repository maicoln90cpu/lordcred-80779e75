import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { validateBrazilianPhone, digitsOnly } from '@/lib/phoneUtils';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

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
  const leadsRef = useRef<HRPartnerLead[]>([]);
  leadsRef.current = leads;

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

  // === Realtime: subscrição dedicada com handlers granulares ===
  useEffect(() => {
    const channel = supabase
      .channel(`hr_partner_leads_changes_${Math.random().toString(36).slice(2, 9)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'hr_partner_leads' },
        (payload: RealtimePostgresChangesPayload<HRPartnerLead>) => {
          const next = payload.new as HRPartnerLead;
          if (!next?.id) return;
          setLeads(prev => {
            if (prev.some(l => l.id === next.id)) return prev;
            return [next, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'hr_partner_leads' },
        (payload: RealtimePostgresChangesPayload<HRPartnerLead>) => {
          const next = payload.new as HRPartnerLead;
          if (!next?.id) return;
          setLeads(prev => prev.map(l => (l.id === next.id ? { ...l, ...next } : l)));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'hr_partner_leads' },
        (payload: RealtimePostgresChangesPayload<HRPartnerLead>) => {
          const old = payload.old as Partial<HRPartnerLead>;
          if (!old?.id) return;
          setLeads(prev => prev.filter(l => l.id !== old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const createLead = useCallback(async (input: Partial<HRPartnerLead>) => {
    // Validação de telefone E.164/BR
    const phoneCheck = validateBrazilianPhone(input.phone);
    if (!phoneCheck.valid) {
      const msg = phoneCheck.reason ?? 'Telefone inválido';
      toast({ title: 'Telefone inválido', description: msg, variant: 'destructive' });
      throw new Error(msg);
    }
    const dupe = leadsRef.current.find(l => digitsOnly(l.phone) === phoneCheck.normalized);
    if (dupe) {
      const msg = `Já existe parceiro com este telefone: ${dupe.full_name}`;
      toast({ title: 'Parceiro duplicado', description: msg, variant: 'destructive' });
      throw new Error(msg);
    }

    const { data, error } = await (supabase as any)
      .from('hr_partner_leads')
      .insert({
        full_name: input.full_name,
        phone: phoneCheck.normalized,
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
      const isUnique = error.code === '23505' || /unique/i.test(error.message || '');
      toast({
        title: isUnique ? 'Parceiro duplicado' : 'Erro ao criar lead',
        description: isUnique ? 'Já existe um parceiro com este telefone.' : error.message,
        variant: 'destructive',
      });
      throw error;
    }
    setLeads(prev => {
      if (prev.some(l => l.id === (data as HRPartnerLead).id)) return prev;
      return [data as HRPartnerLead, ...prev];
    });
    toast({ title: 'Lead parceiro criado' });
    return data as HRPartnerLead;
  }, [toast]);

  const updateLead = useCallback(async (id: string, patch: Partial<HRPartnerLead>) => {
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, ...patch } as HRPartnerLead : l)));
    const { error } = await (supabase as any)
      .from('hr_partner_leads')
      .update(patch)
      .eq('id', id);
    if (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      fetchLeads();
      throw error;
    }
  }, [toast, fetchLeads]);

  const deleteLead = useCallback(async (id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id));
    const { error } = await (supabase as any).from('hr_partner_leads').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
      fetchLeads();
      throw error;
    }
    toast({ title: 'Lead removido' });
  }, [toast, fetchLeads]);

  return { leads, loading, refetch: fetchLeads, createLead, updateLead, deleteLead };
}
