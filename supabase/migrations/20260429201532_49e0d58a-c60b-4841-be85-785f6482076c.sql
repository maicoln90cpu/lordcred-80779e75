ALTER TABLE public.v8_batches ADD COLUMN IF NOT EXISTS is_paused BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.v8_batches ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;
ALTER TABLE public.v8_batches ADD COLUMN IF NOT EXISTS paused_by UUID;
CREATE INDEX IF NOT EXISTS idx_v8_batches_is_paused ON public.v8_batches(is_paused) WHERE is_paused = true;