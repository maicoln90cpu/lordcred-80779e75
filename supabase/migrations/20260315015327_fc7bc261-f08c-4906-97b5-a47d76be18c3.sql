
-- Add 'support' to the app_role enum (must be committed alone before use)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support';
