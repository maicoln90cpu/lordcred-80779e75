import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface HRAccessCredential {
  id: string;
  entity_type: 'candidate' | 'employee';
  entity_id: string;
  system_name: string;
  login: string;
  password: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useHRAccessCredentials(entityType: 'candidate' | 'employee', entityId: string | null) {
  const { toast } = useToast();
  const [credentials, setCredentials] = useState<HRAccessCredential[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!entityId) { setCredentials([]); return; }
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('hr_access_credentials')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('system_name', { ascending: true });
      if (error) throw error;
      setCredentials((data || []) as HRAccessCredential[]);
    } catch (err: any) {
      toast({ title: 'Erro ao carregar acessos', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, toast]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = useCallback(async (input: { system_name: string; login: string; password: string; notes?: string }) => {
    if (!entityId) return;
    const { data, error } = await (supabase as any).from('hr_access_credentials').insert({
      entity_type: entityType,
      entity_id: entityId,
      system_name: input.system_name,
      login: input.login,
      password: input.password,
      notes: input.notes ?? null,
    }).select().single();
    if (error) {
      toast({ title: 'Erro ao criar acesso', description: error.message, variant: 'destructive' });
      throw error;
    }
    setCredentials(prev => [...prev, data as HRAccessCredential]);
    toast({ title: 'Acesso criado' });
    return data as HRAccessCredential;
  }, [entityType, entityId, toast]);

  const update = useCallback(async (id: string, patch: Partial<HRAccessCredential>) => {
    const { error } = await (supabase as any).from('hr_access_credentials').update(patch).eq('id', id);
    if (error) {
      toast({ title: 'Erro ao atualizar acesso', description: error.message, variant: 'destructive' });
      throw error;
    }
    setCredentials(prev => prev.map(c => c.id === id ? { ...c, ...patch } as HRAccessCredential : c));
  }, [toast]);

  const remove = useCallback(async (id: string) => {
    const { error } = await (supabase as any).from('hr_access_credentials').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao remover acesso', description: error.message, variant: 'destructive' });
      throw error;
    }
    setCredentials(prev => prev.filter(c => c.id !== id));
    toast({ title: 'Acesso removido' });
  }, [toast]);

  return { credentials, loading, create, update, remove, refetch: fetch };
}
