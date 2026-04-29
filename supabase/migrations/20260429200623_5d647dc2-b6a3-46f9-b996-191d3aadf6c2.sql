ALTER TABLE public.v8_simulations
ADD COLUMN IF NOT EXISTS paste_order INTEGER;

CREATE INDEX IF NOT EXISTS idx_v8_simulations_batch_paste_order
ON public.v8_simulations (batch_id, paste_order);