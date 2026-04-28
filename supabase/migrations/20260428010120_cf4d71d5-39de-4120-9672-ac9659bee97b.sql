ALTER TABLE public.v8_simulations
  ADD COLUMN IF NOT EXISTS v8_status_snapshot_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_v8_simulations_active_consult_snapshot
  ON public.v8_simulations (error_kind, v8_status_snapshot_at)
  WHERE error_kind = 'active_consult';