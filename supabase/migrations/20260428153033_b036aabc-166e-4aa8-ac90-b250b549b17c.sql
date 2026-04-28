ALTER TABLE public.v8_batches
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS canceled_by uuid;

CREATE INDEX IF NOT EXISTS v8_batches_status_idx ON public.v8_batches (status);

COMMENT ON COLUMN public.v8_batches.canceled_at IS 'Quando o operador clicou em "Cancelar lote". Status passa para canceled.';
COMMENT ON COLUMN public.v8_batches.canceled_by IS 'Quem cancelou (auth.uid). Pode ser o dono do lote ou um usuário privilegiado.';