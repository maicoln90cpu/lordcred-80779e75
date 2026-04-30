-- Faxina única: destrava lotes V8 zumbis que bloqueiam a fila
-- 1) Sem pendentes há > 30 min => completed
UPDATE public.v8_batches b
SET status = 'completed',
    completed_at = COALESCE(completed_at, now()),
    updated_at = now()
WHERE b.status = 'processing'
  AND b.updated_at < now() - interval '30 minutes'
  AND COALESCE(b.pending_count, 0) = 0;

-- 2) Com pendentes mas atualizado há > 2 horas => completed (zumbi)
UPDATE public.v8_batches b
SET status = 'completed',
    completed_at = COALESCE(completed_at, now()),
    updated_at = now()
WHERE b.status = 'processing'
  AND b.updated_at < now() - interval '2 hours';