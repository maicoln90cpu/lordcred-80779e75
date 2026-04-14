
ALTER TABLE public.chips ADD COLUMN IF NOT EXISTS broadcast_daily_limit INTEGER NOT NULL DEFAULT 200;

ALTER TABLE public.broadcast_campaigns ADD COLUMN IF NOT EXISTS overflow_chip_ids UUID[] DEFAULT '{}';
