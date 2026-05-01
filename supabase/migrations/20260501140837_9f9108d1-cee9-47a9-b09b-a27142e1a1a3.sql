ALTER TABLE public.broadcast_campaigns
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'uazapi',
  ADD COLUMN IF NOT EXISTS meta_template_id uuid REFERENCES public.meta_message_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS meta_template_name text,
  ADD COLUMN IF NOT EXISTS meta_template_language text,
  ADD COLUMN IF NOT EXISTS meta_template_components jsonb;

COMMENT ON COLUMN public.broadcast_campaigns.provider IS 'Provider used to send: uazapi (free text) or meta (template only)';
COMMENT ON COLUMN public.broadcast_campaigns.meta_template_components IS 'Filled template components array sent to Meta Graph API (header/body parameters)';

-- Backfill provider based on chip's provider for existing campaigns
UPDATE public.broadcast_campaigns bc
SET provider = COALESCE(c.provider, 'uazapi')
FROM public.chips c
WHERE bc.chip_id = c.id AND bc.provider = 'uazapi' AND c.provider = 'meta';