ALTER TABLE public.v8_settings
  ADD COLUMN IF NOT EXISTS force_dispatch_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS force_dispatch_after_seconds INTEGER NOT NULL DEFAULT 300;

COMMENT ON COLUMN public.v8_settings.force_dispatch_enabled IS
  'Quando true, o v8-retry-cron força re-disparo (simulate_one) de simulações pendentes com attempt_count=0 e idade > force_dispatch_after_seconds.';
COMMENT ON COLUMN public.v8_settings.force_dispatch_after_seconds IS
  'Janela (em segundos) para considerar uma simulação V8 "presa" sem nenhuma resposta da V8/webhook. Default 300s (5 min).';