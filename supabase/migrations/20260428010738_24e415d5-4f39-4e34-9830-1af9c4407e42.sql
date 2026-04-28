-- Etapa 2 V8: notificação sonora opcional + default error_kind='analysis_pending'
ALTER TABLE public.v8_settings
  ADD COLUMN IF NOT EXISTS sound_on_complete boolean NOT NULL DEFAULT false;