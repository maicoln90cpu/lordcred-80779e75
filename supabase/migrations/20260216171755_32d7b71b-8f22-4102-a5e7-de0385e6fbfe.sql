
-- Add nickname column to chips table
ALTER TABLE public.chips ADD COLUMN nickname TEXT NULL;

-- Add auto phase progression settings
ALTER TABLE public.system_settings ADD COLUMN auto_phase_progression BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.system_settings ADD COLUMN days_phase_novo INTEGER NOT NULL DEFAULT 3;
ALTER TABLE public.system_settings ADD COLUMN days_phase_iniciante INTEGER NOT NULL DEFAULT 5;
ALTER TABLE public.system_settings ADD COLUMN days_phase_crescimento INTEGER NOT NULL DEFAULT 7;
ALTER TABLE public.system_settings ADD COLUMN days_phase_aquecido INTEGER NOT NULL DEFAULT 10;
