-- Mantém apenas a linha mais recente para cada combinação de name+bank_name (case-insensitive, trim)
-- e marca as antigas como inativas (não deleta — preserva histórico em audit).
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY LOWER(TRIM(name)), COALESCE(LOWER(TRIM(bank_name)), '')
           ORDER BY synced_at DESC, created_at DESC
         ) AS rn
  FROM public.v8_configs_cache
)
UPDATE public.v8_configs_cache c
SET is_active = false
FROM ranked r
WHERE c.id = r.id AND r.rn > 1;