ALTER TABLE public.v8_simulations
ADD COLUMN IF NOT EXISTS error_kind text;

CREATE INDEX IF NOT EXISTS idx_v8_simulations_status_error_kind
  ON public.v8_simulations (status, error_kind);

UPDATE public.v8_simulations
SET error_kind = raw_response->>'kind'
WHERE error_kind IS NULL
  AND raw_response->>'kind' IS NOT NULL
  AND status IN ('failed','pending');