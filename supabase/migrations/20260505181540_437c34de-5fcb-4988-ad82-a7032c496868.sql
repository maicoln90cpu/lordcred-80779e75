ALTER TABLE public.v8_settings
  ADD COLUMN IF NOT EXISTS cpf_dedupe_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cpf_dedupe_window_days integer NOT NULL DEFAULT 7;