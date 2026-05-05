ALTER TABLE public.v8_settings
  ADD COLUMN IF NOT EXISTS max_concurrent_batches_per_owner INTEGER NOT NULL DEFAULT 2
  CHECK (max_concurrent_batches_per_owner BETWEEN 1 AND 3);

COMMENT ON COLUMN public.v8_settings.max_concurrent_batches_per_owner IS
  'Quantos lotes V8 o mesmo operador pode rodar em paralelo (1-3). Etapa 2 mai/2026.';