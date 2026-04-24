import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface HRInterviewMini {
  id: string;
  candidate_id: string;
  stage: 1 | 2;
  attended: boolean | null;
  result: string | null;
  scheduled_at: string | null;
}

export interface CandidateInterviewSummary {
  e1?: HRInterviewMini;
  e2?: HRInterviewMini;
}

/**
 * Carrega TODAS as entrevistas (campos mínimos) e indexa por candidate_id.
 * Usado pelos filtros avançados da aba Candidatos.
 * Mantém-se sincronizado via realtime sem refetch global.
 */
export function useHRInterviewsMap() {
  const [map, setMap] = useState<Map<string, CandidateInterviewSummary>>(new Map());
  const [loading, setLoading] = useState(true);

  const indexRows = useCallback((rows: HRInterviewMini[]) => {
    const next = new Map<string, CandidateInterviewSummary>();
    rows.forEach(r => {
      const cur = next.get(r.candidate_id) ?? {};
      if (r.stage === 1) cur.e1 = r;
      else if (r.stage === 2) cur.e2 = r;
      next.set(r.candidate_id, cur);
    });
    return next;
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('hr_interviews')
        .select('id, candidate_id, stage, attended, result, scheduled_at');
      if (error) throw error;
      setMap(indexRows((data || []) as HRInterviewMini[]));
    } catch (err) {
      console.error('useHRInterviewsMap fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [indexRows]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // === Realtime ===
  useEffect(() => {
    const upsertOne = (row: HRInterviewMini) => {
      setMap(prev => {
        const next = new Map(prev);
        const cur = next.get(row.candidate_id) ?? {};
        if (row.stage === 1) cur.e1 = row;
        else if (row.stage === 2) cur.e2 = row;
        next.set(row.candidate_id, { ...cur });
        return next;
      });
    };

    const removeOne = (row: Partial<HRInterviewMini>) => {
      if (!row.candidate_id || !row.stage) return;
      setMap(prev => {
        const next = new Map(prev);
        const cur = { ...(next.get(row.candidate_id!) ?? {}) };
        if (row.stage === 1) delete cur.e1;
        else if (row.stage === 2) delete cur.e2;
        if (!cur.e1 && !cur.e2) next.delete(row.candidate_id!);
        else next.set(row.candidate_id!, cur);
        return next;
      });
    };

    const channel = supabase
      .channel(`hr_interviews_map_${Math.random().toString(36).slice(2, 9)}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'hr_interviews' },
        (p: RealtimePostgresChangesPayload<HRInterviewMini>) => upsertOne(p.new as HRInterviewMini))
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'hr_interviews' },
        (p: RealtimePostgresChangesPayload<HRInterviewMini>) => upsertOne(p.new as HRInterviewMini))
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'hr_interviews' },
        (p: RealtimePostgresChangesPayload<HRInterviewMini>) => removeOne(p.old as Partial<HRInterviewMini>))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { map, loading, refetch: fetchAll };
}
