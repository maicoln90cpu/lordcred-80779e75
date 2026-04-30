
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-audit-logs-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-audit-logs-daily',
  '15 3 * * *',
  $$ SELECT public.cleanup_audit_logs(); $$
);
