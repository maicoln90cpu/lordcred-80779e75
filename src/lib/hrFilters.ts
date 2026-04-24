import type { HRCandidate } from '@/hooks/useHRCandidates';
import type { CandidateInterviewSummary, HRInterviewMini } from '@/hooks/useHRInterviewsMap';
import type { AttendanceFilter, ResultFilter, HRFilters } from '@/components/hr/HRFiltersBar';

/** Normaliza string para busca acento-insensível. */
export function normalizeSearch(input: string): string {
  return (input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function matchAttendance(filter: AttendanceFilter, interview?: HRInterviewMini): boolean {
  if (filter === 'all') return true;
  if (filter === 'none') return !interview;
  if (!interview) return false;
  if (filter === 'yes') return interview.attended === true;
  if (filter === 'no') return interview.attended === false;
  return true;
}

function matchResult(filter: ResultFilter, interview?: HRInterviewMini): boolean {
  if (filter === 'all') return true;
  if (filter === 'none') return !interview;
  if (!interview) return false;
  const r = (interview.result || '').toLowerCase();
  switch (filter) {
    case 'approved': return r === 'approved' || r === 'aprovado';
    case 'rejected': return r === 'rejected' || r === 'reprovado';
    case 'doubt':    return r === 'doubt' || r === 'duvida' || r === 'dúvida';
    case 'pending':  return !r;
    default: return true;
  }
}

function matchAge(c: HRCandidate, filters: HRFilters): boolean {
  const min = filters.ageMin;
  const max = filters.ageMax;
  if (c.age === null || c.age === undefined) {
    // Sem idade: incluído apenas se ageUnknown=true
    return filters.ageUnknown;
  }
  if (min !== null && c.age < min) return false;
  if (max !== null && c.age > max) return false;
  return true;
}

export function filterCandidates(
  candidates: HRCandidate[],
  filters: HRFilters,
  interviewsMap: Map<string, CandidateInterviewSummary>,
  searchTerm: string,
): HRCandidate[] {
  const q = normalizeSearch(searchTerm.trim());

  return candidates.filter(c => {
    // Busca textual (acento-insensível em nome; inclusão direta em fone/cpf)
    if (q) {
      const nameMatch = normalizeSearch(c.full_name).includes(q);
      const phoneMatch = (c.phone || '').toLowerCase().includes(q);
      const cpfMatch = (c.cpf || '').toLowerCase().includes(q);
      if (!nameMatch && !phoneMatch && !cpfMatch) return false;
    }

    if (!matchAge(c, filters)) return false;

    const summary = interviewsMap.get(c.id) ?? {};
    if (!matchAttendance(filters.e1Attendance, summary.e1)) return false;
    if (!matchResult(filters.e1Result, summary.e1)) return false;
    if (!matchAttendance(filters.e2Attendance, summary.e2)) return false;
    if (!matchResult(filters.e2Result, summary.e2)) return false;

    return true;
  });
}
