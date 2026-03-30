
-- Commission settings singleton table
CREATE TABLE public.commission_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_day integer NOT NULL DEFAULT 5, -- 0=Dom, 1=Seg, ..., 5=Sex, 6=Sab
  payment_day integer NOT NULL DEFAULT 4, -- 0=Dom, ..., 4=Qui
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Insert default row (sexta = 5)
INSERT INTO public.commission_settings (week_start_day, payment_day) VALUES (5, 4);

-- RLS
ALTER TABLE public.commission_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read commission settings"
  ON public.commission_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage commission settings"
  ON public.commission_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Update trigger for calculate_commission to use dynamic week_start_day
CREATE OR REPLACE FUNCTION public.calculate_commission()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  _rate numeric := 0;
  _sale_date date;
  _week_start date;
  _week_end date;
  _week_num integer;
  _month_name text;
  _start_day integer;
BEGIN
  _sale_date := NEW.sale_date::date;

  -- Get configurable week start day (default 0 = Sunday)
  SELECT COALESCE(week_start_day, 0) INTO _start_day FROM commission_settings LIMIT 1;

  -- Calculate week start based on configured day
  _week_start := _sale_date - ((extract(dow from _sale_date)::int - _start_day + 7) % 7);
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
$function$;
