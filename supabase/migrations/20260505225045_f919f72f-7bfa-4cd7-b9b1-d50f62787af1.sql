
WITH dups AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY consult_id ORDER BY updated_at DESC NULLS LAST, created_at DESC) AS rn
  FROM public.v8_simulations
  WHERE consult_id IS NOT NULL
)
UPDATE public.v8_simulations s
SET consult_id = s.consult_id || '__dup_' || s.id::text
FROM dups d
WHERE s.id = d.id AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_simulations_consult_id_unique
  ON public.v8_simulations(consult_id)
  WHERE consult_id IS NOT NULL;

SELECT cron.unschedule('v8-recalculate-stuck-batches-every-5min')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'v8-recalculate-stuck-batches-every-5min');

SELECT cron.schedule(
  'v8-recalculate-stuck-batches-every-5min',
  '*/5 * * * *',
  $$ SELECT public.recalculate_all_stuck_v8_batches(); $$
);
