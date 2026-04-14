
-- Add delivery tracking columns to broadcast_recipients
ALTER TABLE public.broadcast_recipients
  ADD COLUMN IF NOT EXISTS message_id TEXT,
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS replied BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;

-- Index for cross-reference lookup in evolution-webhook
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_message_id
  ON public.broadcast_recipients(message_id) WHERE message_id IS NOT NULL;

-- Index for reply detection (phone + recent campaigns)
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_phone_status
  ON public.broadcast_recipients(phone, status) WHERE status = 'sent';
