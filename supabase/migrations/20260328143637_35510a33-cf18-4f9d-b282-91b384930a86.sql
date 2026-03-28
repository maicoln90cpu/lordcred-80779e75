-- Add visible_to_list to message_shortcuts for admin visibility rules (like templates)
ALTER TABLE public.message_shortcuts 
ADD COLUMN IF NOT EXISTS visible_to_list uuid[] DEFAULT '{}'::uuid[];

-- Allow all authenticated users to read shortcuts (visibility filtered in frontend, like templates)
CREATE POLICY "Authenticated can read active shortcuts" 
ON public.message_shortcuts 
FOR SELECT TO authenticated 
USING (is_active = true);