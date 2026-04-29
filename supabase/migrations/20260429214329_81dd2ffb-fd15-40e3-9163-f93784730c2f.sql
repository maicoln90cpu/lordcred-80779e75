ALTER TABLE public.v8_settings
  ADD COLUMN IF NOT EXISTS max_retries_consult INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS max_retries_authorize INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS max_retries_simulate INTEGER NOT NULL DEFAULT 15;

ALTER TABLE public.v8_settings
  DROP CONSTRAINT IF EXISTS v8_settings_max_retries_check;

ALTER TABLE public.v8_settings
  ADD CONSTRAINT v8_settings_max_retries_check
  CHECK (
    max_retries_consult BETWEEN 1 AND 30
    AND max_retries_authorize BETWEEN 1 AND 30
    AND max_retries_simulate BETWEEN 1 AND 30
  );