
-- Inserir 21 novas taxas CLT do Banco C6 com vigência 07/04/2026
INSERT INTO commission_rates_clt (bank, effective_date, has_insurance, table_key, term_min, term_max, rate, obs) VALUES
('Banco C6', '2026-04-07', false, NULL, 6, 6, 1.50, 'Todos'),
('Banco C6', '2026-04-07', false, NULL, 9, 9, 1.50, 'Todos'),
('Banco C6', '2026-04-07', false, NULL, 12, 12, 2.00, 'Normal'),
('Banco C6', '2026-04-07', false, NULL, 18, 18, 2.20, 'Normal'),
('Banco C6', '2026-04-07', false, NULL, 24, 24, 2.50, 'Normal'),
('Banco C6', '2026-04-07', false, NULL, 36, 48, 2.70, 'Normal 36-48'),
('Banco C6', '2026-04-07', true, '4 Parcela', 12, 12, 2.20, '4 parcelas'),
('Banco C6', '2026-04-07', true, '4 Parcela', 18, 18, 2.60, '4 parcelas'),
('Banco C6', '2026-04-07', true, '4 Parcela', 24, 24, 2.90, '4 parcelas'),
('Banco C6', '2026-04-07', true, '4 Parcela', 36, 36, 3.10, '4 parcelas'),
('Banco C6', '2026-04-07', true, '4 Parcela', 48, 48, 3.40, '4 parcelas'),
('Banco C6', '2026-04-07', true, '6 Parcela', 12, 12, 2.20, '6 parcelas'),
('Banco C6', '2026-04-07', true, '6 Parcela', 18, 18, 2.70, '6 parcelas'),
('Banco C6', '2026-04-07', true, '6 Parcela', 24, 24, 3.00, '6 parcelas'),
('Banco C6', '2026-04-07', true, '6 Parcela', 36, 36, 3.20, '6 parcelas'),
('Banco C6', '2026-04-07', true, '6 Parcela', 48, 48, 3.50, '6 parcelas'),
('Banco C6', '2026-04-07', true, '9 Parcela', 12, 12, 2.40, '9 parcelas'),
('Banco C6', '2026-04-07', true, '9 Parcela', 18, 18, 2.90, '9 parcelas'),
('Banco C6', '2026-04-07', true, '9 Parcela', 24, 24, 3.20, '9 parcelas'),
('Banco C6', '2026-04-07', true, '9 Parcela', 36, 36, 3.40, '9 parcelas'),
('Banco C6', '2026-04-07', true, '9 Parcela', 48, 48, 3.60, '9 parcelas');

-- Atualizar trigger calculate_commission para reconhecer 6 Parcela e 9 Parcela
CREATE OR REPLACE FUNCTION public.calculate_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _rate numeric := 0;
  _rate_specific numeric := 0;
  _rate_generic numeric := 0;
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
  _is_hub boolean;
BEGIN
  _sale_date := (NEW.sale_date AT TIME ZONE 'America/Sao_Paulo')::date;

  SELECT COALESCE(week_start_day, 0), bonus_threshold, COALESCE(bonus_rate, 0),
         COALESCE(bonus_mode, 'valor'), COALESCE(bonus_fixed_value, 0)
  INTO _start_day, _bonus_threshold, _bonus_rate, _bonus_mode, _bonus_fixed_value
  FROM commission_settings LIMIT 1;

  _start_day := COALESCE(_start_day, 0);

  _week_start := _sale_date - ((extract(dow from _sale_date)::int - _start_day + 7) % 7);
  _week_end := _week_start + 6;
  _week_num := ceil(extract(day from _week_end)::numeric / 7.0)::integer;
  _month_name := to_char(_week_end, 'TMMonth');

  NEW.week_label := to_char(_week_start, 'DD/MM') || ' a ' || to_char(_week_end, 'DD/MM') || ' - Semana ' || _week_num || ' ' || _month_name;

  -- Extract table_key from table_name
  _table_name_upper := UPPER(COALESCE(NEW.table_name, ''));
  _is_hub := (UPPER(NEW.bank) LIKE '%HUB%');

  IF _table_name_upper LIKE '%SONHO%' THEN _table_key := 'SONHO';
  ELSIF _table_name_upper LIKE '%FOCO%' THEN _table_key := 'FOCO';
  ELSIF _table_name_upper LIKE '%CARTADA%' THEN _table_key := 'CARTADA';
  ELSIF _table_name_upper LIKE '%9 PARCELA%' OR _table_name_upper LIKE '%9 PARCEIRO%' OR _table_name_upper LIKE '%9PARCELA%' THEN _table_key := '9 Parcela';
  ELSIF _table_name_upper LIKE '%6 PARCELA%' OR _table_name_upper LIKE '%6 PARCEIRO%' OR _table_name_upper LIKE '%6PARCELA%' THEN _table_key := '6 Parcela';
  ELSIF _table_name_upper LIKE '%4 PARCELA%' OR _table_name_upper LIKE '%4 PARCEIRO%' OR _table_name_upper LIKE '%4PARCELA%' THEN _table_key := '4 Parcela';
  ELSIF _table_name_upper LIKE '%2 PARCELA%' OR _table_name_upper LIKE '%2 PARCEIRO%' OR _table_name_upper LIKE '%2PARCELA%' THEN _table_key := '2 Parcela';
  END IF;

  IF NEW.product = 'FGTS' THEN
    SELECT CASE WHEN NEW.has_insurance THEN rate_with_insurance ELSE rate_no_insurance END
    INTO _rate
    FROM commission_rates_fgts
    WHERE bank = NEW.bank AND effective_date <= _sale_date
    ORDER BY effective_date DESC LIMIT 1;

  ELSIF NEW.product = 'Crédito do Trabalhador' THEN
    IF _table_key IS NOT NULL THEN
      SELECT rate INTO _rate_specific
      FROM commission_rates_clt
      WHERE bank = NEW.bank
        AND table_key = _table_key
        AND (CASE WHEN _is_hub THEN true ELSE has_insurance = NEW.has_insurance END)
        AND term_min <= COALESCE(NEW.term, 0)
        AND term_max >= COALESCE(NEW.term, 0)
        AND effective_date <= _sale_date
      ORDER BY effective_date DESC LIMIT 1;
    END IF;

    SELECT rate INTO _rate_generic
    FROM commission_rates_clt
    WHERE bank = NEW.bank
      AND table_key IS NULL
      AND (CASE WHEN _is_hub THEN true ELSE has_insurance = NEW.has_insurance END)
      AND term_min <= COALESCE(NEW.term, 0)
      AND term_max >= COALESCE(NEW.term, 0)
      AND effective_date <= _sale_date
    ORDER BY effective_date DESC LIMIT 1;

    _rate := COALESCE(NULLIF(_rate_specific, 0), _rate_generic);
  END IF;

  NEW.commission_rate := COALESCE(_rate, 0);
  NEW.commission_value := ROUND(NEW.released_value * COALESCE(_rate, 0) / 100, 2);

  IF _bonus_threshold IS NOT NULL AND _bonus_threshold > 0 THEN
    IF _bonus_mode = 'contratos' THEN
      SELECT COUNT(*) INTO _weekly_count
      FROM commission_sales
      WHERE seller_id = NEW.seller_id
        AND week_label = NEW.week_label
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

      _weekly_count := _weekly_count + 1;

      IF _weekly_count >= _bonus_threshold::integer THEN
        IF _bonus_fixed_value > 0 THEN
          _bonus_val := _bonus_fixed_value;
        ELSIF _bonus_rate > 0 THEN
          _bonus_val := ROUND(NEW.released_value * _bonus_rate / 100, 2);
        END IF;
        NEW.commission_value := NEW.commission_value + _bonus_val;
      END IF;

    ELSE
      SELECT COALESCE(SUM(released_value), 0) INTO _weekly_total
      FROM commission_sales
      WHERE seller_id = NEW.seller_id
        AND week_label = NEW.week_label
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

      _weekly_total := _weekly_total + NEW.released_value;

      IF _weekly_total > _bonus_threshold THEN
        IF _bonus_fixed_value > 0 THEN
          _bonus_val := _bonus_fixed_value;
        ELSIF _bonus_rate > 0 THEN
          _bonus_val := ROUND(NEW.released_value * _bonus_rate / 100, 2);
        END IF;
        NEW.commission_value := NEW.commission_value + _bonus_val;
      END IF;
    END IF;
  END IF;

  NEW.bonus_value := _bonus_val;

  RETURN NEW;
END;
$function$;
