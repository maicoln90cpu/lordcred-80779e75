
-- 1. Allow authenticated users (Administradores with role 'user') to UPDATE system_settings
CREATE POLICY "Authenticated users can update system settings"
ON public.system_settings
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- 2. Add lead_status_options JSONB column to system_settings
ALTER TABLE public.system_settings
ADD COLUMN IF NOT EXISTS lead_status_options jsonb
DEFAULT '[{"value":"pendente","label":"Pendente","color_class":"bg-muted text-muted-foreground hover:bg-muted/80"},{"value":"CHAMEI","label":"Chamei","color_class":"bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"},{"value":"NÃO ATENDEU","label":"Não Atendeu","color_class":"bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"},{"value":"NÃO EXISTE","label":"Não Existe","color_class":"bg-red-500/20 text-red-400 hover:bg-red-500/30"},{"value":"APROVADO","label":"Aprovado","color_class":"bg-green-500/20 text-green-400 hover:bg-green-500/30"}]'::jsonb;
