ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS meta_app_secret text,
  ADD COLUMN IF NOT EXISTS meta_webhook_secret text;