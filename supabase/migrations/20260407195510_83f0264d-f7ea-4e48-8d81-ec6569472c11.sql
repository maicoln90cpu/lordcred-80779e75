
CREATE TABLE public.commission_annual_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_contracts integer NOT NULL DEFAULT 0,
  reward_description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_annual_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read annual rewards"
  ON public.commission_annual_rewards FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Privileged can manage annual rewards"
  ON public.commission_annual_rewards FOR ALL
  TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

INSERT INTO public.commission_annual_rewards (min_contracts, reward_description, sort_order) VALUES
  (250, 'Final de semana em hotel/resort', 1),
  (500, 'iPhone', 2),
  (1000, 'Viagem de cruzeiro', 3);
