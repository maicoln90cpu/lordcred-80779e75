ALTER TABLE public.v8_batches ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;
ALTER TABLE public.v8_batches ADD COLUMN IF NOT EXISTS scheduled_strategy TEXT;
ALTER TABLE public.v8_batches ADD COLUMN IF NOT EXISTS scheduled_payload JSONB;
CREATE INDEX IF NOT EXISTS idx_v8_batches_scheduled_ready
  ON public.v8_batches(scheduled_for)
  WHERE status = 'scheduled' AND is_paused = false;