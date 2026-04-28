
-- 1) Recalcula contadores de um lote a partir de v8_simulations
CREATE OR REPLACE FUNCTION public.v8_recalc_batch_counters(_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total int;
  _success int;
  _failure int;
  _pending int;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'success'),
    COUNT(*) FILTER (WHERE status = 'failed'),
    COUNT(*) FILTER (WHERE status = 'pending')
  INTO _total, _success, _failure, _pending
  FROM public.v8_simulations
  WHERE batch_id = _batch_id;

  UPDATE public.v8_batches
  SET success_count = _success,
      failure_count = _failure,
      pending_count = _pending,
      total_count = GREATEST(total_count, _total),
      updated_at = now(),
      status = CASE
        WHEN _pending = 0 AND status <> 'cancelled' THEN 'completed'
        WHEN _pending > 0 AND status = 'completed' THEN 'processing'
        ELSE status
      END,
      completed_at = CASE
        WHEN _pending = 0 AND completed_at IS NULL THEN now()
        ELSE completed_at
      END
  WHERE id = _batch_id;
END;
$$;

-- 2) Backfill: copia config/parcelas do lote para sims sem esses dados
CREATE OR REPLACE FUNCTION public.v8_backfill_simulation_config(_batch_id uuid DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _affected int;
BEGIN
  WITH upd AS (
    UPDATE public.v8_simulations s
    SET config_id = COALESCE(s.config_id, b.config_id),
        config_name = COALESCE(s.config_name, b.config_name),
        installments = COALESCE(s.installments, b.installments)
    FROM public.v8_batches b
    WHERE s.batch_id = b.id
      AND (s.config_id IS NULL OR s.installments IS NULL)
      AND b.config_id IS NOT NULL
      AND (_batch_id IS NULL OR s.batch_id = _batch_id)
    RETURNING 1
  )
  SELECT COUNT(*) INTO _affected FROM upd;
  RETURN _affected;
END;
$$;

-- 3) Backfill imediato em todos os lotes existentes
SELECT public.v8_backfill_simulation_config();

-- 4) Recalcula contadores de todos os lotes ativos / recentes
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM public.v8_batches
    WHERE created_at > now() - interval '30 days'
  LOOP
    PERFORM public.v8_recalc_batch_counters(r.id);
  END LOOP;
END $$;
