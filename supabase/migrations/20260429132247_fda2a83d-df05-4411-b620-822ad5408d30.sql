CREATE OR REPLACE FUNCTION public.cleanup_old_v8_operation_drafts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.v8_operation_drafts
  WHERE is_submitted = false
    AND updated_at < (now() - interval '30 days');
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-v8-operation-drafts-daily') THEN
    PERFORM cron.unschedule('cleanup-v8-operation-drafts-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup-v8-operation-drafts-daily',
  '0 3 * * *',
  $$ SELECT public.cleanup_old_v8_operation_drafts(); $$
);