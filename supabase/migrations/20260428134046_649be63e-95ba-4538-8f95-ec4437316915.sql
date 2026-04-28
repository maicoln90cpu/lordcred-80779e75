-- Reclassificação retroativa em uma única transação.
-- Atualiza apenas as linhas com `error_kind IS NULL`, status='failed' e ainda dentro
-- do cap de tentativas, evitando que o cron tente reprocessar simulações já esgotadas.
DO $$
DECLARE
  v_max_attempts int;
  v_total_before int;
  v_updated int;
  v_counts jsonb;
BEGIN
  -- Lê o teto configurado (fallback para 15, que é o default do código)
  SELECT COALESCE(max_auto_retry_attempts, 15) INTO v_max_attempts
  FROM v8_settings
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_max_attempts IS NULL THEN
    v_max_attempts := 15;
  END IF;

  -- Contagem antes (informativo)
  SELECT COUNT(*) INTO v_total_before
  FROM v8_simulations
  WHERE status = 'failed' AND error_kind IS NULL;

  -- UPDATE em massa (rápido — predicate é seletivo)
  WITH updated AS (
    UPDATE v8_simulations
    SET error_kind = classify_v8_error_kind(raw_response, error_message)
    WHERE status = 'failed'
      AND error_kind IS NULL
      AND COALESCE(attempt_count, 0) < v_max_attempts
    RETURNING error_kind
  )
  SELECT COUNT(*) INTO v_updated FROM updated;

  -- Contagem por kind atribuído
  SELECT jsonb_object_agg(k, c) INTO v_counts
  FROM (
    SELECT COALESCE(error_kind, 'sem_kind_apos_reclass') AS k, COUNT(*) AS c
    FROM v8_simulations
    WHERE status = 'failed'
    GROUP BY error_kind
  ) sub;

  -- Audit log final
  INSERT INTO audit_logs (user_id, user_email, action, target_table, details)
  VALUES (
    NULL,
    'system@migration',
    'v8_error_reclassification_done',
    'v8_simulations',
    jsonb_build_object(
      'category',           'simulator',
      'success',            true,
      'rows_evaluated',     v_total_before,
      'rows_updated',       v_updated,
      'max_attempts_cap',   v_max_attempts,
      'final_distribution', COALESCE(v_counts, '{}'::jsonb),
      'note',               'UPDATE retroativo: aplica classify_v8_error_kind em failed/error_kind IS NULL com attempt_count abaixo do cap.'
    )
  );

  RAISE LOG 'v8_error_reclassification_done: avaliadas=% atualizadas=% cap=%',
    v_total_before, v_updated, v_max_attempts;
END;
$$ LANGUAGE plpgsql;