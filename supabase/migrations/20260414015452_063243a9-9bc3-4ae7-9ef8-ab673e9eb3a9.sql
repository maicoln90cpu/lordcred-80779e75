
-- =============================================
-- ETAPA 1: Meta WhatsApp + Fila + Auditoria
-- =============================================

-- 1. Novas colunas na tabela chips
ALTER TABLE public.chips
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'uazapi',
  ADD COLUMN IF NOT EXISTS meta_phone_number_id text,
  ADD COLUMN IF NOT EXISTS meta_waba_id text;

-- 2. Novas colunas na tabela system_settings
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS meta_app_id text,
  ADD COLUMN IF NOT EXISTS meta_app_secret text,
  ADD COLUMN IF NOT EXISTS meta_access_token text,
  ADD COLUMN IF NOT EXISTS meta_verify_token text,
  ADD COLUMN IF NOT EXISTS meta_webhook_secret text,
  ADD COLUMN IF NOT EXISTS meta_allowed_user_ids uuid[] NOT NULL DEFAULT '{}';

-- 3. Tabela meta_message_templates
CREATE TABLE IF NOT EXISTS public.meta_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waba_id text NOT NULL,
  template_name text NOT NULL,
  language text NOT NULL DEFAULT 'pt_BR',
  category text NOT NULL DEFAULT 'UTILITY',
  status text NOT NULL DEFAULT 'PENDING',
  components jsonb NOT NULL DEFAULT '[]'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Privileged users can manage meta templates"
  ON public.meta_message_templates FOR ALL
  USING (public.is_privileged(auth.uid()));

CREATE INDEX idx_meta_templates_waba ON public.meta_message_templates (waba_id);
CREATE INDEX idx_meta_templates_status ON public.meta_message_templates (status);

-- 4. Tabela whatsapp_cost_log
CREATE TABLE IF NOT EXISTS public.whatsapp_cost_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chip_id uuid REFERENCES public.chips(id) ON DELETE CASCADE NOT NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  direction text NOT NULL DEFAULT 'outgoing',
  category text NOT NULL DEFAULT 'service',
  cost_estimate numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_cost_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Privileged users can view cost logs"
  ON public.whatsapp_cost_log FOR SELECT
  USING (public.is_privileged(auth.uid()));

CREATE POLICY "System can insert cost logs"
  ON public.whatsapp_cost_log FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_cost_log_chip ON public.whatsapp_cost_log (chip_id);
CREATE INDEX idx_cost_log_created ON public.whatsapp_cost_log (created_at);
CREATE INDEX idx_cost_log_category ON public.whatsapp_cost_log (category);

-- 5. Tabela shared_queue_config
CREATE TABLE IF NOT EXISTS public.shared_queue_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chip_id uuid REFERENCES public.chips(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  max_wait_minutes integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_queue_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Privileged users can manage queues"
  ON public.shared_queue_config FOR ALL
  USING (public.is_privileged(auth.uid()));

CREATE POLICY "Authenticated users can view active queues"
  ON public.shared_queue_config FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

-- 6. Tabela shared_queue_agents
CREATE TABLE IF NOT EXISTS public.shared_queue_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid REFERENCES public.shared_queue_config(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  max_concurrent integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (queue_id, user_id)
);

ALTER TABLE public.shared_queue_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Privileged users can manage agents"
  ON public.shared_queue_agents FOR ALL
  USING (public.is_privileged(auth.uid()));

CREATE POLICY "Agents can view own membership"
  ON public.shared_queue_agents FOR SELECT
  USING (auth.uid() = user_id);

-- 7. Tabela shared_queue_assignments
CREATE TABLE IF NOT EXISTS public.shared_queue_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid REFERENCES public.shared_queue_config(id) ON DELETE CASCADE NOT NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  assigned_to uuid,
  assigned_at timestamptz,
  released_at timestamptz,
  status text NOT NULL DEFAULT 'waiting',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_queue_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Privileged users can manage assignments"
  ON public.shared_queue_assignments FOR ALL
  USING (public.is_privileged(auth.uid()));

CREATE POLICY "Agents can view own assignments"
  ON public.shared_queue_assignments FOR SELECT
  USING (auth.uid() = assigned_to);

CREATE POLICY "Agents can update own assignments"
  ON public.shared_queue_assignments FOR UPDATE
  USING (auth.uid() = assigned_to);

CREATE POLICY "Authenticated can view waiting assignments"
  ON public.shared_queue_assignments FOR SELECT
  USING (auth.uid() IS NOT NULL AND status = 'waiting');

CREATE INDEX idx_queue_assignments_queue ON public.shared_queue_assignments (queue_id);
CREATE INDEX idx_queue_assignments_agent ON public.shared_queue_assignments (assigned_to);
CREATE INDEX idx_queue_assignments_status ON public.shared_queue_assignments (status);

-- 8. Tabela conversation_audit_log
CREATE TABLE IF NOT EXISTS public.conversation_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  message_preview text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conversation_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Privileged users can view audit logs"
  ON public.conversation_audit_log FOR SELECT
  USING (public.is_privileged(auth.uid()));

CREATE POLICY "Authenticated users can insert audit entries"
  ON public.conversation_audit_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX idx_conv_audit_conversation ON public.conversation_audit_log (conversation_id);
CREATE INDEX idx_conv_audit_user ON public.conversation_audit_log (user_id);
CREATE INDEX idx_conv_audit_created ON public.conversation_audit_log (created_at);
CREATE INDEX idx_conv_audit_action ON public.conversation_audit_log (action);

-- 9. Triggers de updated_at
CREATE TRIGGER update_meta_templates_updated_at
  BEFORE UPDATE ON public.meta_message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shared_queue_config_updated_at
  BEFORE UPDATE ON public.shared_queue_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shared_queue_assignments_updated_at
  BEFORE UPDATE ON public.shared_queue_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
