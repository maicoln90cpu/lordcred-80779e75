
-- 1. Add unique constraint on meta_message_templates for upsert to work
ALTER TABLE public.meta_message_templates
  ADD CONSTRAINT meta_message_templates_waba_name_lang_unique 
  UNIQUE (waba_id, template_name, language);

-- 2. Add SELECT policy for authenticated users to read templates
CREATE POLICY "Authenticated users can read meta templates"
  ON public.meta_message_templates
  FOR SELECT
  TO authenticated
  USING (true);

-- 3. Add SELECT policy for shared chips (sellers authorized via shared_user_ids)
CREATE POLICY "Users can view shared chips they are authorized for"
  ON public.chips
  FOR SELECT
  TO authenticated
  USING (
    is_shared = true 
    AND shared_user_ids::text[] @> ARRAY[auth.uid()::text]
  );
