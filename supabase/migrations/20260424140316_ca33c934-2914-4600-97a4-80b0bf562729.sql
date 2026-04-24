-- Cleanup function: remove audit_logs older than 15 days
CREATE OR REPLACE FUNCTION public.cleanup_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.audit_logs
  WHERE created_at < now() - interval '15 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'cleanup_audit_logs: removed % rows', deleted_count;
END;
$$;