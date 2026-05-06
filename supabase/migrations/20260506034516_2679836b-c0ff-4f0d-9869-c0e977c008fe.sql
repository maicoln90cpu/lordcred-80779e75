DO $$
BEGIN
  PERFORM cron.unschedule('v8_force_full_reconciliation_30min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'v8_force_full_reconciliation_30min',
  '*/30 * * * *',
  $$ SELECT public.v8_force_full_reconciliation(); $$
);