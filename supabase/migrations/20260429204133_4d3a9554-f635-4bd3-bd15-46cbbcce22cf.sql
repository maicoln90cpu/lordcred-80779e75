-- Etapa 4 (Item 10): Fila sequencial de lotes V8.
-- Lotes em status='queued' aguardam o anterior terminar antes de iniciar.
-- O launcher (pg_cron, 1min) promove queued→scheduled quando não há outro lote
-- ativo (processing/scheduled prestes a rodar) do mesmo created_by.

ALTER TABLE public.v8_batches
  ADD COLUMN IF NOT EXISTS queue_position INTEGER,
  ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS queue_owner UUID;

-- Índice para o launcher buscar o próximo da fila por dono.
CREATE INDEX IF NOT EXISTS idx_v8_batches_queue_ready
  ON public.v8_batches (queue_owner, queue_position)
  WHERE status = 'queued';

COMMENT ON COLUMN public.v8_batches.queue_position IS
  'Posição do lote na fila do dono (queue_owner). NULL quando não está em fila. Etapa 4.';
COMMENT ON COLUMN public.v8_batches.queue_owner IS
  'created_by do dono da fila. Cada operador tem fila independente. Etapa 4.';