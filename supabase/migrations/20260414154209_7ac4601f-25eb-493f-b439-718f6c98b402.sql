
-- Add media support columns
ALTER TABLE public.broadcast_campaigns
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS media_filename text;

-- Add scheduling column
ALTER TABLE public.broadcast_campaigns
  ADD COLUMN IF NOT EXISTS scheduled_date timestamptz;

-- Add source tracking columns
ALTER TABLE public.broadcast_campaigns
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_filters jsonb;

-- Add owner user id (who owns the chip being used)
ALTER TABLE public.broadcast_campaigns
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id);

-- Add comment for documentation
COMMENT ON COLUMN public.broadcast_campaigns.media_type IS 'image | document | null';
COMMENT ON COLUMN public.broadcast_campaigns.source_type IS 'manual | leads | csv';
COMMENT ON COLUMN public.broadcast_campaigns.source_filters IS 'JSON with lead filters used for audit trail';
COMMENT ON COLUMN public.broadcast_campaigns.owner_user_id IS 'User who owns the selected chip';
