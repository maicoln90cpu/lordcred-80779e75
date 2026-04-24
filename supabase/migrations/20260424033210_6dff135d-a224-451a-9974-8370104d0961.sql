-- B.1/B.2: Prevenção de duplicatas + normalização de telefone
-- Coluna virtual normalizada (apenas dígitos) para HR candidates
ALTER TABLE public.hr_candidates
  ADD COLUMN IF NOT EXISTS phone_normalized text
  GENERATED ALWAYS AS (regexp_replace(COALESCE(phone, ''), '\D', '', 'g')) STORED;

-- Índice único parcial: ignora telefones placeholder (00000000000) e vazios
CREATE UNIQUE INDEX IF NOT EXISTS hr_candidates_phone_unique
  ON public.hr_candidates (phone_normalized)
  WHERE phone_normalized <> '' AND phone_normalized <> '00000000000';

-- Mesmo para hr_partner_leads
ALTER TABLE public.hr_partner_leads
  ADD COLUMN IF NOT EXISTS phone_normalized text
  GENERATED ALWAYS AS (regexp_replace(COALESCE(phone, ''), '\D', '', 'g')) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS hr_partner_leads_phone_unique
  ON public.hr_partner_leads (phone_normalized)
  WHERE phone_normalized <> '' AND phone_normalized <> '00000000000';

-- B.5: Índices para otimização de busca
CREATE INDEX IF NOT EXISTS hr_candidates_full_name_trgm
  ON public.hr_candidates USING gin (lower(full_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS hr_candidates_kanban_status_idx
  ON public.hr_candidates (kanban_status);

CREATE INDEX IF NOT EXISTS hr_partner_leads_full_name_trgm
  ON public.hr_partner_leads USING gin (lower(full_name) gin_trgm_ops);
