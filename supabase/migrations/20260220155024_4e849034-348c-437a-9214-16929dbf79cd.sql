
-- external_numbers: drop permissive policies and replace with admin-only
DROP POLICY IF EXISTS "Authenticated users can delete external numbers" ON public.external_numbers;
DROP POLICY IF EXISTS "Authenticated users can insert external numbers" ON public.external_numbers;
DROP POLICY IF EXISTS "Authenticated users can read external numbers" ON public.external_numbers;
DROP POLICY IF EXISTS "Authenticated users can update external numbers" ON public.external_numbers;

CREATE POLICY "Admins can read external numbers" ON public.external_numbers FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert external numbers" ON public.external_numbers FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update external numbers" ON public.external_numbers FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete external numbers" ON public.external_numbers FOR DELETE USING (public.is_admin());

-- warming_messages: drop permissive policies
DROP POLICY IF EXISTS "Authenticated users can delete warming messages" ON public.warming_messages;
DROP POLICY IF EXISTS "Authenticated users can insert warming messages" ON public.warming_messages;
DROP POLICY IF EXISTS "Authenticated users can read warming messages" ON public.warming_messages;

CREATE POLICY "Admins can read warming messages" ON public.warming_messages FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert warming messages" ON public.warming_messages FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete warming messages" ON public.warming_messages FOR DELETE USING (public.is_admin());

-- system_settings: drop permissive policies
DROP POLICY IF EXISTS "Authenticated users can read system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Authenticated users can update system settings" ON public.system_settings;

CREATE POLICY "Admins can read system settings" ON public.system_settings FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can update system settings" ON public.system_settings FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
