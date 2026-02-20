-- Fix RLS policy for system_settings to allow UPDATE operations
DROP POLICY IF EXISTS "Admins can manage system settings" ON system_settings;

CREATE POLICY "Admins can manage system settings"
ON system_settings
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Add timezone column with São Paulo as default
ALTER TABLE system_settings 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Sao_Paulo';