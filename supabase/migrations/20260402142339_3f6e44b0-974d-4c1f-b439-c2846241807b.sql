
-- Create cleanup function for webhook_logs only
CREATE OR REPLACE FUNCTION public.cleanup_webhook_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.webhook_logs
  WHERE created_at < now() - interval '3 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE LOG 'cleanup_webhook_logs: removed % rows', deleted_count;
END;
$$;

-- Schedule daily cleanup at 04:00 UTC (01:00 São Paulo)
SELECT cron.schedule(
  'cleanup-webhook-logs',
  '0 4 * * *',
  $$SELECT public.cleanup_webhook_logs()$$
);
