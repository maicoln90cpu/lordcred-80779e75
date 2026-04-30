-- =========================================================================
-- ITEM 1: Corrige CHECK de hr_candidates
-- =========================================================================
ALTER TABLE public.hr_candidates
  DROP CONSTRAINT IF EXISTS hr_candidates_kanban_status_check;

ALTER TABLE public.hr_candidates
  ADD CONSTRAINT hr_candidates_kanban_status_check
  CHECK (kanban_status = ANY (ARRAY[
    'new_resume'::text,
    'contacted'::text,
    'scheduled_e1'::text,
    'done_e1'::text,
    'scheduled_e2'::text,
    'done_e2'::text,
    'approved'::text,
    'rejected'::text,
    'doubt'::text,
    'became_partner'::text,
    'migrated_partner'::text
  ]));

-- =========================================================================
-- ITEM 5: Retenção real + VACUUM seguro automatizado
-- =========================================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  audit_deleted   integer := 0;
  v8_deleted      integer := 0;
  webhook_deleted integer := 0;
BEGIN
  DELETE FROM public.audit_logs
  WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS audit_deleted = ROW_COUNT;

  DELETE FROM public.v8_webhook_logs
  WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS v8_deleted = ROW_COUNT;

  DELETE FROM public.webhook_logs
  WHERE created_at < now() - interval '3 days';
  GET DIAGNOSTICS webhook_deleted = ROW_COUNT;

  RAISE LOG 'cleanup_old_logs: audit=% v8=% webhook=%',
    audit_deleted, v8_deleted, webhook_deleted;

  RETURN jsonb_build_object(
    'audit_logs_deleted', audit_deleted,
    'v8_webhook_logs_deleted', v8_deleted,
    'webhook_logs_deleted', webhook_deleted,
    'ran_at', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.maintenance_vacuum_analyze()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb := '[]'::jsonb;
  tbl text;
  tables text[] := ARRAY['audit_logs', 'v8_webhook_logs', 'webhook_logs'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('VACUUM (ANALYZE) public.%I', tbl);
      result := result || jsonb_build_object('table', tbl, 'status', 'ok');
    EXCEPTION WHEN OTHERS THEN
      result := result || jsonb_build_object('table', tbl, 'status', 'error', 'message', SQLERRM);
    END;
  END LOOP;
  RETURN jsonb_build_object('ran_at', now(), 'results', result);
END;
$$;

CREATE OR REPLACE FUNCTION public.db_maintenance_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb := '[]'::jsonb;
  rec record;
BEGIN
  IF NOT public.is_privileged(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  FOR rec IN
    SELECT
      relname AS table_name,
      n_live_tup AS live_rows,
      n_dead_tup AS dead_rows,
      pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
      pg_total_relation_size(relid) AS total_size_bytes,
      last_vacuum,
      last_autovacuum,
      last_analyze
    FROM pg_stat_user_tables
    WHERE relname IN ('audit_logs', 'v8_webhook_logs', 'webhook_logs')
    ORDER BY pg_total_relation_size(relid) DESC
  LOOP
    result := result || jsonb_build_object(
      'table_name', rec.table_name,
      'live_rows', rec.live_rows,
      'dead_rows', rec.dead_rows,
      'total_size', rec.total_size,
      'total_size_bytes', rec.total_size_bytes,
      'last_vacuum', rec.last_vacuum,
      'last_autovacuum', rec.last_autovacuum,
      'last_analyze', rec.last_analyze
    );
  END LOOP;

  RETURN jsonb_build_object('ran_at', now(), 'tables', result);
END;
$$;

-- =========================================================================
-- Agendamento via pg_cron (idempotente)
-- =========================================================================

-- Remove jobs conflitantes (cleanup-audit-logs-daily antigo é substituído)
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT jobid FROM cron.job
    WHERE jobname IN ('cleanup_old_logs_daily', 'maintenance_vacuum_weekly', 'cleanup-audit-logs-daily')
  LOOP
    PERFORM cron.unschedule(rec.jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'cleanup_old_logs_daily',
  '0 6 * * *',
  $$ SELECT public.cleanup_old_logs(); $$
);

SELECT cron.schedule(
  'maintenance_vacuum_weekly',
  '0 7 * * 0',
  $$ SELECT public.maintenance_vacuum_analyze(); $$
);