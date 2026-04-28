-- =============================================================================
-- ETAPA 2 / Item 4 — Conserta lotes V8 travados em "processing"
-- =============================================================================

-- 1) Função que recalcula os contadores do batch a partir das simulações reais
--    e fecha o lote se não houver nenhuma pendente.
CREATE OR REPLACE FUNCTION public.v8_recalc_batch_counters(_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _ok int;
  _fail int;
  _pend int;
  _total int;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE status = 'success'),
    COUNT(*) FILTER (WHERE status = 'failed'),
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*)
  INTO _ok, _fail, _pend, _total
  FROM v8_simulations
  WHERE batch_id = _batch_id;

  UPDATE v8_batches
  SET success_count = _ok,
      failure_count = _fail,
      -- pending_count nunca pode ser menor que o real
      pending_count = GREATEST(_pend, 0),
      updated_at = now(),
      status = CASE
        WHEN _pend <= 0 AND COALESCE(_total, 0) > 0 THEN 'completed'
        ELSE status
      END,
      completed_at = CASE
        WHEN _pend <= 0 AND COALESCE(_total, 0) > 0 AND completed_at IS NULL THEN now()
        ELSE completed_at
      END
  WHERE id = _batch_id;
END;
$$;

-- 2) Trigger function: dispara o recálculo sempre que uma simulação muda de status
CREATE OR REPLACE FUNCTION public.v8_simulations_after_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Só recalcula em mudanças relevantes
  IF TG_OP = 'INSERT' THEN
    PERFORM v8_recalc_batch_counters(NEW.batch_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND COALESCE(OLD.status,'') IS DISTINCT FROM COALESCE(NEW.status,'') THEN
    PERFORM v8_recalc_batch_counters(NEW.batch_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM v8_recalc_batch_counters(OLD.batch_id);
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- 3) Cria a trigger (substitui se já existir)
DROP TRIGGER IF EXISTS trg_v8_sim_recalc_batch ON public.v8_simulations;
CREATE TRIGGER trg_v8_sim_recalc_batch
AFTER INSERT OR UPDATE OF status OR DELETE
ON public.v8_simulations
FOR EACH ROW
EXECUTE FUNCTION public.v8_simulations_after_status_change();

-- 4) Cleanup retroativo dos 13 lotes presos.
--    Critério SEGURO: só fecha lotes onde TODAS as simulações já têm status final
--    (success ou failed) e não há nenhuma realmente em 'pending' no banco.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT b.id
    FROM v8_batches b
    WHERE b.status = 'processing'
      AND b.created_at < now() - interval '6 hours'
      AND NOT EXISTS (
        SELECT 1 FROM v8_simulations s
        WHERE s.batch_id = b.id AND s.status = 'pending'
      )
  LOOP
    PERFORM v8_recalc_batch_counters(r.id);
    -- Garante o fechamento mesmo se total=0 (lotes vazios/abandonados antigos)
    UPDATE v8_batches
       SET status = 'completed',
           pending_count = 0,
           completed_at = COALESCE(completed_at, now()),
           updated_at = now()
     WHERE id = r.id AND status = 'processing';
  END LOOP;
END $$;

-- 5) Índice pra acelerar o recálculo (idempotente)
CREATE INDEX IF NOT EXISTS idx_v8_simulations_batch_status
  ON public.v8_simulations (batch_id, status);