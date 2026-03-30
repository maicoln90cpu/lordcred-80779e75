
-- Add 'manager' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';

-- Add allowed_roles column to feature_permissions
ALTER TABLE public.feature_permissions 
  ADD COLUMN IF NOT EXISTS allowed_roles text[] NOT NULL DEFAULT '{}';
