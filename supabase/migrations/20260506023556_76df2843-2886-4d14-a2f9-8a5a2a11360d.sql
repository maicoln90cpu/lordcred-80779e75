-- 1) Funções de decremento atômico (espelho das de incremento)
CREATE OR REPLACE FUNCTION public.v8_decrement_batch_success(_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _batch_id IS NULL THEN RETURN; END IF;
  UPDATE public.v8_batches
     SET success_count = GREATEST(0, COALESCE(success_count, 0) - 1),
         updated_at    = now()
   WHERE id = _batch_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.v8_decrement_batch_failure(_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _batch_id IS NULL THEN RETURN; END IF;
  UPDATE public.v8_batches
     SET failure_count = GREATEST(0, COALESCE(failure_count, 0) - 1),
         updated_at    = now()
   WHERE id = _batch_id;
END;
$$;

-- 2) Trigger de status com TODAS as transições tratadas
CREATE OR REPLACE FUNCTION public.v8_simulations_after_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old text := COALESCE(OLD.status, '');
  v_new text := COALESCE(NEW.status, '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM v8_recalc_batch_counters(NEW.batch_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM v8_recalc_batch_counters(OLD.batch_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND v_old IS DISTINCT FROM v_new THEN
    -- Caminho rápido (incremento/decremento atômico)
    IF v_old = 'pending' AND v_new = 'success' THEN
      PERFORM v8_increment_batch_success(NEW.batch_id);
    ELSIF v_old = 'pending' AND v_new = 'failed' THEN
      PERFORM v8_increment_batch_failure(NEW.batch_id);
    ELSIF v_old = 'failed'  AND v_new = 'pending' THEN
      -- retry resetou: tira a falha que tinha sido contada
      PERFORM v8_decrement_batch_failure(NEW.batch_id);
    ELSIF v_old = 'success' AND v_new = 'pending' THEN
      PERFORM v8_decrement_batch_success(NEW.batch_id);
    ELSIF v_old = 'success' AND v_new = 'failed' THEN
      PERFORM v8_decrement_batch_success(NEW.batch_id);
      PERFORM v8_increment_batch_failure(NEW.batch_id);
    ELSIF v_old = 'failed'  AND v_new = 'success' THEN
      PERFORM v8_decrement_batch_failure(NEW.batch_id);
      PERFORM v8_increment_batch_success(NEW.batch_id);
    ELSE
      -- Casos exóticos (skipped, canceled etc.) — recount completo é seguro.
      PERFORM v8_recalc_batch_counters(NEW.batch_id);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

-- 3) Recount one-shot dos lotes não-finais para limpar divergências históricas
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM public.v8_batches
     WHERE status NOT IN ('canceled', 'cancelled')
  LOOP
    PERFORM public.v8_recalc_batch_counters(r.id);
  END LOOP;
END;
$$;

-- 4) Acelera auto-retry: backoff 15s → 8s, teto de tentativas 5 → 6
UPDATE public.v8_settings
   SET retry_min_backoff_seconds = 8,
       max_auto_retry_attempts   = 6,
       updated_at                = now()
 WHERE singleton = true;
