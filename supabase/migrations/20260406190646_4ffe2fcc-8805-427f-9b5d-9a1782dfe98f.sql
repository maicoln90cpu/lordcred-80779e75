
-- Create bonus tiers table for tiered monthly bonuses
CREATE TABLE public.commission_bonus_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_contracts integer NOT NULL DEFAULT 0,
  bonus_value numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.commission_bonus_tiers ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated can read bonus tiers"
  ON public.commission_bonus_tiers FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Privileged can manage bonus tiers"
  ON public.commission_bonus_tiers FOR ALL
  TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_commission_bonus_tiers_updated_at
  BEFORE UPDATE ON public.commission_bonus_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default tiers from the user's image
INSERT INTO public.commission_bonus_tiers (min_contracts, bonus_value) VALUES
  (10, 200),
  (20, 400),
  (40, 800),
  (60, 1000),
  (100, 2000);
