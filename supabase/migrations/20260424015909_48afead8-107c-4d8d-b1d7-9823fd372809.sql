
-- ============================================================
-- MÓDULO DE RH — ETAPA 1: BANCO DE DADOS
-- ============================================================

-- ----- TABELA 1: hr_candidates -----
CREATE TABLE public.hr_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text NOT NULL,
  age integer,
  cpf text,
  photo_url text,
  resume_url text,
  type text NOT NULL DEFAULT 'clt' CHECK (type IN ('clt','partner')),
  kanban_status text NOT NULL DEFAULT 'new_resume'
    CHECK (kanban_status IN ('new_resume','contacted','scheduled_e1','done_e1','scheduled_e2','done_e2','approved','rejected','doubt','became_partner')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_candidates_status ON public.hr_candidates(kanban_status);
ALTER TABLE public.hr_candidates ENABLE ROW LEVEL SECURITY;

-- ----- TABELA 2: hr_questions -----
CREATE TABLE public.hr_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage integer NOT NULL CHECK (stage IN (1,2)),
  order_num integer NOT NULL,
  text text NOT NULL,
  UNIQUE (stage, order_num)
);
ALTER TABLE public.hr_questions ENABLE ROW LEVEL SECURITY;

-- ----- TABELA 3: hr_interviews -----
CREATE TABLE public.hr_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.hr_candidates(id) ON DELETE CASCADE,
  stage integer NOT NULL CHECK (stage IN (1,2)),
  interviewer_id uuid REFERENCES auth.users(id),
  scheduled_at timestamptz,
  attended boolean,
  result text CHECK (result IN ('approved','rejected','doubt','next_stage','became_partner')),
  score_tecnica integer CHECK (score_tecnica BETWEEN 0 AND 10),
  score_cultura integer CHECK (score_cultura BETWEEN 0 AND 10),
  score_energia integer CHECK (score_energia BETWEEN 0 AND 10),
  observations text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_interviews_candidate ON public.hr_interviews(candidate_id);
ALTER TABLE public.hr_interviews ENABLE ROW LEVEL SECURITY;

-- ----- TABELA 4: hr_interview_answers -----
CREATE TABLE public.hr_interview_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.hr_interviews(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.hr_questions(id),
  answer text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_answers_interview ON public.hr_interview_answers(interview_id);
ALTER TABLE public.hr_interview_answers ENABLE ROW LEVEL SECURITY;

-- ----- TABELA 5: hr_partner_leads -----
CREATE TABLE public.hr_partner_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text NOT NULL,
  age integer,
  cpf text,
  interview_date date,
  observations text,
  meeting_status text DEFAULT 'called' CHECK (meeting_status IN ('called','include_next','scheduled')),
  meeting_date date,
  sent_link boolean DEFAULT false,
  accepted boolean DEFAULT false,
  mei_informed boolean DEFAULT false,
  mei_created text,
  acquisition_source text DEFAULT 'interview' CHECK (acquisition_source IN ('interview','referral')),
  referred_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hr_partner_leads ENABLE ROW LEVEL SECURITY;

-- ----- TABELA 6: hr_notifications -----
CREATE TABLE public.hr_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('interview','meeting')),
  entity_id uuid NOT NULL,
  recipient_type text NOT NULL CHECK (recipient_type IN ('candidate','interviewer','both')),
  phone_candidate text,
  phone_interviewer text,
  chip_instance_id uuid REFERENCES public.chips(id) ON DELETE SET NULL,
  message_template text NOT NULL CHECK (message_template IN ('template_1','template_2')),
  send_at timestamptz NOT NULL,
  offset_minutes integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hr_notif_pending ON public.hr_notifications(status, send_at) WHERE status = 'pending';
ALTER TABLE public.hr_notifications ENABLE ROW LEVEL SECURITY;

-- ----- TABELA 7: hr_notification_settings -----
CREATE TABLE public.hr_notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offset_1_minutes integer NOT NULL DEFAULT 1440,
  offset_2_minutes integer NOT NULL DEFAULT 30,
  template_1_text text NOT NULL DEFAULT 'Olá {name}! Lembrando que sua entrevista está agendada para {date} às {time}. Até lá!',
  template_2_text text NOT NULL DEFAULT 'Olá {name}! Sua entrevista começa em 30 minutos ({time}). Estaremos te aguardando!',
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hr_notification_settings ENABLE ROW LEVEL SECURITY;

-- Garantir 1 registro de configuração padrão
INSERT INTO public.hr_notification_settings DEFAULT VALUES;

-- ============================================================
-- RLS POLICIES
-- ============================================================
-- Padrão: Admin/Manager (is_privileged) podem SELECT/INSERT/UPDATE
-- DELETE: apenas Admin

CREATE POLICY "hr_candidates_privileged_rw" ON public.hr_candidates
  FOR ALL TO authenticated
  USING (public.is_privileged(auth.uid()))
  WITH CHECK (public.is_privileged(auth.uid()));
CREATE POLICY "hr_candidates_admin_delete" ON public.hr_candidates
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'));

CREATE POLICY "hr_questions_privileged_read" ON public.hr_questions
  FOR SELECT TO authenticated
  USING (public.is_privileged(auth.uid()));
CREATE POLICY "hr_questions_admin_write" ON public.hr_questions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'));

CREATE POLICY "hr_interviews_privileged_rw" ON public.hr_interviews
  FOR ALL TO authenticated
  USING (public.is_privileged(auth.uid()))
  WITH CHECK (public.is_privileged(auth.uid()));

CREATE POLICY "hr_answers_privileged_rw" ON public.hr_interview_answers
  FOR ALL TO authenticated
  USING (public.is_privileged(auth.uid()))
  WITH CHECK (public.is_privileged(auth.uid()));

CREATE POLICY "hr_partner_leads_privileged_rw" ON public.hr_partner_leads
  FOR ALL TO authenticated
  USING (public.is_privileged(auth.uid()))
  WITH CHECK (public.is_privileged(auth.uid()));
CREATE POLICY "hr_partner_leads_admin_delete" ON public.hr_partner_leads
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'));

CREATE POLICY "hr_notifications_privileged_rw" ON public.hr_notifications
  FOR ALL TO authenticated
  USING (public.is_privileged(auth.uid()))
  WITH CHECK (public.is_privileged(auth.uid()));

CREATE POLICY "hr_notif_settings_privileged_read" ON public.hr_notification_settings
  FOR SELECT TO authenticated
  USING (public.is_privileged(auth.uid()));
CREATE POLICY "hr_notif_settings_admin_update" ON public.hr_notification_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'));

-- ============================================================
-- TRIGGERS DE UPDATED_AT
-- ============================================================
CREATE TRIGGER trg_hr_candidates_updated BEFORE UPDATE ON public.hr_candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hr_interviews_updated BEFORE UPDATE ON public.hr_interviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hr_partner_leads_updated BEFORE UPDATE ON public.hr_partner_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hr_notif_settings_updated BEFORE UPDATE ON public.hr_notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- SEED — 35 PERGUNTAS FIXAS
-- ============================================================
INSERT INTO public.hr_questions (stage, order_num, text) VALUES
-- ENTREVISTA 1 (15 perguntas)
(1, 1, 'Me conta um pouco sobre você e sua trajetória até aqui.'),
(1, 2, 'Você mora sozinho(a) ou com família?'),
(1, 3, 'Hoje você está estudando ou se desenvolvendo em alguma área? Se sim, como isso se encaixa na sua rotina de trabalho?'),
(1, 4, 'Quais são seus valores inegociáveis?'),
(1, 5, 'O que dá sentido à sua vida hoje?'),
(1, 6, 'O que sustenta você nos momentos difíceis?'),
(1, 7, 'Na sua opinião, o que é mais importante para alguém crescer: esforço próprio ou ajuda externa?'),
(1, 8, 'O que é sucesso pra você?'),
(1, 9, 'Você prefere estabilidade ou ganhar mais conforme seu resultado? Por quê?'),
(1, 10, 'Qual seu salário dos sonhos? Qual o maior salário que já recebeu?'),
(1, 11, 'Como você lida com regras ou metas que não concorda totalmente?'),
(1, 12, 'O que faria você não dar certo nessa vaga?'),
(1, 13, 'Qual o seu diferencial para a equipe?'),
(1, 14, 'Por que eu deveria confiar metas e responsabilidades a você?'),
(1, 15, 'Teria disponibilidade de começar quando?'),
-- ENTREVISTA 2 (20 perguntas)
(2, 1, 'O que mais ficou marcado pra você da nossa primeira conversa?'),
(2, 2, 'O que você gosta de fazer, qual o seu hobbie?'),
(2, 3, 'Quando ninguém está olhando, o que guia suas decisões?'),
(2, 4, 'O que você jamais faria por dinheiro?'),
(2, 5, 'Existe alguma crença ou princípio que você considera essencial para sua vida?'),
(2, 6, 'A espiritualidade tem algum papel importante na sua vida? Como?'),
(2, 7, 'Me descreve como você reage quando percebe que não vai bater a meta.'),
(2, 8, 'Prefere assumir o erro ou justificar? Me dá um exemplo.'),
(2, 9, 'O que você fez nos últimos 6 meses para evoluir como pessoa ou profissional?'),
(2, 10, 'Se você entrar na Lord Cred hoje, o que pretende construir aqui?'),
(2, 11, 'Que tipo de empresa você não consegue trabalhar?'),
(2, 12, 'Se hoje você fizesse parte do meu time, quais seriam as razões mais prováveis para eu te tirar da equipe?'),
(2, 13, 'Por que você acredita que merece essa vaga mais do que outros candidatos?'),
(2, 14, 'Se eu ligar para seu último líder ou empresa hoje, o que ele diria sobre você?'),
(2, 15, 'Tem algo que possa te atrapalhar aqui e que você ainda não falou?'),
(2, 16, 'Se tivesse apenas uma vaga, e você tem um melhor amigo que precisa tanto quanto você, você ficaria com ela ou passaria para ele?'),
(2, 17, 'Você tem disponibilidade para ficar até mais tarde quando necessário?'),
(2, 18, 'Prefere trabalhar em equipe ou individual?'),
(2, 19, 'Prefere liderar ou ser liderado?'),
(2, 20, 'Como foi sua última experiência profissional?');

-- ============================================================
-- REALTIME PUBLICATION
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_candidates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_partner_leads;
ALTER TABLE public.hr_candidates REPLICA IDENTITY FULL;
ALTER TABLE public.hr_partner_leads REPLICA IDENTITY FULL;

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('hr-photos', 'hr-photos', true, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
  ('hr-resumes', 'hr-resumes', false, 10485760, ARRAY['application/pdf']);

-- Policies para hr-photos (público leitura, upload privileged)
CREATE POLICY "hr_photos_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'hr-photos');
CREATE POLICY "hr_photos_privileged_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'hr-photos' AND public.is_privileged(auth.uid()));
CREATE POLICY "hr_photos_privileged_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'hr-photos' AND public.is_privileged(auth.uid()));
CREATE POLICY "hr_photos_privileged_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'hr-photos' AND public.is_privileged(auth.uid()));

-- Policies para hr-resumes (privado, todas operações privileged)
CREATE POLICY "hr_resumes_privileged_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'hr-resumes' AND public.is_privileged(auth.uid()));
CREATE POLICY "hr_resumes_privileged_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'hr-resumes' AND public.is_privileged(auth.uid()));
CREATE POLICY "hr_resumes_privileged_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'hr-resumes' AND public.is_privileged(auth.uid()));
CREATE POLICY "hr_resumes_privileged_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'hr-resumes' AND public.is_privileged(auth.uid()));
