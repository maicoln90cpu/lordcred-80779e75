-- Allow all authenticated users to READ system_settings (needed for dashboard display)
CREATE POLICY "Authenticated users can read system settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (true);
