-- ETAPA 1b: Migrar dados e atualizar policies/funções

-- 1. Migrar dados: admin → master
UPDATE public.user_roles SET role = 'master' WHERE role = 'admin';

-- 2. Migrar dados: user → admin
UPDATE public.user_roles SET role = 'admin' WHERE role = 'user';

-- 3. Default para novos usuários = seller
ALTER TABLE public.user_roles ALTER COLUMN role SET DEFAULT 'seller'::app_role;

-- 4. is_admin() → verifica 'master'
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'master')
$$;

-- 5. promote_master_user() → seta 'master'
CREATE OR REPLACE FUNCTION public.promote_master_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF NEW.email = 'maicoln90@hotmail.com' THEN
        UPDATE public.user_roles SET role = 'master' WHERE user_id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$;

-- 6. handle_new_user() → default 'seller'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  old_user_id uuid;
BEGIN
    SELECT user_id INTO old_user_id FROM public.profiles WHERE email = NEW.email LIMIT 1;
    IF old_user_id IS NOT NULL AND old_user_id != NEW.id THEN
        UPDATE public.profiles SET user_id = NEW.id WHERE user_id = old_user_id;
        UPDATE public.user_roles SET user_id = NEW.id WHERE user_id = old_user_id;
        UPDATE public.chips SET user_id = NEW.id WHERE user_id = old_user_id;
    ELSIF old_user_id IS NULL THEN
        INSERT INTO public.profiles (user_id, email) VALUES (NEW.id, NEW.email);
        INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'seller');
    END IF;
    RETURN NEW;
END;
$$;

-- 7. RLS POLICIES

-- audit_logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Masters can view audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'master'::app_role));
DROP POLICY IF EXISTS "Users can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- conversations
DROP POLICY IF EXISTS "User role can view all conversations" ON public.conversations;
CREATE POLICY "Admin role can view all conversations" ON public.conversations
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- internal_channels
DROP POLICY IF EXISTS "Admins can manage channels" ON public.internal_channels;
CREATE POLICY "Masters and admins can manage channels" ON public.internal_channels
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- internal_channel_members
DROP POLICY IF EXISTS "Admins can manage channel members" ON public.internal_channel_members;
CREATE POLICY "Masters and admins can manage channel members" ON public.internal_channel_members
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- internal_messages
DROP POLICY IF EXISTS "Admins can manage messages" ON public.internal_messages;
CREATE POLICY "Masters and admins can manage messages" ON public.internal_messages
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- kanban_columns
DROP POLICY IF EXISTS "User role can manage kanban columns" ON public.kanban_columns;
CREATE POLICY "Admin role can manage kanban columns" ON public.kanban_columns
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- message_shortcuts
DROP POLICY IF EXISTS "Admins can manage all shortcuts" ON public.message_shortcuts;
CREATE POLICY "Masters can manage all shortcuts" ON public.message_shortcuts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));
DROP POLICY IF EXISTS "User role can manage all shortcuts" ON public.message_shortcuts;
CREATE POLICY "Admin role can manage all shortcuts" ON public.message_shortcuts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- message_templates
DROP POLICY IF EXISTS "Admins can manage templates" ON public.message_templates;
CREATE POLICY "Masters can manage templates" ON public.message_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));
DROP POLICY IF EXISTS "Users can manage templates" ON public.message_templates;
CREATE POLICY "Admins can manage templates" ON public.message_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- support_tickets
DROP POLICY IF EXISTS "Admins can manage all tickets" ON public.support_tickets;
CREATE POLICY "Masters can manage all tickets" ON public.support_tickets
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));
DROP POLICY IF EXISTS "Users can manage all tickets" ON public.support_tickets;
CREATE POLICY "Admins can manage all tickets" ON public.support_tickets
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ticket_messages
DROP POLICY IF EXISTS "Admins can manage ticket messages" ON public.ticket_messages;
CREATE POLICY "Masters can manage ticket messages" ON public.ticket_messages
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));
DROP POLICY IF EXISTS "Users can manage ticket messages" ON public.ticket_messages;
CREATE POLICY "Admins can manage ticket messages" ON public.ticket_messages
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- useful_links
DROP POLICY IF EXISTS "Admins can manage useful links" ON public.useful_links;
CREATE POLICY "Masters and admins can manage useful links" ON public.useful_links
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- message_history
DROP POLICY IF EXISTS "User role can view all messages" ON public.message_history;
CREATE POLICY "Admin role can view all messages" ON public.message_history
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 8. Fix null statuses in leads
UPDATE client_leads SET status = 'pendente' WHERE status IS NULL;

-- 9. RPC get_internal_chat_profiles_v2
CREATE OR REPLACE FUNCTION public.get_internal_chat_profiles_v2()
RETURNS TABLE(user_id uuid, email text, name text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT p.user_id, p.email, p.name, p.avatar_url
  FROM profiles p
  INNER JOIN internal_channel_members icm ON icm.user_id = p.user_id
  INNER JOIN internal_channel_members my_channels ON my_channels.channel_id = icm.channel_id
  WHERE my_channels.user_id = auth.uid()
$$;