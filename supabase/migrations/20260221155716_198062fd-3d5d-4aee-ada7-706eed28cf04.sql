
-- 1. Criar tabela labels
CREATE TABLE IF NOT EXISTS public.labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chip_id uuid NOT NULL,
  label_id text NOT NULL,
  name text NOT NULL DEFAULT '',
  color_hex text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(chip_id, label_id)
);

ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their chip labels"
  ON public.labels FOR SELECT
  USING (chip_id IN (SELECT id FROM chips WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their chip labels"
  ON public.labels FOR ALL
  USING (chip_id IN (SELECT id FROM chips WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all labels"
  ON public.labels FOR ALL
  USING (is_admin());

-- 2. Adicionar colunas faltantes em conversations
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS label_ids text[] DEFAULT '{}';
