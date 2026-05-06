-- Backfill: lotes ativos passam a ter auto_best automático.
UPDATE public.v8_batches
SET auto_best_enabled = true
WHERE auto_best_enabled = false
  AND status NOT IN ('done', 'canceled', 'failed');

-- Enfileira simulações elegíveis desses lotes que ainda não têm job (idempotente).
INSERT INTO public.v8_auto_best_jobs (simulation_id, batch_id, status)
SELECT s.id, s.batch_id, 'queued'
FROM public.v8_simulations s
WHERE s.consult_id IS NOT NULL
  AND s.config_id IS NOT NULL
  AND COALESCE(s.margem_valor, 0) > 0
  AND s.simulate_status IS DISTINCT FROM 'done'
  AND s.status IN ('success')
  AND NOT EXISTS (
    SELECT 1 FROM public.v8_auto_best_jobs j WHERE j.simulation_id = s.id
  )
ON CONFLICT (simulation_id) DO NOTHING;