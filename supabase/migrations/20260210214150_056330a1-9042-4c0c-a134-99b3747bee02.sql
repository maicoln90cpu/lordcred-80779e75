
-- Add provider columns to system_settings
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS whatsapp_provider TEXT NOT NULL DEFAULT 'evolution',
ADD COLUMN IF NOT EXISTS provider_api_url TEXT,
ADD COLUMN IF NOT EXISTS provider_api_key TEXT;

-- Add instance token to chips (for UazAPI per-instance auth)
ALTER TABLE public.chips 
ADD COLUMN IF NOT EXISTS instance_token TEXT;
