-- ============================================================
-- Onda 4 (abr/2026): Worker Auto-melhor com aba fechada
-- ============================================================

-- 1) Coluna no batch
ALTER TABLE public.v8_batches
  ADD COLUMN IF NOT EXISTS auto_best_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.v8_batches.auto_best_enabled IS
  'Quando true, o trigger v8_enqueue_auto_best enfileira jobs em v8_auto_best_jobs
   sempre que uma simulação do lote chega em status=success/simulate_status=not_started.
   O worker v8-auto-best-worker (cron 1/min) consome a fila e roda os candidatos
   de proposta automaticamente — funciona mesmo com a aba fechada.';

-- 2) Tabela de fila de trabalho
CREATE TABLE IF NOT EXISTS public.v8_auto_best_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  simulation_id UUID NOT NULL UNIQUE REFERENCES public.v8_simulations(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.v8_batches(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued',  -- queued | running | done | failed | skipped
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  result_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT v8_auto_best_jobs_status_check
    CHECK (status IN ('queued','running','done','failed','skipped'))
);

CREATE INDEX IF NOT EXISTS idx_v8_auto_best_jobs_status_created
  ON public.v8_auto_best_jobs (status, created_at)
  WHERE status IN ('queued','running');

CREATE INDEX IF NOT EXISTS idx_v8_auto_best_jobs_batch
  ON public.v8_auto_best_jobs (batch_id);

-- 3) Trigger updated_at
CREATE OR REPLACE FUNCTION public.v8_auto_best_jobs_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_v8_auto_best_jobs_updated_at ON public.v8_auto_best_jobs;
CREATE TRIGGER trg_v8_auto_best_jobs_updated_at
  BEFORE UPDATE ON public.v8_auto_best_jobs
  FOR EACH ROW EXECUTE FUNCTION public.v8_auto_best_jobs_set_updated_at();

-- 4) RLS
ALTER TABLE public.v8_auto_best_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Privileged can view auto-best jobs" ON public.v8_auto_best_jobs;
CREATE POLICY "Privileged can view auto-best jobs"
  ON public.v8_auto_best_jobs
  FOR SELECT
  TO authenticated
  USING (public.is_privileged());

-- INSERT/UPDATE/DELETE: apenas service role (sem policy = bloqueado para anon/authenticated).

-- 5) Trigger de enqueue: quando simulação fica success + simulate_status not_started
--    e o batch tem auto_best_enabled = true.
CREATE OR REPLACE FUNCTION public.v8_enqueue_auto_best()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auto_best BOOLEAN;
BEGIN
  -- Só enfileira na transição para success.
  IF NEW.status <> 'success' THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.simulate_status, 'not_started') <> 'not_started' THEN
    RETURN NEW;
  END IF;
  IF NEW.consult_id IS NULL OR NEW.config_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Verifica se o batch quer auto-best.
  SELECT auto_best_enabled INTO v_auto_best
  FROM public.v8_batches
  WHERE id = NEW.batch_id;

  IF COALESCE(v_auto_best, false) IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Idempotente: ON CONFLICT (simulation_id) DO NOTHING.
  INSERT INTO public.v8_auto_best_jobs (simulation_id, batch_id, status)
  VALUES (NEW.id, NEW.batch_id, 'queued')
  ON CONFLICT (simulation_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_v8_enqueue_auto_best ON public.v8_simulations;
CREATE TRIGGER trg_v8_enqueue_auto_best
  AFTER INSERT OR UPDATE OF status, simulate_status
  ON public.v8_simulations
  FOR EACH ROW
  EXECUTE FUNCTION public.v8_enqueue_auto_best();

-- 6) Função para o worker reservar jobs com lock seguro (FOR UPDATE SKIP LOCKED).
CREATE OR REPLACE FUNCTION public.v8_auto_best_claim_jobs(_limit INT DEFAULT 10, _worker_id TEXT DEFAULT 'cron')
RETURNS TABLE (
  job_id UUID,
  simulation_id UUID,
  batch_id UUID,
  cpf TEXT,
  consult_id TEXT,
  config_id UUID,
  margem_valor NUMERIC,
  sim_value_min NUMERIC,
  sim_value_max NUMERIC,
  sim_installments_min INT,
  sim_installments_max INT,
  attempts INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT j.id
    FROM public.v8_auto_best_jobs j
    WHERE j.status = 'queued'
      -- Re-tentar jobs travados há mais de 10 min (worker morreu no meio).
      OR (j.status = 'running' AND j.locked_at < now() - interval '10 minutes')
    ORDER BY j.created_at
    LIMIT _limit
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.v8_auto_best_jobs j
    SET status = 'running',
        locked_at = now(),
        locked_by = _worker_id,
        attempts = j.attempts + 1
    FROM claimed
    WHERE j.id = claimed.id
    RETURNING j.id AS jid, j.simulation_id, j.batch_id, j.attempts
  )
  SELECT
    u.jid AS job_id,
    u.simulation_id,
    u.batch_id,
    s.cpf,
    s.consult_id,
    s.config_id::uuid,
    s.margem_valor,
    s.sim_value_min,
    s.sim_value_max,
    s.sim_installments_min,
    s.sim_installments_max,
    u.attempts
  FROM updated u
  JOIN public.v8_simulations s ON s.id = u.simulation_id
  -- Respeita pause do batch (mesma regra do cliente).
  LEFT JOIN public.v8_batches b ON b.id = u.batch_id
  WHERE COALESCE(b.is_paused, false) = false
    AND COALESCE(b.status, 'running') NOT IN ('canceled','completed');
END;
$$;

REVOKE ALL ON FUNCTION public.v8_auto_best_claim_jobs(INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v8_auto_best_claim_jobs(INT, TEXT) TO service_role;

-- 7) Função para finalizar job (chamada pelo worker).
CREATE OR REPLACE FUNCTION public.v8_auto_best_finish_job(
  _job_id UUID,
  _status TEXT,
  _last_error TEXT DEFAULT NULL,
  _result_summary JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _status NOT IN ('done','failed','skipped','queued') THEN
    RAISE EXCEPTION 'invalid status %', _status;
  END IF;
  UPDATE public.v8_auto_best_jobs
  SET status = _status,
      last_error = _last_error,
      result_summary = COALESCE(_result_summary, result_summary),
      locked_at = CASE WHEN _status = 'queued' THEN NULL ELSE locked_at END,
      locked_by = CASE WHEN _status = 'queued' THEN NULL ELSE locked_by END
  WHERE id = _job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.v8_auto_best_finish_job(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v8_auto_best_finish_job(UUID, TEXT, TEXT, JSONB) TO service_role;