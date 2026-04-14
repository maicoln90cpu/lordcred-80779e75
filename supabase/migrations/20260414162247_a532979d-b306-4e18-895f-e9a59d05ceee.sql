-- Add A/B testing columns to broadcast_campaigns
ALTER TABLE public.broadcast_campaigns
ADD COLUMN IF NOT EXISTS message_variant_b TEXT,
ADD COLUMN IF NOT EXISTS ab_enabled BOOLEAN NOT NULL DEFAULT false;