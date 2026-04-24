import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

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
}

export function useHRCandidates() {
  const { toast } = useToast();
  const [candidates, setCandidates] = useState<HRCandidate[]>([]);
  const [loading, setLoading] = useState(true);

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

  useRealtimeSubscription(
    () => { fetchCandidates(); },
    { table: 'hr_candidates', event: '*', debounceMs: 300 }
  );

  const createCandidate = useCallback(async (input: Partial<HRCandidate>) => {
    const { data, error } = await (supabase as any)
      .from('hr_candidates')
      .insert({
        full_name: input.full_name,
        phone: input.phone,
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
      toast({ title: 'Erro ao criar candidato', description: error.message, variant: 'destructive' });
      throw error;
    }
    toast({ title: 'Candidato criado' });
    return data as HRCandidate;
  }, [toast]);

  const updateCandidate = useCallback(async (id: string, patch: Partial<HRCandidate>) => {
    const { error } = await (supabase as any)
      .from('hr_candidates')
      .update(patch)
      .eq('id', id);
    if (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      throw error;
    }
  }, [toast]);

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

    // Tentar remover arquivos do Storage (falha silenciosa — arquivos órfãos
    // são menos críticos que candidatos presos no banco).
    // Pula entradas que começam com "http" (legado de URL assinada).
    if (candidate?.photo_url && !candidate.photo_url.startsWith('http')) {
      // Para fotos salvamos a publicUrl, então só limpamos quando o valor for um path puro
      // (compatibilidade com possíveis futuros uploads que armazenem path).
      await supabase.storage.from('hr-photos').remove([candidate.photo_url]).catch(() => {});
    }
    if (candidate?.resume_url && !candidate.resume_url.startsWith('http')) {
      await supabase.storage.from('hr-resumes').remove([candidate.resume_url]).catch(() => {});
    }

    // Deletar o registro (cascade remove entrevistas e respostas)
    const { error } = await (supabase as any).from('hr_candidates').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
      throw error;
    }
    toast({ title: 'Candidato removido' });
  }, [toast]);

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
