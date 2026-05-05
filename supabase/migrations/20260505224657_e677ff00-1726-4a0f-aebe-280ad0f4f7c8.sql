
CREATE OR REPLACE FUNCTION public.recalculate_v8_batch(p_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_pending int;
  v_success int;
  v_failure int;
  v_last_activity timestamptz;
  v_new_status text;
  v_old_status text;
  v_completed_at timestamptz;
BEGIN
  SELECT status INTO v_old_status FROM public.v8_batches WHERE id = p_batch_id;
  IF v_old_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch not found');
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('pending','analysis_pending','queued','processing')),
    COUNT(*) FILTER (WHERE status = 'success'),
    COUNT(*) FILTER (WHERE status IN ('failed','rejected','error','cancelled')),
    MAX(updated_at)
  INTO v_total, v_pending, v_success, v_failure, v_last_activity
  FROM public.v8_simulations
  WHERE batch_id = p_batch_id;

  IF v_pending = 0 AND v_total > 0 THEN
    v_new_status := 'completed';
    v_completed_at := COALESCE((SELECT completed_at FROM public.v8_batches WHERE id = p_batch_id), now());
    IF v_completed_at IS NULL THEN v_completed_at := now(); END IF;
  ELSIF v_pending > 0 AND v_last_activity IS NOT NULL AND v_last_activity < now() - interval '60 minutes' THEN
    v_new_status := 'stuck';
    v_completed_at := NULL;
  ELSE
    v_new_status := 'processing';
    v_completed_at := NULL;
  END IF;

  UPDATE public.v8_batches
  SET
    pending_count = v_pending,
    success_count = v_success,
    failure_count = v_failure,
    total_count = GREATEST(total_count, v_total),
    status = CASE
      WHEN status IN ('cancelled','paused') THEN status
      ELSE v_new_status
    END,
    completed_at = CASE
      WHEN v_new_status = 'completed' THEN v_completed_at
      ELSE NULL
    END,
    updated_at = now()
  WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'ok', true,
    'batch_id', p_batch_id,
    'old_status', v_old_status,
    'new_status', v_new_status,
    'total', v_total,
    'pending', v_pending,
    'success', v_success,
    'failure', v_failure
  );
END;
$$;

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
        (b.status = 'completed' AND EXISTS (
          SELECT 1 FROM public.v8_simulations s
          WHERE s.batch_id = b.id
            AND s.status IN ('pending','analysis_pending','queued','processing')
        ))
        OR
        (b.status = 'processing' AND b.updated_at < now() - interval '30 minutes')
      )
  LOOP
    v_results := v_results || public.recalculate_v8_batch(r.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'recalculated', v_count, 'results', v_results);
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_v8_batch(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_all_stuck_v8_batches() TO authenticated, service_role;
