ALTER TABLE public.commission_sales_v2
  ADD COLUMN IF NOT EXISTS rate_match_level text;

CREATE OR REPLACE FUNCTION public.calculate_commission_v2()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _rate numeric := 0;
  _rate_specific numeric := 0;
  _rate_generic numeric := 0;
  _rate_fallback numeric := 0;
  _match_level text := 'none';
  _sale_date date;
  _week_start date;
  _week_end date;
  _week_num integer;
  _month_name text;
  _start_day integer;
  _bonus_threshold numeric;
  _bonus_rate numeric;
  _bonus_mode text;
  _bonus_fixed_value numeric;
  _weekly_total numeric;
  _weekly_count integer;
  _bonus_val numeric := 0;
  _table_key text := NULL;
  _table_name_upper text;
  _bank_upper text;
  _is_hub boolean;
BEGIN
  _sale_date := (NEW.sale_date AT TIME ZONE 'America/Sao_Paulo')::date;

  SELECT COALESCE(week_start_day, 0), bonus_threshold, COALESCE(bonus_rate, 0),
         COALESCE(bonus_mode, 'valor'), COALESCE(bonus_fixed_value, 0)
  INTO _start_day, _bonus_threshold, _bonus_rate, _bonus_mode, _bonus_fixed_value
  FROM commission_settings_v2 LIMIT 1;

  _start_day := COALESCE(_start_day, 0);
  _week_start := _sale_date - ((extract(dow from _sale_date)::int - _start_day + 7) % 7);
  _week_end := _week_start + 6;
  _week_num := ceil(extract(day from _week_end)::numeric / 7.0)::integer;
  _month_name := to_char(_week_end, 'TMMonth');

  NEW.week_label := to_char(_week_start, 'DD/MM') || ' a ' || to_char(_week_end, 'DD/MM') || ' - Semana ' || _week_num || ' ' || _month_name;

  _table_name_upper := UPPER(COALESCE(NEW.table_name, ''));
  _bank_upper := UPPER(COALESCE(NEW.bank, ''));
  _is_hub := (_bank_upper LIKE '%HUB%');

  IF _table_name_upper LIKE '%SONHO%' THEN _table_key := 'SONHO';
  ELSIF _table_name_upper LIKE '%FOCO%' THEN _table_key := 'FOCO';
  ELSIF _table_name_upper LIKE '%CARTADA%' THEN _table_key := 'CARTADA';
  ELSIF _table_name_upper LIKE '%CARTA NA MANGA%' OR _table_name_upper LIKE '%CARTA%MANGA%' THEN _table_key := 'CARTA NA MANGA';
  ELSIF _table_name_upper LIKE '%GOLD PLUS%' THEN _table_key := 'GOLD PLUS';
  ELSIF _table_name_upper LIKE '%GOLD POWER%' OR _table_name_upper LIKE '%POWER%' THEN _table_key := 'GOLD POWER';
  ELSIF _table_name_upper LIKE '%PARANA TURBO%' OR _table_name_upper LIKE '%PARANÁ TURBO%' OR _table_name_upper LIKE '%TURBO%' THEN _table_key := 'PARANA TURBO';
  ELSIF _table_name_upper LIKE '%PARANA%' OR _table_name_upper LIKE '%PARANÁ%' THEN _table_key := 'PARANA';
  ELSIF _table_name_upper LIKE '%FACTA%SAQUE%' OR _table_name_upper LIKE '%SAQUE%' THEN _table_key := 'FACTA SAQUE';
  ELSIF _table_name_upper LIKE '%FACTA%NOVO%' OR _table_name_upper LIKE '%NOVO%' THEN _table_key := 'FACTA NOVO';
  ELSIF _table_name_upper LIKE '%FACTA%AGENDADO%' OR _table_name_upper LIKE '%AGENDADO%' THEN _table_key := 'FACTA AGENDADO';
  ELSIF _table_name_upper LIKE '%LOTUS 1%' OR _table_name_upper LIKE '%1+%' THEN _table_key := 'LOTUS 1+';
  ELSIF _table_name_upper LIKE '%LOTUS 2%' OR _table_name_upper LIKE '%2+%' THEN _table_key := 'LOTUS 2+';
  ELSIF _table_name_upper LIKE '%LOTUS 3%' OR _table_name_upper LIKE '%3+%' THEN _table_key := 'LOTUS 3+';
  ELSIF _table_name_upper LIKE '%LOTUS 4%' OR _table_name_upper LIKE '%4+%' THEN _table_key := 'LOTUS 4+';
  ELSIF _table_name_upper LIKE '%9 PARCELA%' OR _table_name_upper LIKE '%9PARCELA%' THEN _table_key := '9 Parcela';
  ELSIF _table_name_upper LIKE '%6 PARCELA%' OR _table_name_upper LIKE '%6PARCELA%' THEN _table_key := '6 Parcela';
  ELSIF _table_name_upper LIKE '%4 PARCELA%' OR _table_name_upper LIKE '%4PARCELA%' THEN _table_key := '4 Parcela';
  ELSIF _table_name_upper LIKE '%2 PARCELA%' OR _table_name_upper LIKE '%2PARCELA%' THEN _table_key := '2 Parcela';
  END IF;

  IF NEW.product = 'FGTS' THEN
    IF _table_key IS NOT NULL THEN
      SELECT rate INTO _rate_specific
      FROM commission_rates_fgts_v2
      WHERE UPPER(bank) = _bank_upper
        AND table_key = _table_key
        AND has_insurance = NEW.has_insurance
        AND term_min <= COALESCE(NEW.term, 0)
        AND term_max >= COALESCE(NEW.term, 0)
        AND min_value <= COALESCE(NEW.released_value, 0)
        AND max_value >= COALESCE(NEW.released_value, 0)
        AND effective_date <= _sale_date
      ORDER BY effective_date DESC LIMIT 1;
    END IF;

    SELECT rate INTO _rate_generic
    FROM commission_rates_fgts_v2
    WHERE UPPER(bank) = _bank_upper
      AND table_key IS NULL
      AND has_insurance = NEW.has_insurance
      AND term_min <= COALESCE(NEW.term, 0)
      AND term_max >= COALESCE(NEW.term, 0)
      AND min_value <= COALESCE(NEW.released_value, 0)
      AND max_value >= COALESCE(NEW.released_value, 0)
      AND effective_date <= _sale_date
    ORDER BY effective_date DESC LIMIT 1;

    SELECT rate INTO _rate_fallback
    FROM commission_rates_fgts_v2
    WHERE UPPER(bank) = _bank_upper
      AND has_insurance = NEW.has_insurance
      AND effective_date <= _sale_date
    ORDER BY effective_date DESC LIMIT 1;

    IF COALESCE(_rate_specific, 0) > 0 THEN
      _rate := _rate_specific; _match_level := 'specific';
    ELSIF COALESCE(_rate_generic, 0) > 0 THEN
      _rate := _rate_generic; _match_level := 'generic';
    ELSIF COALESCE(_rate_fallback, 0) > 0 THEN
      _rate := _rate_fallback; _match_level := 'fallback';
    ELSE
      _rate := 0; _match_level := 'none';
    END IF;

  ELSIF NEW.product = 'Crédito do Trabalhador' THEN
    IF _table_key IS NOT NULL THEN
      SELECT rate INTO _rate_specific
      FROM commission_rates_clt_v2
      WHERE UPPER(bank) = _bank_upper
        AND table_key = _table_key
        AND (CASE WHEN _is_hub THEN true ELSE has_insurance = NEW.has_insurance END)
        AND term_min <= COALESCE(NEW.term, 0)
        AND term_max >= COALESCE(NEW.term, 0)
        AND min_value <= COALESCE(NEW.released_value, 0)
        AND max_value >= COALESCE(NEW.released_value, 0)
        AND effective_date <= _sale_date
      ORDER BY effective_date DESC LIMIT 1;
    END IF;

    SELECT rate INTO _rate_generic
    FROM commission_rates_clt_v2
    WHERE UPPER(bank) = _bank_upper
      AND table_key IS NULL
      AND (CASE WHEN _is_hub THEN true ELSE has_insurance = NEW.has_insurance END)
      AND term_min <= COALESCE(NEW.term, 0)
      AND term_max >= COALESCE(NEW.term, 0)
      AND min_value <= COALESCE(NEW.released_value, 0)
      AND max_value >= COALESCE(NEW.released_value, 0)
      AND effective_date <= _sale_date
    ORDER BY effective_date DESC LIMIT 1;

    IF COALESCE(_rate_specific, 0) > 0 THEN
      _rate := _rate_specific; _match_level := 'specific';
    ELSIF COALESCE(_rate_generic, 0) > 0 THEN
      _rate := _rate_generic; _match_level := 'generic';
    ELSE
      _rate := 0; _match_level := 'none';
    END IF;
  END IF;

  NEW.commission_rate := COALESCE(_rate, 0);
  NEW.commission_value := ROUND(NEW.released_value * COALESCE(_rate, 0) / 100, 2);
  NEW.rate_match_level := _match_level;

  IF _bonus_threshold IS NOT NULL AND _bonus_threshold > 0 THEN
    IF _bonus_mode = 'contratos' THEN
      SELECT COUNT(*) INTO _weekly_count
      FROM commission_sales_v2
      WHERE seller_id = NEW.seller_id
        AND week_label = NEW.week_label
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
      _weekly_count := _weekly_count + 1;
      IF _weekly_count >= _bonus_threshold::integer THEN
        IF _bonus_fixed_value > 0 THEN _bonus_val := _bonus_fixed_value;
        ELSIF _bonus_rate > 0 THEN _bonus_val := ROUND(NEW.released_value * _bonus_rate / 100, 2);
        END IF;
        NEW.commission_value := NEW.commission_value + _bonus_val;
      END IF;
    ELSE
      SELECT COALESCE(SUM(released_value), 0) INTO _weekly_total
      FROM commission_sales_v2
      WHERE seller_id = NEW.seller_id
        AND week_label = NEW.week_label
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
      _weekly_total := _weekly_total + NEW.released_value;
      IF _weekly_total > _bonus_threshold THEN
        IF _bonus_fixed_value > 0 THEN _bonus_val := _bonus_fixed_value;
        ELSIF _bonus_rate > 0 THEN _bonus_val := ROUND(NEW.released_value * _bonus_rate / 100, 2);
        END IF;
        NEW.commission_value := NEW.commission_value + _bonus_val;
      END IF;
    END IF;
  END IF;

  NEW.bonus_value := _bonus_val;
  RETURN NEW;
END;
$function$;