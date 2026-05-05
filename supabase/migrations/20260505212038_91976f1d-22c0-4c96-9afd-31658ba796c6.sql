-- RPC para listar status dos cron jobs do V8 (para monitoramento UI)
CREATE OR REPLACE FUNCTION public.get_v8_cron_jobs_status()
RETURNS TABLE(jobname text, schedule text, active boolean, last_run_at timestamptz, last_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  IF NOT public.is_privileged() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    j.jobname::text,
    j.schedule::text,
    j.active,
    (SELECT MAX(r.start_time) FROM cron.job_run_details r WHERE r.jobid = j.jobid) AS last_run_at,
    (SELECT r.status FROM cron.job_run_details r WHERE r.jobid = j.jobid ORDER BY r.start_time DESC LIMIT 1) AS last_status
  FROM cron.job j
  WHERE j.jobname ILIKE '%v8%'
     OR j.jobname ILIKE '%cleanup%'
     OR j.jobname ILIKE '%webhook%'
  ORDER BY j.jobname;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_v8_cron_jobs_status() TO authenticated;