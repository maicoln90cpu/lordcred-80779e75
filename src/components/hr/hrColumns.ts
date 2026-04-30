import type { HRKanbanStatus } from '@/hooks/useHRCandidates';

export interface HRColumnDef {
  id: HRKanbanStatus;
  name: string;
  /** CSS variable token name (without `var()`). Always wrap with `hsl(var(--…))`. */
  token: string;
}

/**
 * Definição central das colunas do Kanban de RH.
 * Cores SEMPRE via tokens HSL semânticos (definidos em src/index.css).
 * Para usar a cor em estilos inline:  `hsl(var(--hr-new))`
 */
export const HR_COLUMNS: HRColumnDef[] = [
  { id: 'new_resume',     name: 'Currículos novos', token: '--hr-new' },
  { id: 'contacted',      name: 'Contatados',       token: '--hr-contacted' },
  { id: 'scheduled_e1',   name: 'E1 agendada',      token: '--hr-scheduled-e1' },
  { id: 'done_e1',        name: 'E1 realizada',     token: '--hr-done-e1' },
  { id: 'scheduled_e2',   name: 'E2 agendada',      token: '--hr-scheduled-e2' },
  { id: 'done_e2',        name: 'E2 realizada',     token: '--hr-done-e2' },
  { id: 'approved',       name: 'Aprovados',        token: '--hr-approved' },
  { id: 'rejected',       name: 'Reprovados',       token: '--hr-rejected' },
  { id: 'doubt',             name: 'Dúvida',              token: '--hr-doubt' },
  { id: 'became_partner',    name: 'Virou parceiro',      token: '--hr-partner' },
  { id: 'migrated_partner',  name: 'Migrados Parceiros',  token: '--hr-migrated-partner' },
];

/** Helper: retorna a string CSS pronta para uso em `style={{ backgroundColor: hrColor(token) }}` */
export const hrColor = (token: string, alpha?: number) =>
  alpha !== undefined ? `hsl(var(${token}) / ${alpha})` : `hsl(var(${token}))`;
