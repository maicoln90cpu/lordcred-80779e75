
-- =============================================
-- SUPPORT TICKETS SYSTEM
-- =============================================

CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  assigned_to uuid,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'media',
  status text NOT NULL DEFAULT 'aberto',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- RLS: support_tickets
CREATE POLICY "Admins can manage all tickets" ON public.support_tickets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Support can manage all tickets" ON public.support_tickets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'support'::app_role))
  WITH CHECK (has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Users can manage all tickets" ON public.support_tickets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'user'::app_role))
  WITH CHECK (has_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Sellers can view own tickets" ON public.support_tickets FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Sellers can create tickets" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Sellers can update own tickets" ON public.support_tickets FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- RLS: ticket_messages
CREATE POLICY "Admins can manage ticket messages" ON public.ticket_messages FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Support can manage ticket messages" ON public.ticket_messages FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'support'::app_role))
  WITH CHECK (has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Users can manage ticket messages" ON public.ticket_messages FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'user'::app_role))
  WITH CHECK (has_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Ticket creator can view messages" ON public.ticket_messages FOR SELECT TO authenticated
  USING (ticket_id IN (SELECT id FROM public.support_tickets WHERE created_by = auth.uid()));

CREATE POLICY "Ticket creator can send messages" ON public.ticket_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND ticket_id IN (SELECT id FROM public.support_tickets WHERE created_by = auth.uid()));

-- =============================================
-- AUDIT LOGS
-- =============================================

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  action text NOT NULL,
  target_table text,
  target_id text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Support can view audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Users can view audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'user'::app_role));

CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- Allow service role inserts (for triggers)
CREATE POLICY "Service can insert audit logs" ON public.audit_logs FOR INSERT TO public
  WITH CHECK (true);

-- =============================================
-- AUDIT TRIGGERS
-- =============================================

-- Generic audit function
CREATE OR REPLACE FUNCTION public.audit_log_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _user_email text;
  _action text;
  _details jsonb;
  _target_id text;
BEGIN
  _user_id := auth.uid();
  
  SELECT email INTO _user_email FROM public.profiles WHERE user_id = _user_id LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    _action := TG_ARGV[0] || '_created';
    _target_id := NEW.id::text;
    _details := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    _action := TG_ARGV[0] || '_updated';
    _target_id := NEW.id::text;
    _details := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    _action := TG_ARGV[0] || '_deleted';
    _target_id := OLD.id::text;
    _details := to_jsonb(OLD);
  END IF;

  INSERT INTO public.audit_logs (user_id, user_email, action, target_table, target_id, details)
  VALUES (_user_id, _user_email, _action, TG_TABLE_NAME, _target_id, _details);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on profiles (user management)
CREATE TRIGGER audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger('profile');

-- Trigger on user_roles (role changes)
CREATE TRIGGER audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger('role');

-- Trigger on chips (chip management)
CREATE TRIGGER audit_chips
  AFTER INSERT OR DELETE ON public.chips
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger('chip');

-- Trigger on system_settings (config changes)
CREATE TRIGGER audit_system_settings
  AFTER UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger('settings');

-- Trigger on support_tickets
CREATE TRIGGER audit_support_tickets
  AFTER INSERT OR UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger('ticket');

-- Updated_at trigger for support_tickets
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Replica identity for realtime
ALTER TABLE public.support_tickets REPLICA IDENTITY FULL;
ALTER TABLE public.ticket_messages REPLICA IDENTITY FULL;
