
-- Add max_chips column to profiles (default 5)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_chips integer NOT NULL DEFAULT 5;

-- Add RLS policy for sellers to manage their own templates
CREATE POLICY "Sellers can manage own templates"
ON public.message_templates
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'seller'::app_role) AND created_by = auth.uid())
WITH CHECK (has_role(auth.uid(), 'seller'::app_role) AND created_by = auth.uid());
