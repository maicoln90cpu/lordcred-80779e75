CREATE OR REPLACE FUNCTION public.v8_force_full_reconciliation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_watchdog jsonb;
  v_recalc jsonb;
  v_lost_dispatch int := 0;
  v_requeued_autobest int := 0;
BEGIN
  -- 1) Watchdog: marca simulações pendentes sem webhook há +15min como failed.
  v_watchdog := public.v8_watchdog_stuck_simulations(15);

  -- 2) Recalcula lotes travados/sem progresso.
  v_recalc := public.recalculate_all_stuck_v8_batches();

  -- 3) Pendentes sem consult_id há +15min: dispatch perdeu, marca como failed
  --    (com error_kind retentável para o cron tentar de novo).
  WITH affected AS (
    UPDATE public.v8_simulations
       SET status = 'failed',
           error_kind = 'dispatch_failed',
           error_message = 'Dispatch perdido: sem consult_id após 15 min — elegível a auto-retry.',
           last_step = 'force_full_reconciliation',
           updated_at = now()
     WHERE status = 'pending'
       AND consult_id IS NULL
       AND created_at < now() - interval '15 minutes'
    RETURNING id, batch_id
  )
  SELECT COUNT(*) INTO v_lost_dispatch FROM affected;

  -- 4) Re-enfileira Auto-best para simulações com margem que ficaram sem job.
  INSERT INTO public.v8_auto_best_jobs (simulation_id, batch_id, status)
  SELECT s.id, s.batch_id, 'queued'
    FROM public.v8_simulations s
   WHERE s.consult_id IS NOT NULL
     AND s.config_id IS NOT NULL
     AND COALESCE(s.margem_valor, 0) > 0
     AND s.simulate_status IS DISTINCT FROM 'done'
     AND s.status = 'success'
     AND NOT EXISTS (
       SELECT 1 FROM public.v8_auto_best_jobs j WHERE j.simulation_id = s.id
     )
  ON CONFLICT (simulation_id) DO NOTHING;
  GET DIAGNOSTICS v_requeued_autobest = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'watchdog', v_watchdog,
    'recalc_batches', v_recalc,
    'lost_dispatch_marked_failed', v_lost_dispatch,
    'auto_best_requeued', v_requeued_autobest,
    'ran_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.v8_force_full_reconciliation() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.v8_force_full_reconciliation() TO authenticated, service_role;