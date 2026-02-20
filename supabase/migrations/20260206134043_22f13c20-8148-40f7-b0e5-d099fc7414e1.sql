
-- Add warming_phase column to chips
ALTER TABLE public.chips ADD COLUMN warming_phase TEXT NOT NULL DEFAULT 'novo';

-- Add new limit columns to system_settings
ALTER TABLE public.system_settings 
  ADD COLUMN messages_day_novo INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN messages_day_aquecido INTEGER NOT NULL DEFAULT 80;
