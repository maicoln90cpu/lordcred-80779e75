-- ============================================================================
-- Frente A: Reconciliar linhas antigas active_consult com o snapshot real da V8
-- ============================================================================
-- Contexto: antes do deploy da nova lógica (active_consult => pending/WAITING_EXTERNAL),
-- o sistema marcava como `failed`. O poller passou a gravar snapshot mas linhas
-- já failed nunca foram revisitadas. Esta migração one-shot reconcilia.
--
-- 3 cenários (por raw_response.v8_status_snapshot.latest.status):
--   1) SUCCESS  + simulationLimit válido => promove para success
--   2) REJECTED / FAILED                  => mantém failed, mensagem clara
--   3) Demais (CONSENT_APPROVED, IN_PROGRESS, IN_ANALYSIS, etc.)
--                                         => volta para pending + WAITING_EXTERNAL
-- ============================================================================

-- 1) Promover para SUCCESS (consulta antiga já concluiu na V8)
WITH candidates AS (
  SELECT
    id,
    raw_response,
    NULLIF(
      COALESCE(
        (raw_response #>> '{v8_status_snapshot,latest,simulationLimit,valueMax}'),
        (raw_response #>> '{v8_status_snapshot,simulationLimit,valueMax}')
      ),
      ''
    )::numeric AS value_max,
    NULLIF(
      COALESCE(
        (raw_response #>> '{v8_status_snapshot,latest,simulationLimit,installmentsMax}'),
        (raw_response #>> '{v8_status_snapshot,simulationLimit,installmentsMax}')
      ),
      ''
    )::int AS inst_max
  FROM v8_simulations
  WHERE status = 'failed'
    AND error_kind = 'active_consult'
    AND raw_response ? 'v8_status_snapshot'
    AND UPPER(COALESCE(
      raw_response #>> '{v8_status_snapshot,latest,status}',
      raw_response #>> '{v8_status_snapshot,status}',
      ''
    )) = 'SUCCESS'
)
UPDATE v8_simulations s
SET
  status = 'success',
  error_kind = NULL,
  error_message = NULL,
  released_value = c.value_max,
  installments = c.inst_max,
  installment_value = ROUND(c.value_max / NULLIF(c.inst_max, 0), 2),
  total_value = c.value_max,
  simulate_status = 'not_started',
  processed_at = now(),
  raw_response = c.raw_response
    || jsonb_build_object('migration_fixed_at', now(), 'migration_action', 'promoted_to_success')
FROM candidates c
WHERE s.id = c.id
  AND c.value_max IS NOT NULL
  AND c.inst_max IS NOT NULL
  AND c.value_max > 0
  AND c.inst_max > 0;

-- 2) Manter como failed mas com mensagem clara (consulta antiga rejeitada)
UPDATE v8_simulations
SET
  error_message = 'Consulta antiga rejeitada na V8. Cliente não pode operar agora.',
  raw_response = raw_response
    || jsonb_build_object('migration_fixed_at', now(), 'migration_action', 'kept_failed_rejected')
WHERE status = 'failed'
  AND error_kind = 'active_consult'
  AND raw_response ? 'v8_status_snapshot'
  AND UPPER(COALESCE(
    raw_response #>> '{v8_status_snapshot,latest,status}',
    raw_response #>> '{v8_status_snapshot,status}',
    ''
  )) IN ('REJECTED', 'FAILED');

-- 3) Voltar para pending/WAITING_EXTERNAL (amarelo) — consulta antiga ainda rodando na V8
UPDATE v8_simulations
SET
  status = 'pending',
  webhook_status = 'WAITING_EXTERNAL',
  processed_at = NULL,
  raw_response = raw_response
    || jsonb_build_object('migration_fixed_at', now(), 'migration_action', 'reverted_to_waiting')
WHERE status = 'failed'
  AND error_kind = 'active_consult'
  AND raw_response ? 'v8_status_snapshot'
  AND UPPER(COALESCE(
    raw_response #>> '{v8_status_snapshot,latest,status}',
    raw_response #>> '{v8_status_snapshot,status}',
    ''
  )) NOT IN ('SUCCESS', 'REJECTED', 'FAILED', '');