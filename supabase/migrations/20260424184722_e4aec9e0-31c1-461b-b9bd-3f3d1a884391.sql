ALTER TABLE public.v8_simulations
ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_attempt_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_step text;

UPDATE public.v8_simulations
SET attempt_count = COALESCE(attempt_count, 0)
WHERE attempt_count IS NULL;

CREATE INDEX IF NOT EXISTS idx_v8_simulations_last_attempt_at
ON public.v8_simulations (last_attempt_at DESC);