
-- Add bonus_value column to commission_sales
ALTER TABLE public.commission_sales ADD COLUMN IF NOT EXISTS bonus_value numeric DEFAULT 0;

-- Update calculate_commission trigger to include automatic bonus
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
  _bonus_threshold numeric;
  _bonus_rate numeric;
  _weekly_total numeric;
  _bonus_val numeric := 0;
BEGIN
  _sale_date := NEW.sale_date::date;

  -- Get configurable week start day (default 0 = Sunday)
  SELECT COALESCE(week_start_day, 0), bonus_threshold, COALESCE(bonus_rate, 0)
  INTO _start_day, _bonus_threshold, _bonus_rate
  FROM commission_settings LIMIT 1;

  _start_day := COALESCE(_start_day, 0);

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

  -- Automatic bonus calculation
  IF _bonus_threshold IS NOT NULL AND _bonus_threshold > 0 AND _bonus_rate > 0 THEN
    -- Sum weekly released_value for this seller (excluding current row if update)
    SELECT COALESCE(SUM(released_value), 0) INTO _weekly_total
    FROM commission_sales
    WHERE seller_id = NEW.seller_id
      AND week_label = NEW.week_label
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    -- Add current row's value
    _weekly_total := _weekly_total + NEW.released_value;

    -- If total exceeds threshold, apply bonus on this sale
    IF _weekly_total > _bonus_threshold THEN
      _bonus_val := ROUND(NEW.released_value * _bonus_rate / 100, 2);
      NEW.commission_value := NEW.commission_value + _bonus_val;
    END IF;
  END IF;

  NEW.bonus_value := _bonus_val;

  RETURN NEW;
END;
$function$;
