
-- 1) Fix recalculate_all_stuck_v8_batches: incluir status='stuck'
CREATE OR REPLACE FUNCTION public.recalculate_all_stuck_v8_batches()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_results jsonb := '[]'::jsonb;
  v_count int := 0;
BEGIN
  FOR r IN
    SELECT b.id
    FROM public.v8_batches b
    WHERE b.status NOT IN ('cancelled','paused')
      AND (
        b.status = 'stuck'
        OR (b.status = 'completed' AND EXISTS (
          SELECT 1 FROM public.v8_simulations s
          WHERE s.batch_id = b.id
            AND s.status IN ('pending','analysis_pending','queued','processing')
        ))
        OR (b.status = 'processing' AND b.updated_at < now() - interval '30 minutes')
      )
  LOOP
    v_results := v_results || public.recalculate_v8_batch(r.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'recalculated', v_count, 'results', v_results);
END;
$$;

-- 2) Watchdog por linha: marca pendentes >30 min como failed/no_final_webhook
CREATE OR REPLACE FUNCTION public.v8_watchdog_stuck_simulations(p_age_minutes int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_attempts int;
  v_marked int := 0;
  v_recalc_batches uuid[];
BEGIN
  SELECT COALESCE(max_auto_retry_attempts, 5)
    INTO v_max_attempts
  FROM public.v8_settings
  WHERE singleton = true;

  IF v_max_attempts IS NULL THEN v_max_attempts := 5; END IF;

  -- Coleta IDs dos batches afetados antes do UPDATE
  SELECT array_agg(DISTINCT s.batch_id)
    INTO v_recalc_batches
  FROM public.v8_simulations s
  WHERE s.status IN ('pending','analysis_pending')
    AND s.batch_id IS NOT NULL
    AND s.created_at < now() - (p_age_minutes || ' minutes')::interval
    AND COALESCE(s.last_webhook_at, s.created_at) < now() - (p_age_minutes || ' minutes')::interval
    AND COALESCE(s.attempt_count, 0) >= v_max_attempts;

  -- Marca falhas
  UPDATE public.v8_simulations
  SET
    status = 'failed',
    error_kind = 'no_final_webhook',
    error_message = 'Webhook V8 não chegou após ' || p_age_minutes || ' min e tentativas esgotadas (' || v_max_attempts || ').',
    last_step = 'watchdog_no_webhook',
    processed_at = now(),
    updated_at = now()
  WHERE status IN ('pending','analysis_pending')
    AND batch_id IS NOT NULL
    AND created_at < now() - (p_age_minutes || ' minutes')::interval
    AND COALESCE(last_webhook_at, created_at) < now() - (p_age_minutes || ' minutes')::interval
    AND COALESCE(attempt_count, 0) >= v_max_attempts;

  GET DIAGNOSTICS v_marked = ROW_COUNT;

  -- Recalcula contadores dos lotes afetados
  IF v_recalc_batches IS NOT NULL THEN
    PERFORM public.recalculate_v8_batch(b)
    FROM unnest(v_recalc_batches) b;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'marked_failed', v_marked,
    'age_minutes', p_age_minutes,
    'max_attempts', v_max_attempts,
    'batches_recalculated', COALESCE(array_length(v_recalc_batches, 1), 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.v8_watchdog_stuck_simulations(int) TO authenticated, service_role;

-- 3) Cron: watchdog + recálculo a cada 10 min
SELECT cron.unschedule('v8-watchdog-stuck-sims-every-10min')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'v8-watchdog-stuck-sims-every-10min');

SELECT cron.schedule(
  'v8-watchdog-stuck-sims-every-10min',
  '*/10 * * * *',
  $$
    SELECT public.v8_watchdog_stuck_simulations(30);
    SELECT public.recalculate_all_stuck_v8_batches();
  $$
);
