-- Etapa 3 (mai/2026): Auto-best automático sempre ligado.

-- 1) Garante setting global on (idempotente, não sobrescreve se já existir o registro).
UPDATE public.v8_settings
SET auto_best_always_on = true
WHERE singleton = true AND auto_best_always_on IS DISTINCT FROM true;

-- 2) Novos lotes nascem com auto_best_enabled=true por padrão.
ALTER TABLE public.v8_batches
  ALTER COLUMN auto_best_enabled SET DEFAULT true;

COMMENT ON COLUMN public.v8_batches.auto_best_enabled IS
  'Default true (mai/2026). Quando true, o trigger v8_enqueue_auto_best enfileira jobs em v8_auto_best_jobs automaticamente. Usuário não precisa clicar em "Simular selecionados".';