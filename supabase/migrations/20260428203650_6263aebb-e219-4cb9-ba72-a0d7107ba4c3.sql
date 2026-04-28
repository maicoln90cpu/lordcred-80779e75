-- Backfill simples e rápido: só payload, sem JOIN, em lotes
DO $$
DECLARE
  _affected int;
  _total    int := 0;
  _rounds   int := 0;
BEGIN
  LOOP
    WITH batch AS (
      SELECT id, payload
      FROM public.v8_webhook_logs
      WHERE cpf IS NULL
      LIMIT 10000
      FOR UPDATE SKIP LOCKED
    ),
    extracted AS (
      SELECT b.id,
        CASE
          WHEN length(regexp_replace(COALESCE(b.payload->>'documentNumber',''),'\D','','g')) = 11
            THEN regexp_replace(b.payload->>'documentNumber','\D','','g')
          WHEN length(regexp_replace(COALESCE(b.payload->'borrower'->>'document_number',''),'\D','','g')) = 11
            THEN regexp_replace(b.payload->'borrower'->>'document_number','\D','','g')
          WHEN length(regexp_replace(COALESCE(b.payload->'data'->>'documentNumber',''),'\D','','g')) = 11
            THEN regexp_replace(b.payload->'data'->>'documentNumber','\D','','g')
          ELSE NULL
        END AS cpf_resolved
      FROM batch b
    )
    UPDATE public.v8_webhook_logs w
    SET cpf = e.cpf_resolved
    FROM extracted e
    WHERE w.id = e.id AND e.cpf_resolved IS NOT NULL;

    GET DIAGNOSTICS _affected = ROW_COUNT;
    EXIT WHEN _affected = 0 AND _rounds > 0;
    _total  := _total + _affected;
    _rounds := _rounds + 1;
    EXIT WHEN _rounds >= 15;
  END LOOP;

  RAISE NOTICE 'v8_webhook_logs backfill payload: % linhas atualizadas em % lotes', _total, _rounds;
END $$;