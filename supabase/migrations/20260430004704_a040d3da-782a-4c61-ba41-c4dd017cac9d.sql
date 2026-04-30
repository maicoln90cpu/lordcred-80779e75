-- Helper para o frontend ligar/desligar auto_best_enabled num batch.
-- Bypassa RLS via SECURITY DEFINER, mas valida is_privileged() antes.
CREATE OR REPLACE FUNCTION public.v8_set_batch_auto_best(_batch_id UUID, _enabled BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_privileged() THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;
  UPDATE public.v8_batches
  SET auto_best_enabled = _enabled
  WHERE id = _batch_id;

  -- Quando ligando agora e já tem simulações success aguardando: enfileira
  -- imediatamente os jobs órfãos (caso o operador tenha ligado o toggle DEPOIS
  -- das margens já terem voltado da V8).
  IF _enabled THEN
    INSERT INTO public.v8_auto_best_jobs (simulation_id, batch_id, status)
    SELECT s.id, s.batch_id, 'queued'
    FROM public.v8_simulations s
    WHERE s.batch_id = _batch_id
      AND s.status = 'success'
      AND COALESCE(s.simulate_status, 'not_started') = 'not_started'
      AND s.consult_id IS NOT NULL
      AND s.config_id IS NOT NULL
    ON CONFLICT (simulation_id) DO NOTHING;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.v8_set_batch_auto_best(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v8_set_batch_auto_best(UUID, BOOLEAN) TO authenticated;