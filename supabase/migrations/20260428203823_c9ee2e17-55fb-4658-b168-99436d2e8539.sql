-- Etapa 1/2: backfill via consult_id direto (mais rápido)
DO $$
DECLARE _affected int; _total int := 0; _rounds int := 0;
BEGIN
  LOOP
    WITH batch AS (
      SELECT w.id, w.consult_id, w.v8_simulation_id
      FROM public.v8_webhook_logs w
      WHERE w.cpf IS NULL
        AND (w.consult_id IS NOT NULL OR w.v8_simulation_id IS NOT NULL)
      LIMIT 2000
      FOR UPDATE SKIP LOCKED
    )
    UPDATE public.v8_webhook_logs w
    SET cpf = regexp_replace(s.cpf, '\D', '', 'g')
    FROM batch b
    JOIN public.v8_simulations s
      ON (b.v8_simulation_id IS NOT NULL AND s.v8_simulation_id = b.v8_simulation_id)
      OR (b.consult_id IS NOT NULL AND s.consult_id = b.consult_id)
    WHERE w.id = b.id
      AND s.cpf IS NOT NULL
      AND length(regexp_replace(s.cpf, '\D', '', 'g')) = 11;

    GET DIAGNOSTICS _affected = ROW_COUNT;
    _total  := _total + _affected;
    _rounds := _rounds + 1;
    EXIT WHEN _affected = 0 OR _rounds >= 60;
  END LOOP;
  RAISE NOTICE 'backfill via simulations: % linhas em % lotes', _total, _rounds;
END $$;