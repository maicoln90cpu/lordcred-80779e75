-- Add per-chip Meta access token for Multi-BM support
ALTER TABLE public.chips
ADD COLUMN IF NOT EXISTS meta_access_token TEXT DEFAULT NULL;

-- Add comment explaining usage
COMMENT ON COLUMN public.chips.meta_access_token IS 'Optional per-chip Meta access token for Multi-BM. When set, takes priority over global system_settings token.';
