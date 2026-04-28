-- ============================================================================
-- View: v8_simulations_audit
-- Lista todas as simulações que tiveram raw_response.migration_fixed_at gravado
-- por uma reconciliação one-shot. Útil para auditar o que mudou e quando.
-- ============================================================================

CREATE OR REPLACE VIEW public.v8_simulations_audit
WITH (security_invoker = true)
AS
SELECT
  s.id                                                            AS simulation_id,
  s.batch_id,
  s.cpf,
  s.name,
  s.status                                                        AS current_status,
  s.error_kind                                                    AS current_error_kind,
  s.error_message                                                 AS current_error_message,
  s.released_value,
  s.installment_value,
  s.installments,
  s.margem_valor,
  (s.raw_response ->> 'migration_action')                         AS migration_action,
  ((s.raw_response ->> 'migration_fixed_at')::timestamptz)        AS migration_fixed_at,
  COALESCE(
    s.raw_response #>> '{v8_status_snapshot,latest,status}',
    s.raw_response #>> '{v8_status_snapshot,status}'
  )                                                               AS v8_snapshot_status,
  s.created_at,
  s.processed_at
FROM public.v8_simulations s
WHERE (s.raw_response ->> 'migration_fixed_at') IS NOT NULL;

-- Acesso: mesma política das tabelas v8_* (privileged users only).
-- Como é security_invoker, herda RLS da tabela base v8_simulations.
GRANT SELECT ON public.v8_simulations_audit TO authenticated;

COMMENT ON VIEW public.v8_simulations_audit IS
  'Auditoria de reconciliações automáticas em v8_simulations. Cada linha = uma correção one-shot (campo migration_action no raw_response).';