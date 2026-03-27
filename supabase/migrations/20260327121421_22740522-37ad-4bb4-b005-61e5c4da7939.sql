ALTER TABLE public.client_leads ADD COLUMN IF NOT EXISTS assigned_at timestamptz DEFAULT now();

UPDATE public.client_leads SET assigned_at = created_at WHERE assigned_at IS NULL OR assigned_at = now();