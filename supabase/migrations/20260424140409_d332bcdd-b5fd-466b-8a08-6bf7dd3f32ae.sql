-- Remove previous schedule if exists (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-audit-logs-daily');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Schedule daily cleanup at 03:15 UTC (~00:15 America/Sao_Paulo)
SELECT cron.schedule(
  'cleanup-audit-logs-daily',
  '15 3 * * *',
  $$ SELECT public.cleanup_audit_logs(); $$
);