
-- 1. Coluna nome interno para chips
ALTER TABLE public.chips ADD COLUMN IF NOT EXISTS internal_name text;

-- 2. RLS: vendedores veem conversas de chips compartilhados
CREATE POLICY "Shared users can view shared chip conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (chip_id IN (
    SELECT id FROM public.chips
    WHERE is_shared = true
    AND shared_user_ids::text[] @> ARRAY[auth.uid()::text]
  ));

CREATE POLICY "Shared users can manage shared chip conversations"
  ON public.conversations FOR UPDATE TO authenticated
  USING (chip_id IN (
    SELECT id FROM public.chips
    WHERE is_shared = true
    AND shared_user_ids::text[] @> ARRAY[auth.uid()::text]
  ))
  WITH CHECK (chip_id IN (
    SELECT id FROM public.chips
    WHERE is_shared = true
    AND shared_user_ids::text[] @> ARRAY[auth.uid()::text]
  ));

-- 3. RLS: vendedores veem e enviam mensagens em chips compartilhados
CREATE POLICY "Shared users can view shared chip messages"
  ON public.message_history FOR SELECT TO authenticated
  USING (chip_id IN (
    SELECT id FROM public.chips
    WHERE is_shared = true
    AND shared_user_ids::text[] @> ARRAY[auth.uid()::text]
  ));

CREATE POLICY "Shared users can insert shared chip messages"
  ON public.message_history FOR INSERT TO authenticated
  WITH CHECK (chip_id IN (
    SELECT id FROM public.chips
    WHERE is_shared = true
    AND shared_user_ids::text[] @> ARRAY[auth.uid()::text]
  ));
