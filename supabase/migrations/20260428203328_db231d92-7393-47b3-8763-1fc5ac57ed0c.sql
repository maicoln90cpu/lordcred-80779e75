-- Etapa 9 (Frente E): CPF em v8_webhook_logs
-- 1) Coluna + índice
ALTER TABLE public.v8_webhook_logs ADD COLUMN IF NOT EXISTS cpf text;
CREATE INDEX IF NOT EXISTS idx_v8_webhook_logs_cpf ON public.v8_webhook_logs(cpf) WHERE cpf IS NOT NULL;

-- 2) Função que extrai CPF do payload + faz fallback via JOIN
CREATE OR REPLACE FUNCTION public.v8_resolve_webhook_cpf(
  _payload jsonb,
  _v8_simulation_id text,
  _consult_id text,
  _operation_id text
) RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cpf text;
BEGIN
  -- 1) payload->>'documentNumber'
  _cpf := regexp_replace(COALESCE(_payload->>'documentNumber', ''), '\D', '', 'g');
  IF length(_cpf) = 11 THEN RETURN _cpf; END IF;

  -- 2) payload->'borrower'->>'document_number'
  _cpf := regexp_replace(COALESCE(_payload->'borrower'->>'document_number', ''), '\D', '', 'g');
  IF length(_cpf) = 11 THEN RETURN _cpf; END IF;

  -- 3) payload->'data'->>'documentNumber' (alguns webhooks aninham em 'data')
  _cpf := regexp_replace(COALESCE(_payload->'data'->>'documentNumber', ''), '\D', '', 'g');
  IF length(_cpf) = 11 THEN RETURN _cpf; END IF;

  -- 4) JOIN v8_simulations por v8_simulation_id ou consult_id
  IF _v8_simulation_id IS NOT NULL OR _consult_id IS NOT NULL THEN
    SELECT regexp_replace(s.cpf, '\D', '', 'g') INTO _cpf
    FROM public.v8_simulations s
    WHERE (_v8_simulation_id IS NOT NULL AND s.v8_simulation_id = _v8_simulation_id)
       OR (_consult_id IS NOT NULL AND s.consult_id = _consult_id)
    LIMIT 1;
    IF _cpf IS NOT NULL AND length(_cpf) = 11 THEN RETURN _cpf; END IF;
  END IF;

  -- 5) JOIN v8_operations_local -> v8_simulations
  IF _operation_id IS NOT NULL OR _v8_simulation_id IS NOT NULL OR _consult_id IS NOT NULL THEN
    SELECT regexp_replace(s.cpf, '\D', '', 'g') INTO _cpf
    FROM public.v8_operations_local o
    JOIN public.v8_simulations s
      ON s.v8_simulation_id = o.v8_simulation_id
      OR s.consult_id = o.consult_id
    WHERE (_operation_id IS NOT NULL AND o.operation_id = _operation_id)
       OR (_v8_simulation_id IS NOT NULL AND o.v8_simulation_id = _v8_simulation_id)
       OR (_consult_id IS NOT NULL AND o.consult_id = _consult_id)
    LIMIT 1;
    IF _cpf IS NOT NULL AND length(_cpf) = 11 THEN RETURN _cpf; END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- 3) Trigger BEFORE INSERT/UPDATE: popula cpf automaticamente quando vazio
CREATE OR REPLACE FUNCTION public.v8_webhook_logs_set_cpf()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cpf IS NULL THEN
    NEW.cpf := public.v8_resolve_webhook_cpf(
      NEW.payload,
      NEW.v8_simulation_id,
      NEW.consult_id,
      NEW.operation_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_v8_webhook_logs_set_cpf ON public.v8_webhook_logs;
CREATE TRIGGER trg_v8_webhook_logs_set_cpf
BEFORE INSERT OR UPDATE OF payload, v8_simulation_id, consult_id, operation_id
ON public.v8_webhook_logs
FOR EACH ROW
EXECUTE FUNCTION public.v8_webhook_logs_set_cpf();