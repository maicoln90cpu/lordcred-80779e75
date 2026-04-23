-- Recriar view sem SECURITY DEFINER (garante que RLS do usuário seja respeitada)
DROP VIEW IF EXISTS public.v8_batch_summary;

CREATE VIEW public.v8_batch_summary
WITH (security_invoker = true)
AS
SELECT
  b.id,
  b.name,
  b.config_name,
  b.installments,
  b.total_count,
  b.pending_count,
  b.success_count,
  b.failure_count,
  b.status,
  b.created_by,
  b.created_at,
  b.completed_at,
  CASE WHEN b.total_count > 0 THEN ROUND(b.success_count::numeric / b.total_count * 100, 1) ELSE 0 END AS success_rate,
  COALESCE(SUM(s.released_value) FILTER (WHERE s.status = 'success'), 0) AS total_released,
  COALESCE(SUM(s.company_margin) FILTER (WHERE s.status = 'success'), 0) AS total_margin,
  COALESCE(AVG(s.released_value) FILTER (WHERE s.status = 'success'), 0) AS avg_released
FROM public.v8_batches b
LEFT JOIN public.v8_simulations s ON s.batch_id = b.id
GROUP BY b.id;