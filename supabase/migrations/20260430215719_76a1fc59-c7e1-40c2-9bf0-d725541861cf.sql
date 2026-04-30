
ALTER TABLE public.chips
  ADD COLUMN IF NOT EXISTS quality_rating text,
  ADD COLUMN IF NOT EXISTS messaging_limit text,
  ADD COLUMN IF NOT EXISTS quality_updated_at timestamptz;
