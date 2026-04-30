
-- =============================================
-- 1) hr_employees — Colaboradores (clone de hr_candidates)
-- =============================================
CREATE TABLE public.hr_employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_candidate_id UUID REFERENCES public.hr_candidates(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  age INT,
  cpf TEXT,
  photo_url TEXT,
  resume_url TEXT,
  type TEXT NOT NULL DEFAULT 'clt',
  kanban_status TEXT NOT NULL DEFAULT 'send_docs',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employees REPLICA IDENTITY FULL;

CREATE POLICY "Privileged users can do everything on hr_employees"
  ON public.hr_employees FOR ALL TO authenticated
  USING (public.is_privileged());

CREATE TRIGGER update_hr_employees_updated_at
  BEFORE UPDATE ON public.hr_employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 2) hr_kanban_columns — Colunas editáveis do Kanban
-- =============================================
CREATE TABLE public.hr_kanban_columns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board TEXT NOT NULL CHECK (board IN ('candidates', 'employees')),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  color_hex TEXT NOT NULL DEFAULT '#6b7280',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (board, slug)
);

ALTER TABLE public.hr_kanban_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_kanban_columns REPLICA IDENTITY FULL;

-- Todos autenticados podem ler; apenas privileged podem modificar
CREATE POLICY "Authenticated can read hr_kanban_columns"
  ON public.hr_kanban_columns FOR SELECT TO authenticated USING (true);

CREATE POLICY "Privileged can modify hr_kanban_columns"
  ON public.hr_kanban_columns FOR ALL TO authenticated
  USING (public.is_privileged());

-- Seed: colunas de CANDIDATOS (11)
INSERT INTO public.hr_kanban_columns (board, slug, name, color_hex, sort_order) VALUES
  ('candidates', 'new_resume',       'Currículos novos',    '#3b82f6', 1),
  ('candidates', 'contacted',        'Contatados',          '#8b5cf6', 2),
  ('candidates', 'scheduled_e1',     'E1 agendada',         '#f59e0b', 3),
  ('candidates', 'done_e1',          'E1 realizada',        '#10b981', 4),
  ('candidates', 'scheduled_e2',     'E2 agendada',         '#f97316', 5),
  ('candidates', 'done_e2',          'E2 realizada',        '#06b6d4', 6),
  ('candidates', 'approved',         'Aprovados',           '#22c55e', 7),
  ('candidates', 'rejected',         'Reprovados',          '#ef4444', 8),
  ('candidates', 'doubt',            'Dúvida',              '#eab308', 9),
  ('candidates', 'became_partner',   'Virou parceiro',      '#a855f7', 10),
  ('candidates', 'migrated_partner', 'Migrados Parceiros',  '#64748b', 11);

-- Seed: colunas de COLABORADORES (14)
INSERT INTO public.hr_kanban_columns (board, slug, name, color_hex, sort_order) VALUES
  ('employees', 'send_docs',              'Mandar docs',                                     '#3b82f6', 1),
  ('employees', 'send_training',          'Mandar Treinamento',                              '#8b5cf6', 2),
  ('employees', 'do_exam',                'Fazer exame',                                     '#f59e0b', 3),
  ('employees', 'training_done',          'Conclusão Treinamento',                           '#10b981', 4),
  ('employees', 'day1_terms',             'Day 1: Termos',                                   '#06b6d4', 5),
  ('employees', 'day1_access',            'Day 1: Acessos (New Corban, LordChat, Lemit)',    '#a855f7', 6),
  ('employees', 'day1_clock',             'Day 1: Cadastrar Ponto',                          '#f97316', 7),
  ('employees', 'day1_benefits',          'Day 1: Pagar Vale Transporte e Alimentação',      '#ec4899', 8),
  ('employees', 'day1_upload_list',       'Day 1: Subir Lista',                              '#14b8a6', 9),
  ('employees', 'day1_training',          'Day 1: Treinamento',                              '#eab308', 10),
  ('employees', 'day1_ride',              'Day 1: Carona',                                   '#64748b', 11),
  ('employees', 'day1_alignment',         'Day 1: Alinhamento de expectativas',              '#0ea5e9', 12),
  ('employees', 'day2_practice',          'Day 2: Prática',                                  '#f43f5e', 13),
  ('employees', 'employee_effective',     'Colaborador Efetivado',                           '#22c55e', 14);

-- =============================================
-- 3) hr_access_credentials — Acessos (login/senha)
-- =============================================
CREATE TABLE public.hr_access_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('candidate', 'employee')),
  entity_id UUID NOT NULL,
  system_name TEXT NOT NULL,
  login TEXT NOT NULL DEFAULT '',
  password TEXT NOT NULL DEFAULT '',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hr_access_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Privileged users can do everything on hr_access_credentials"
  ON public.hr_access_credentials FOR ALL TO authenticated
  USING (public.is_privileged());

CREATE TRIGGER update_hr_access_credentials_updated_at
  BEFORE UPDATE ON public.hr_access_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 4) hr_calendar_events — adicionar entity_type e employee_id
-- =============================================
ALTER TABLE public.hr_calendar_events
  ADD COLUMN IF NOT EXISTS entity_type TEXT NOT NULL DEFAULT 'candidate',
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.hr_employees(id) ON DELETE SET NULL;
