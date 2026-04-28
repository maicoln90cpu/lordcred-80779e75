-- Função SQL espelho de src/lib/v8ErrorClassification.ts (detectV8ErrorKind).
-- Retorna o "error_kind" canônico a partir do raw_response (jsonb) + error_message (text).
-- IMMUTABLE para poder ser usada em UPDATE em massa sem custo extra.
CREATE OR REPLACE FUNCTION public.classify_v8_error_kind(
  raw_response jsonb,
  error_message text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_payload jsonb;
  v_haystack text;
  v_status int;
BEGIN
  -- Mesma camada de "payload" que getV8RawPayload usa no front
  v_payload := COALESCE(
    raw_response->'payload',
    raw_response->'response',
    raw_response,
    '{}'::jsonb
  );

  -- Concatena todos os campos textuais relevantes (lowercase) para busca por substring
  v_haystack := lower(concat_ws(' ',
    raw_response->>'title',     v_payload->>'title',
    raw_response->>'detail',    v_payload->>'detail',
    raw_response->>'message',   v_payload->>'message',
    raw_response->>'error',     v_payload->>'error',
    raw_response->>'rawText',   v_payload->>'rawText',
    error_message
  ));

  -- HTTP status (quando existir no raw)
  BEGIN
    v_status := NULLIF(raw_response->>'status', '')::int;
  EXCEPTION WHEN OTHERS THEN
    v_status := NULL;
  END;

  -- Mesma ordem de prioridade do TS detectV8ErrorKind
  IF v_haystack LIKE '%já existe uma consulta ativa%'
     OR v_haystack LIKE '%ja existe uma consulta ativa%'
     OR v_haystack LIKE '%já existe consulta ativa%'
     OR v_haystack LIKE '%ja existe consulta ativa%' THEN
    RETURN 'active_consult';
  END IF;

  IF v_haystack LIKE '%ainda em análise%'
     OR v_haystack LIKE '%ainda em analise%' THEN
    RETURN 'analysis_pending';
  END IF;

  IF (v_haystack LIKE '%operation%' AND v_haystack LIKE '%already%')
     OR v_haystack LIKE '%proposta já existente%'
     OR v_haystack LIKE '%proposta ja existente%' THEN
    RETURN 'existing_proposal';
  END IF;

  IF v_status = 429
     OR v_haystack LIKE '%limite de requisições excedido%'
     OR v_haystack LIKE '%limite de requisicoes excedido%'
     OR v_haystack LIKE '%rate limit%' THEN
    RETURN 'temporary_v8';
  END IF;

  IF v_status >= 500 THEN
    RETURN 'temporary_v8';
  END IF;

  IF v_status >= 400 THEN
    RETURN 'invalid_data';
  END IF;

  RETURN 'unknown';
END;
$$;

COMMENT ON FUNCTION public.classify_v8_error_kind(jsonb, text) IS
  'Espelho SQL de src/lib/v8ErrorClassification.ts (detectV8ErrorKind). Mantenha sincronizado.';