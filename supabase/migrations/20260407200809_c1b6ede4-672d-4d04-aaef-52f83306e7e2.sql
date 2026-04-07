ALTER TABLE public.commission_settings
  ADD COLUMN IF NOT EXISTS monthly_goal_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_goal_type text NOT NULL DEFAULT 'contratos';