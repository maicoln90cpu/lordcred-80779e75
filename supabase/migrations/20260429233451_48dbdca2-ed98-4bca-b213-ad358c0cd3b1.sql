
DROP FUNCTION IF EXISTS public.get_v8_database_health();

CREATE OR REPLACE FUNCTION public.get_v8_database_health()
 RETURNS TABLE(
   total_simulations bigint,
   total_webhooks_v8 bigint,
   webhooks_v8_older_than_1d bigint,
   v8_webhook_table_size text,
   v8_simulations_table_size text,
   database_total_size text,
   total_audit_logs bigint,
   audit_logs_older_than_1d bigint,
   audit_logs_table_size text,
   total_webhook_logs bigint,
   webhook_logs_older_than_1d bigint,
   webhook_logs_table_size text,
   total_chip_lifecycle_logs bigint,
   chip_lifecycle_logs_table_size text
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_privileged() THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.v8_simulations)::bigint,
    (SELECT COUNT(*) FROM public.v8_webhook_logs)::bigint,
    (SELECT COUNT(*) FROM public.v8_webhook_logs WHERE received_at < now() - interval '1 day')::bigint,
    pg_size_pretty(pg_total_relation_size('public.v8_webhook_logs'))::text,
    pg_size_pretty(pg_total_relation_size('public.v8_simulations'))::text,
    pg_size_pretty(pg_database_size(current_database()))::text,
    (SELECT COUNT(*) FROM public.audit_logs)::bigint,
    (SELECT COUNT(*) FROM public.audit_logs WHERE created_at < now() - interval '1 day')::bigint,
    pg_size_pretty(pg_total_relation_size('public.audit_logs'))::text,
    (SELECT COUNT(*) FROM public.webhook_logs)::bigint,
    (SELECT COUNT(*) FROM public.webhook_logs WHERE created_at < now() - interval '1 day')::bigint,
    pg_size_pretty(pg_total_relation_size('public.webhook_logs'))::text,
    (SELECT COUNT(*) FROM public.chip_lifecycle_logs)::bigint,
    pg_size_pretty(pg_total_relation_size('public.chip_lifecycle_logs'))::text;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_v8_database_health() TO authenticated;
