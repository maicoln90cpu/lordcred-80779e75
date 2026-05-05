CREATE OR REPLACE FUNCTION public.v8_enqueue_auto_best()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auto_best BOOLEAN;
  v_margin NUMERIC;
BEGIN
  -- Etapa D: dispara quando a margem já estiver disponível, mesmo com
  -- status interno ainda em "pending" (caso CONSENT_APPROVED com
  -- availableMarginValue retornado pela V8). Também segue cobrindo o
  -- caso clássico de status='success'.
  IF NEW.simulate_status IS NOT NULL
     AND NEW.simulate_status <> 'not_started' THEN
    RETURN NEW;
  END IF;

  IF NEW.consult_id IS NULL OR NEW.config_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_margin := COALESCE(NEW.margem_valor, 0);
  IF NEW.status <> 'success' AND v_margin <= 0 THEN
    RETURN NEW;
  END IF;

  -- Verifica se o batch quer auto-best.
  SELECT auto_best_enabled INTO v_auto_best
  FROM public.v8_batches
  WHERE id = NEW.batch_id;

  IF COALESCE(v_auto_best, false) IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.v8_auto_best_jobs (simulation_id, batch_id, status)
  VALUES (NEW.id, NEW.batch_id, 'queued')
  ON CONFLICT (simulation_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_v8_enqueue_auto_best ON public.v8_simulations;
CREATE TRIGGER trg_v8_enqueue_auto_best
  AFTER INSERT OR UPDATE OF status, simulate_status, margem_valor, consult_id, config_id
  ON public.v8_simulations
  FOR EACH ROW
  EXECUTE FUNCTION public.v8_enqueue_auto_best();