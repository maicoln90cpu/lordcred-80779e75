
-- Add conversation close fields
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS closed_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS closed_reason text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES auth.users(id) DEFAULT NULL;

-- Index for filtering closed conversations
CREATE INDEX IF NOT EXISTS idx_conversations_closed_at ON public.conversations (closed_at)
  WHERE closed_at IS NOT NULL;

-- Function to auto-close Meta conversations inactive > 24h
CREATE OR REPLACE FUNCTION public.auto_close_inactive_meta_conversations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  closed_count int;
BEGIN
  UPDATE conversations c
  SET closed_at = now(),
      closed_reason = 'Janela de 24h expirada (automático)',
      closed_by = NULL
  FROM chips ch
  WHERE c.chip_id = ch.id
    AND ch.provider = 'meta'
    AND c.closed_at IS NULL
    AND c.last_message_at IS NOT NULL
    AND c.last_message_at < (now() - interval '24 hours');

  GET DIAGNOSTICS closed_count = ROW_COUNT;
  RAISE LOG 'auto_close_inactive_meta_conversations: fechou % conversas', closed_count;
END;
$$;
