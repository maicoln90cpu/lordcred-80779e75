
-- =====================================================
-- COMISSÕES PARCEIROS — 4 tabelas + trigger de cálculo
-- =====================================================

-- 1. Taxas FGTS
CREATE TABLE public.commission_rates_fgts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_date date NOT NULL,
  bank text NOT NULL,
  rate_no_insurance numeric NOT NULL DEFAULT 0,
  rate_with_insurance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_rates_fgts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read fgts rates" ON public.commission_rates_fgts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage fgts rates" ON public.commission_rates_fgts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'master') OR has_role(auth.uid(), 'admin'));

-- 2. Taxas CLT
CREATE TABLE public.commission_rates_clt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_date date NOT NULL,
  bank text NOT NULL,
  term_min integer NOT NULL DEFAULT 0,
  term_max integer NOT NULL DEFAULT 999,
  has_insurance boolean NOT NULL DEFAULT false,
  rate numeric NOT NULL DEFAULT 0,
  obs text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_rates_clt ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read clt rates" ON public.commission_rates_clt
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage clt rates" ON public.commission_rates_clt
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'master') OR has_role(auth.uid(), 'admin'));

-- 3. Seller PIX
CREATE TABLE public.seller_pix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  pix_key text NOT NULL,
  pix_type text NOT NULL DEFAULT 'cpf',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seller_pix ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read pix" ON public.seller_pix
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner can manage own pix" ON public.seller_pix
  FOR ALL TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());
CREATE POLICY "Admins can manage all pix" ON public.seller_pix
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'support'))
  WITH CHECK (has_role(auth.uid(), 'master') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'support'));

-- 4. Commission Sales (Base)
CREATE TABLE public.commission_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_date timestamptz NOT NULL,
  product text NOT NULL,
  bank text NOT NULL,
  term integer,
  released_value numeric NOT NULL DEFAULT 0,
  has_insurance boolean NOT NULL DEFAULT false,
  client_cpf text,
  client_name text,
  client_phone text,
  seller_id uuid NOT NULL,
  external_proposal_id text,
  commission_rate numeric DEFAULT 0,
  commission_value numeric DEFAULT 0,
  week_label text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view own sales" ON public.commission_sales
  FOR SELECT TO authenticated USING (seller_id = auth.uid());
CREATE POLICY "Admins can manage all sales" ON public.commission_sales
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'support'))
  WITH CHECK (has_role(auth.uid(), 'master') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'support'));

-- 5. Trigger: calcula comissão e week_label automaticamente
CREATE OR REPLACE FUNCTION public.calculate_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _rate numeric := 0;
  _sale_date date;
  _week_start date;
  _week_end date;
  _week_num integer;
  _month_name text;
BEGIN
  _sale_date := NEW.sale_date::date;

  -- Calculate week label (Sunday-Saturday)
  _week_start := _sale_date - ((extract(dow from _sale_date)::int + 1) % 7);
  _week_end := _week_start + 6;
  _week_num := ceil(extract(day from _week_end)::numeric / 7.0)::integer;
  _month_name := to_char(_week_end, 'TMMonth');

  NEW.week_label := to_char(_week_start, 'DD/MM') || ' a ' || to_char(_week_end, 'DD/MM') || ' - Semana ' || _week_num || ' ' || _month_name;

  -- Calculate commission rate
  IF NEW.product = 'FGTS' THEN
    SELECT CASE WHEN NEW.has_insurance THEN rate_with_insurance ELSE rate_no_insurance END
    INTO _rate
    FROM commission_rates_fgts
    WHERE bank = NEW.bank AND effective_date <= _sale_date
    ORDER BY effective_date DESC
    LIMIT 1;
  ELSIF NEW.product = 'Crédito do Trabalhador' THEN
    SELECT rate
    INTO _rate
    FROM commission_rates_clt
    WHERE bank = NEW.bank
      AND has_insurance = NEW.has_insurance
      AND term_min <= COALESCE(NEW.term, 0)
      AND term_max >= COALESCE(NEW.term, 0)
      AND effective_date <= _sale_date
    ORDER BY effective_date DESC
    LIMIT 1;
  END IF;

  NEW.commission_rate := COALESCE(_rate, 0);
  NEW.commission_value := ROUND(NEW.released_value * COALESCE(_rate, 0) / 100, 2);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calculate_commission
  BEFORE INSERT OR UPDATE ON public.commission_sales
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_commission();
