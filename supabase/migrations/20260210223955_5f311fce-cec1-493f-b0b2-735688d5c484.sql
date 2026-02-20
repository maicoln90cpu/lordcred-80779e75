
ALTER TABLE public.system_settings
ADD COLUMN IF NOT EXISTS evolution_api_url TEXT,
ADD COLUMN IF NOT EXISTS evolution_api_key TEXT,
ADD COLUMN IF NOT EXISTS uazapi_api_url TEXT,
ADD COLUMN IF NOT EXISTS uazapi_api_key TEXT;

-- Copy current values to the correct provider columns based on active provider
UPDATE public.system_settings
SET 
  evolution_api_url = CASE WHEN whatsapp_provider = 'evolution' THEN provider_api_url ELSE evolution_api_url END,
  evolution_api_key = CASE WHEN whatsapp_provider = 'evolution' THEN provider_api_key ELSE evolution_api_key END,
  uazapi_api_url = CASE WHEN whatsapp_provider = 'uazapi' THEN provider_api_url ELSE uazapi_api_url END,
  uazapi_api_key = CASE WHEN whatsapp_provider = 'uazapi' THEN provider_api_key ELSE uazapi_api_key END;
