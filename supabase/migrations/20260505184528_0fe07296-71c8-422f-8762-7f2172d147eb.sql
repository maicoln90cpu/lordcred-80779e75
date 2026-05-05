-- Etapa 2 (mai/2026): Auto-melhor sempre ligado globalmente.
-- Adiciona setting global e estende o trigger v8_enqueue_auto_best para enfileirar
-- jobs mesmo quando a simulação não tem batch (Pool, Operações manuais) ou quando
-- o batch não tem auto_best_enabled, desde que o setting global esteja on.

ALTER TABLE public.v8_settings
  ADD COLUMN IF NOT EXISTS auto_best_always_on BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.v8_settings.auto_best_always_on IS
  'Quando true, qualquer simulação V8 com margem disponível enfileira Auto-melhor automaticamente, mesmo sem batch ou sem auto_best_enabled no batch.';

-- Recria a função do trigger considerando o flag global.
CREATE OR REPLACE FUNCTION public.v8_enqueue_auto_best()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auto_best  BOOLEAN := false;
  v_global_on  BOOLEAN := false;
  v_margin     NUMERIC;
BEGIN
  -- Precisa ter consult_id e config_id para o worker conseguir simular.
  IF NEW.consult_id IS NULL OR NEW.config_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Margem confirmada (success OU consent_approved com margem positiva).
  v_margin := COALESCE(NEW.margem_valor, 0);
  IF NEW.status <> 'success' AND v_margin <= 0 THEN
    RETURN NEW;
  END IF;

  -- Já formalizado? Não enfileira.
  IF NEW.simulate_status = 'done' THEN
    RETURN NEW;
  END IF;

  -- Setting global Auto-melhor sempre ligado.
  SELECT auto_best_always_on INTO v_global_on
  FROM public.v8_settings
  WHERE singleton = true
  LIMIT 1;

  -- Flag por batch (legado).
  IF NEW.batch_id IS NOT NULL THEN
    SELECT auto_best_enabled INTO v_auto_best
    FROM public.v8_batches
    WHERE id = NEW.batch_id;
  END IF;

  -- Enfileira se global on OU batch on. Sem batch + global off = ignora.
  IF NOT (COALESCE(v_global_on, false) OR COALESCE(v_auto_best, false)) THEN
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