import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface HREmployee {
  id: string;
  source_candidate_id: string | null;
  full_name: string;
  phone: string;
  age: number | null;
  cpf: string | null;
  photo_url: string | null;
  resume_url: string | null;
  type: string;
  kanban_status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useHREmployees() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<HREmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const employeesRef = useRef<HREmployee[]>([]);
  employeesRef.current = employees;

  const fetchEmployees = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('hr_employees')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setEmployees((data || []) as HREmployee[]);
    } catch (err: any) {
      console.error('useHREmployees fetch error:', err);
      toast({ title: 'Erro ao carregar colaboradores', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  useEffect(() => {
    const channel = supabase
      .channel(`hr_employees_changes_${Math.random().toString(36).slice(2, 9)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hr_employees' },
        (payload: RealtimePostgresChangesPayload<HREmployee>) => {
          const next = payload.new as HREmployee;
          if (!next?.id) return;
          setEmployees(prev => prev.some(e => e.id === next.id) ? prev : [next, ...prev]);
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hr_employees' },
        (payload: RealtimePostgresChangesPayload<HREmployee>) => {
          const next = payload.new as HREmployee;
          if (!next?.id) return;
          setEmployees(prev => prev.map(e => e.id === next.id ? { ...e, ...next } : e));
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'hr_employees' },
        (payload: RealtimePostgresChangesPayload<HREmployee>) => {
          const old = payload.old as Partial<HREmployee>;
          if (!old?.id) return;
          setEmployees(prev => prev.filter(e => e.id !== old.id));
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const createEmployee = useCallback(async (input: Partial<HREmployee>) => {
    const { data, error } = await (supabase as any)
      .from('hr_employees')
      .insert({
        full_name: input.full_name,
        phone: input.phone,
        age: input.age ?? null,
        cpf: input.cpf ?? null,
        photo_url: input.photo_url ?? null,
        resume_url: input.resume_url ?? null,
        type: input.type ?? 'clt',
        kanban_status: input.kanban_status ?? 'send_docs',
        notes: input.notes ?? null,
        source_candidate_id: input.source_candidate_id ?? null,
      })
      .select()
      .single();
    if (error) {
      toast({ title: 'Erro ao criar colaborador', description: error.message, variant: 'destructive' });
      throw error;
    }
    setEmployees(prev => prev.some(e => e.id === (data as HREmployee).id) ? prev : [data as HREmployee, ...prev]);
    toast({ title: 'Colaborador criado' });
    return data as HREmployee;
  }, [toast]);

  const updateEmployee = useCallback(async (id: string, patch: Partial<HREmployee>) => {
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...patch } as HREmployee : e));
    const { error } = await (supabase as any).from('hr_employees').update(patch).eq('id', id);
    if (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      fetchEmployees();
      throw error;
    }
  }, [toast, fetchEmployees]);

  const moveEmployee = useCallback(async (id: string, status: string) => {
    await updateEmployee(id, { kanban_status: status });
  }, [updateEmployee]);

  const deleteEmployee = useCallback(async (id: string) => {
    setEmployees(prev => prev.filter(e => e.id !== id));
    const { error } = await (supabase as any).from('hr_employees').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
      fetchEmployees();
      throw error;
    }
    toast({ title: 'Colaborador removido' });
  }, [toast, fetchEmployees]);

  return { employees, loading, refetch: fetchEmployees, createEmployee, updateEmployee, moveEmployee, deleteEmployee };
}
