import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { validateBrazilianPhone, digitsOnly } from '@/lib/phoneUtils';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export type HRKanbanStatus =
  | 'new_resume'
  | 'contacted'
  | 'scheduled_e1'
  | 'done_e1'
  | 'scheduled_e2'
  | 'done_e2'
  | 'approved'
  | 'rejected'
  | 'doubt'
  | 'became_partner';

export interface HRCandidate {
  id: string;
  full_name: string;
  phone: string;
  age: number | null;
  cpf: string | null;
  photo_url: string | null;
  resume_url: string | null;
  type: 'clt' | 'partner';
  kanban_status: HRKanbanStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface HRInterview {
  id: string;
  candidate_id: string;
  stage: 1 | 2;
  interviewer_id: string | null;
  scheduled_at: string | null;
  attended: boolean | null;
  result: string | null;
  score_tecnica: number | null;
  score_cultura: number | null;
  score_energia: number | null;
  observations: string | null;
  created_at: string;
  updated_at: string;
}

export interface HRQuestion {
  id: string;
  stage: 1 | 2;
  order_num: number;
  text: string;
}

export interface HRAnswer {
  id: string;
  interview_id: string;
  question_id: string;
  answer: string | null;
  question_text_snapshot: string | null;
}

export function useHRCandidates() {
  const { toast } = useToast();
  const [candidates, setCandidates] = useState<HRCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  // Lookup mutável do estado atual para uso dentro do handler de realtime
  const candidatesRef = useRef<HRCandidate[]>([]);
  candidatesRef.current = candidates;

  const fetchCandidates = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('hr_candidates')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCandidates((data || []) as HRCandidate[]);
    } catch (err: any) {
      console.error('useHRCandidates fetch error:', err);
      toast({ title: 'Erro ao carregar candidatos', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  // === Realtime subscription dedicada (canal único e estável por instância) ===
  useEffect(() => {
    const channel = supabase
      .channel(`hr_candidates_changes_${Math.random().toString(36).slice(2, 9)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'hr_candidates' },
        (payload: RealtimePostgresChangesPayload<HRCandidate>) => {
          const next = payload.new as HRCandidate;
          if (!next?.id) return;
          setCandidates(prev => {
            if (prev.some(c => c.id === next.id)) return prev;
            return [next, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'hr_candidates' },
        (payload: RealtimePostgresChangesPayload<HRCandidate>) => {
          const next = payload.new as HRCandidate;
          if (!next?.id) return;
          setCandidates(prev => prev.map(c => (c.id === next.id ? { ...c, ...next } : c)));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'hr_candidates' },
        (payload: RealtimePostgresChangesPayload<HRCandidate>) => {
          const old = payload.old as Partial<HRCandidate>;
          if (!old?.id) return;
          setCandidates(prev => prev.filter(c => c.id !== old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // Vazio — canal fica vivo enquanto a instância existir
  }, []);

  const createCandidate = useCallback(async (input: Partial<HRCandidate>) => {
    // Validação de telefone (E.164/BR) antes de bater no banco
    const phoneCheck = validateBrazilianPhone(input.phone);
    if (!phoneCheck.valid) {
      const msg = phoneCheck.reason ?? 'Telefone inválido';
      toast({ title: 'Telefone inválido', description: msg, variant: 'destructive' });
      throw new Error(msg);
    }
    // Prevenção de duplicata em memória (UX rápido — banco também tem índice único)
    const dupe = candidatesRef.current.find(c => digitsOnly(c.phone) === phoneCheck.normalized);
    if (dupe) {
      const msg = `Já existe candidato com este telefone: ${dupe.full_name}`;
      toast({ title: 'Candidato duplicado', description: msg, variant: 'destructive' });
      throw new Error(msg);
    }

    const { data, error } = await (supabase as any)
      .from('hr_candidates')
      .insert({
        full_name: input.full_name,
        phone: phoneCheck.normalized,
        age: input.age ?? null,
        cpf: input.cpf ?? null,
        photo_url: input.photo_url ?? null,
        resume_url: input.resume_url ?? null,
        type: input.type ?? 'clt',
        kanban_status: input.kanban_status ?? 'new_resume',
        notes: input.notes ?? null,
      })
      .select()
      .single();
    if (error) {
      // Trata violação de UNIQUE do banco
      const isUnique = error.code === '23505' || /unique/i.test(error.message || '');
      toast({
        title: isUnique ? 'Candidato duplicado' : 'Erro ao criar candidato',
        description: isUnique
          ? 'Já existe um candidato com este telefone.'
          : error.message,
        variant: 'destructive',
      });
      throw error;
    }
    // Insere local imediatamente (realtime confirma; o filtro evita duplicar)
    setCandidates(prev => {
      if (prev.some(c => c.id === (data as HRCandidate).id)) return prev;
      return [data as HRCandidate, ...prev];
    });
    toast({ title: 'Candidato criado' });
    return data as HRCandidate;
  }, [toast]);

  const updateCandidate = useCallback(async (id: string, patch: Partial<HRCandidate>) => {
    // Optimistic update local
    setCandidates(prev => prev.map(c => (c.id === id ? { ...c, ...patch } as HRCandidate : c)));
    const { error } = await (supabase as any)
      .from('hr_candidates')
      .update(patch)
      .eq('id', id);
    if (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      fetchCandidates();
      throw error;
    }
  }, [toast, fetchCandidates]);

  const moveCandidate = useCallback(async (id: string, status: HRKanbanStatus) => {
    await updateCandidate(id, { kanban_status: status });
  }, [updateCandidate]);

  const deleteCandidate = useCallback(async (id: string) => {
    // Buscar URLs antes de deletar para limpar Storage
    const { data: candidate } = await (supabase as any)
      .from('hr_candidates')
      .select('photo_url, resume_url')
      .eq('id', id)
      .maybeSingle();

    if (candidate?.photo_url && !candidate.photo_url.startsWith('http')) {
      await supabase.storage.from('hr-photos').remove([candidate.photo_url]).catch(() => {});
    }
    if (candidate?.resume_url && !candidate.resume_url.startsWith('http')) {
      await supabase.storage.from('hr-resumes').remove([candidate.resume_url]).catch(() => {});
    }

    // Optimistic remove local — realtime confirma para outras instâncias
    setCandidates(prev => prev.filter(c => c.id !== id));
    const { error } = await (supabase as any).from('hr_candidates').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
      fetchCandidates();
      throw error;
    }
    toast({ title: 'Candidato removido' });
  }, [toast, fetchCandidates]);

  const moveToPartner = useCallback(async (candidate: HRCandidate) => {
    // 1) flag the candidate
    await updateCandidate(candidate.id, { kanban_status: 'became_partner' });
    // 2) create partner lead
    const { error } = await (supabase as any).from('hr_partner_leads').insert({
      full_name: candidate.full_name,
      phone: candidate.phone,
      age: candidate.age,
      cpf: candidate.cpf,
      acquisition_source: 'interview',
    });
    if (error) {
      toast({ title: 'Erro ao criar lead parceiro', description: error.message, variant: 'destructive' });
      throw error;
    }
    toast({ title: 'Movido para Parceiros' });
  }, [updateCandidate, toast]);

  return {
    candidates,
    loading,
    refetch: fetchCandidates,
    createCandidate,
    updateCandidate,
    moveCandidate,
    deleteCandidate,
    moveToPartner,
  };
}

// ===== Interviews & Questions =====
export function useHRInterviews(candidateId: string | null) {
  const { toast } = useToast();
  const [interviews, setInterviews] = useState<HRInterview[]>([]);
  const [questions, setQuestions] = useState<HRQuestion[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!candidateId) {
      setInterviews([]);
      return;
    }
    setLoading(true);
    try {
      const [intRes, qRes] = await Promise.all([
        (supabase as any)
          .from('hr_interviews')
          .select('*')
          .eq('candidate_id', candidateId)
          .order('stage', { ascending: true }),
        (supabase as any)
          .from('hr_questions')
          .select('*')
          .order('stage', { ascending: true })
          .order('order_num', { ascending: true }),
      ]);
      if (intRes.error) throw intRes.error;
      if (qRes.error) throw qRes.error;
      setInterviews((intRes.data || []) as HRInterview[]);
      setQuestions((qRes.data || []) as HRQuestion[]);
    } catch (err: any) {
      toast({ title: 'Erro ao carregar entrevistas', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [candidateId, toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const saveInterview = useCallback(async (
    interview: Partial<HRInterview> & { stage: 1 | 2 },
    answers: { question_id: string; answer: string }[],
  ) => {
    if (!candidateId) throw new Error('Sem candidato');
    const payload: any = {
      candidate_id: candidateId,
      stage: interview.stage,
      interviewer_id: interview.interviewer_id ?? null,
      scheduled_at: interview.scheduled_at ?? null,
      attended: interview.attended ?? null,
      result: interview.result ?? null,
      observations: interview.observations ?? null,
    };
    if (interview.stage === 1) {
      payload.score_tecnica = interview.score_tecnica ?? null;
      payload.score_cultura = interview.score_cultura ?? null;
      payload.score_energia = interview.score_energia ?? null;
    }

    let interviewId = interview.id;
    if (interviewId) {
      const { error } = await (supabase as any)
        .from('hr_interviews')
        .update(payload)
        .eq('id', interviewId);
      if (error) throw error;
    } else {
      const { data, error } = await (supabase as any)
        .from('hr_interviews')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      interviewId = data.id;
    }

    // Replace answers (delete + insert in batch)
    if (interviewId && answers.length > 0) {
      await (supabase as any).from('hr_interview_answers').delete().eq('interview_id', interviewId);
      const rows = answers
        .filter(a => a.answer && a.answer.trim().length > 0)
        .map(a => ({ interview_id: interviewId, question_id: a.question_id, answer: a.answer }));
      if (rows.length > 0) {
        const { error } = await (supabase as any).from('hr_interview_answers').insert(rows);
        if (error) throw error;
      }
    }

    toast({ title: 'Entrevista salva' });
    await fetchAll();
    return interviewId;
  }, [candidateId, fetchAll, toast]);

  const fetchAnswers = useCallback(async (interviewId: string) => {
    const { data, error } = await (supabase as any)
      .from('hr_interview_answers')
      .select('*')
      .eq('interview_id', interviewId);
    if (error) throw error;
    return (data || []) as HRAnswer[];
  }, []);

  return { interviews, questions, loading, saveInterview, refetch: fetchAll, fetchAnswers };
}
