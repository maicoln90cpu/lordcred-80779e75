-- ============================================================
-- 1) TABELAS V2 (espelho isolado)
-- ============================================================

CREATE TABLE public.commission_sales_v2 (
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
  client_birth_date date,
  seller_id uuid NOT NULL,
  external_proposal_id text,
  commission_rate numeric DEFAULT 0,
  commission_value numeric DEFAULT 0,
  bonus_value numeric DEFAULT 0,
  week_label text,
  table_name text,
  batch_id uuid REFERENCES public.import_batches(id),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.commission_settings_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_day integer NOT NULL DEFAULT 0,
  payment_day integer NOT NULL DEFAULT 5,
  bonus_threshold numeric,
  bonus_rate numeric NOT NULL DEFAULT 0,
  bonus_mode text NOT NULL DEFAULT 'valor',
  bonus_fixed_value numeric NOT NULL DEFAULT 0,
  monthly_goal_type text NOT NULL DEFAULT 'valor',
  monthly_goal_value numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.commission_rates_clt_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_date date NOT NULL,
  bank text NOT NULL,
  table_key text,
  term_min integer NOT NULL DEFAULT 0,
  term_max integer NOT NULL DEFAULT 999,
  has_insurance boolean NOT NULL DEFAULT false,
  rate numeric NOT NULL DEFAULT 0,
  obs text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Nova estrutura FGTS V2 (estilo CLT)
CREATE TABLE public.commission_rates_fgts_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_date date NOT NULL,
  bank text NOT NULL,
  table_key text,
  term_min integer NOT NULL DEFAULT 0,
  term_max integer NOT NULL DEFAULT 999,
  min_value numeric NOT NULL DEFAULT 0,
  max_value numeric NOT NULL DEFAULT 999999999,
  has_insurance boolean NOT NULL DEFAULT false,
  rate numeric NOT NULL DEFAULT 0,
  obs text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.commission_bonus_tiers_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_contracts integer NOT NULL DEFAULT 0,
  bonus_value numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.commission_annual_rewards_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_contracts integer NOT NULL DEFAULT 0,
  reward_description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.seller_pix_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL UNIQUE,
  pix_key text NOT NULL,
  pix_type text NOT NULL DEFAULT 'cpf',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 2) RLS
-- ============================================================
ALTER TABLE public.commission_sales_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_settings_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rates_clt_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rates_fgts_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_bonus_tiers_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_annual_rewards_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_pix_v2 ENABLE ROW LEVEL SECURITY;

-- Sales: privileged manage all; sellers veem só as próprias
CREATE POLICY "Privileged manage sales v2" ON public.commission_sales_v2
  FOR ALL USING (is_privileged(auth.uid())) WITH CHECK (is_privileged(auth.uid()));
CREATE POLICY "Sellers view own sales v2" ON public.commission_sales_v2
  FOR SELECT USING (seller_id = auth.uid());

-- Settings/Rates/Tiers/Rewards: privileged manage; everyone authenticated reads
CREATE POLICY "Privileged manage settings v2" ON public.commission_settings_v2
  FOR ALL USING (is_privileged(auth.uid())) WITH CHECK (is_privileged(auth.uid()));
CREATE POLICY "Authenticated read settings v2" ON public.commission_settings_v2
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Privileged manage rates clt v2" ON public.commission_rates_clt_v2
  FOR ALL USING (is_privileged(auth.uid())) WITH CHECK (is_privileged(auth.uid()));
CREATE POLICY "Authenticated read rates clt v2" ON public.commission_rates_clt_v2
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Privileged manage rates fgts v2" ON public.commission_rates_fgts_v2
  FOR ALL USING (is_privileged(auth.uid())) WITH CHECK (is_privileged(auth.uid()));
CREATE POLICY "Authenticated read rates fgts v2" ON public.commission_rates_fgts_v2
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Privileged manage bonus tiers v2" ON public.commission_bonus_tiers_v2
  FOR ALL USING (is_privileged(auth.uid())) WITH CHECK (is_privileged(auth.uid()));
CREATE POLICY "Authenticated read bonus tiers v2" ON public.commission_bonus_tiers_v2
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Privileged manage rewards v2" ON public.commission_annual_rewards_v2
  FOR ALL USING (is_privileged(auth.uid())) WITH CHECK (is_privileged(auth.uid()));
CREATE POLICY "Authenticated read rewards v2" ON public.commission_annual_rewards_v2
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Pix: privileged manage all; sellers manage own
CREATE POLICY "Privileged manage pix v2" ON public.seller_pix_v2
  FOR ALL USING (is_privileged(auth.uid())) WITH CHECK (is_privileged(auth.uid()));
CREATE POLICY "Sellers manage own pix v2" ON public.seller_pix_v2
  FOR ALL USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());

-- ============================================================
-- 3) TRIGGER updated_at em sales_v2 / settings_v2 / pix_v2 / tiers_v2 / rewards_v2
-- ============================================================
CREATE TRIGGER trg_sales_v2_updated BEFORE UPDATE ON public.commission_sales_v2
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_settings_v2_updated BEFORE UPDATE ON public.commission_settings_v2
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pix_v2_updated BEFORE UPDATE ON public.seller_pix_v2
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tiers_v2_updated BEFORE UPDATE ON public.commission_bonus_tiers_v2
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_rewards_v2_updated BEFORE UPDATE ON public.commission_annual_rewards_v2
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4) FUNÇÃO calculate_commission_v2 (nova lógica FGTS)
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculate_commission_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  FROM commission_settings_v2 LIMIT 1;

  _start_day := COALESCE(_start_day, 0);
  _week_start := _sale_date - ((extract(dow from _sale_date)::int - _start_day + 7) % 7);
  _week_end := _week_start + 6;
  _week_num := ceil(extract(day from _week_end)::numeric / 7.0)::integer;
  _month_name := to_char(_week_end, 'TMMonth');

  NEW.week_label := to_char(_week_start, 'DD/MM') || ' a ' || to_char(_week_end, 'DD/MM') || ' - Semana ' || _week_num || ' ' || _month_name;

  _table_name_upper := UPPER(COALESCE(NEW.table_name, ''));
  _is_hub := (UPPER(NEW.bank) LIKE '%HUB%');

  -- Detectar table_key (genérico para FGTS e CLT)
  IF _table_name_upper LIKE '%SONHO%' THEN _table_key := 'SONHO';
  ELSIF _table_name_upper LIKE '%FOCO%' THEN _table_key := 'FOCO';
  ELSIF _table_name_upper LIKE '%CARTADA%' THEN _table_key := 'CARTADA';
  ELSIF _table_name_upper LIKE '%CARTA NA MANGA%' OR _table_name_upper LIKE '%CARTA%MANGA%' THEN _table_key := 'CARTA NA MANGA';
  ELSIF _table_name_upper LIKE '%GOLD PLUS%' THEN _table_key := 'GOLD PLUS';
  ELSIF _table_name_upper LIKE '%GOLD POWER%' OR _table_name_upper LIKE '%POWER%' THEN _table_key := 'GOLD POWER';
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
    -- NOVA LÓGICA FGTS V2: combinação banco + table_key + prazo + valor + seguro
    IF _table_key IS NOT NULL THEN
      SELECT rate INTO _rate_specific
      FROM commission_rates_fgts_v2
      WHERE bank = NEW.bank
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
    WHERE bank = NEW.bank
      AND table_key IS NULL
      AND has_insurance = NEW.has_insurance
      AND term_min <= COALESCE(NEW.term, 0)
      AND term_max >= COALESCE(NEW.term, 0)
      AND min_value <= COALESCE(NEW.released_value, 0)
      AND max_value >= COALESCE(NEW.released_value, 0)
      AND effective_date <= _sale_date
    ORDER BY effective_date DESC LIMIT 1;

    _rate := COALESCE(NULLIF(_rate_specific, 0), _rate_generic);

  ELSIF NEW.product = 'Crédito do Trabalhador' THEN
    IF _table_key IS NOT NULL THEN
      SELECT rate INTO _rate_specific
      FROM commission_rates_clt_v2
      WHERE bank = NEW.bank
        AND table_key = _table_key
        AND (CASE WHEN _is_hub THEN true ELSE has_insurance = NEW.has_insurance END)
        AND term_min <= COALESCE(NEW.term, 0)
        AND term_max >= COALESCE(NEW.term, 0)
        AND effective_date <= _sale_date
      ORDER BY effective_date DESC LIMIT 1;
    END IF;

    SELECT rate INTO _rate_generic
    FROM commission_rates_clt_v2
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

CREATE TRIGGER trg_calculate_commission_v2
BEFORE INSERT OR UPDATE ON public.commission_sales_v2
FOR EACH ROW EXECUTE FUNCTION public.calculate_commission_v2();

-- ============================================================
-- 5) PRÉ-POPULAR 28 TAXAS FGTS V2
-- ============================================================
INSERT INTO public.commission_rates_fgts_v2
  (effective_date, bank, table_key, term_min, term_max, min_value, max_value, has_insurance, rate, obs)
VALUES
  -- LOTUS (4 prazos × sem seguro) — taxas das imagens
  ('2026-01-01', 'LOTUS', 'LOTUS 1+', 1, 1, 0, 999999999, false, 16.00, 'Prazo até 1 ano'),
  ('2026-01-01', 'LOTUS', 'LOTUS 2+', 2, 2, 0, 999999999, false, 19.00, 'Prazo até 2 anos'),
  ('2026-01-01', 'LOTUS', 'LOTUS 3+', 3, 3, 0, 999999999, false, 22.00, 'Prazo até 3 anos'),
  ('2026-01-01', 'LOTUS', 'LOTUS 4+', 4, 5, 0, 999999999, false, 24.00, 'Prazo até 4-5 anos'),

  -- HUB SONHO (sem seguro)
  ('2026-01-01', 'HUB', 'SONHO', 1, 5, 0, 999999999, false, 18.00, 'Sonho do Trabalhador'),
  -- HUB FOCO (sem seguro)
  ('2026-01-01', 'HUB', 'FOCO', 1, 5, 0, 999999999, false, 20.00, 'Foco no Corban'),
  -- HUB CARTA NA MANGA — escalas por valor (sem seguro)
  ('2026-01-01', 'HUB', 'CARTA NA MANGA', 1, 5, 0, 500, false, 12.00, 'Faixa até R$ 500'),
  ('2026-01-01', 'HUB', 'CARTA NA MANGA', 1, 5, 500.01, 1000, false, 14.00, 'Faixa R$ 500-1000'),
  ('2026-01-01', 'HUB', 'CARTA NA MANGA', 1, 5, 1000.01, 2000, false, 16.00, 'Faixa R$ 1000-2000'),
  ('2026-01-01', 'HUB', 'CARTA NA MANGA', 1, 5, 2000.01, 999999999, false, 18.00, 'Faixa acima R$ 2000'),

  -- FACTA GOLD PLUS (4 prazos × sem seguro)
  ('2026-01-01', 'FACTA', 'GOLD PLUS', 2, 2, 0, 999999999, false, 17.00, 'Gold Plus 2 anos'),
  ('2026-01-01', 'FACTA', 'GOLD PLUS', 3, 3, 0, 999999999, false, 20.00, 'Gold Plus 3 anos'),
  ('2026-01-01', 'FACTA', 'GOLD PLUS', 4, 4, 0, 999999999, false, 22.00, 'Gold Plus 4 anos'),
  ('2026-01-01', 'FACTA', 'GOLD PLUS', 5, 5, 0, 999999999, false, 24.00, 'Gold Plus 5 anos'),
  -- FACTA GOLD POWER (4 prazos × sem seguro)
  ('2026-01-01', 'FACTA', 'GOLD POWER', 2, 2, 0, 999999999, false, 16.00, 'Gold Power 2 anos'),
  ('2026-01-01', 'FACTA', 'GOLD POWER', 3, 3, 0, 999999999, false, 19.00, 'Gold Power 3 anos'),
  ('2026-01-01', 'FACTA', 'GOLD POWER', 4, 4, 0, 999999999, false, 21.00, 'Gold Power 4 anos'),
  ('2026-01-01', 'FACTA', 'GOLD POWER', 5, 5, 0, 999999999, false, 23.00, 'Gold Power 5 anos'),

  -- PARANA BANCO (sem seguro) por prazo
  ('2026-01-01', 'PARANA BANCO', NULL, 1, 1, 0, 999999999, false, 14.00, 'Paraná sem seguro 1 ano'),
  ('2026-01-01', 'PARANA BANCO', NULL, 2, 2, 0, 999999999, false, 17.00, 'Paraná sem seguro 2 anos'),
  ('2026-01-01', 'PARANA BANCO', NULL, 3, 3, 0, 999999999, false, 20.00, 'Paraná sem seguro 3 anos'),
  ('2026-01-01', 'PARANA BANCO', NULL, 4, 4, 0, 999999999, false, 22.00, 'Paraná sem seguro 4 anos'),
  ('2026-01-01', 'PARANA BANCO', NULL, 5, 5, 0, 999999999, false, 24.00, 'Paraná sem seguro 5 anos'),

  -- PARANA BANCO (com seguro) por prazo
  ('2026-01-01', 'PARANA BANCO', NULL, 1, 1, 0, 999999999, true, 16.00, 'Paraná com seguro 1 ano'),
  ('2026-01-01', 'PARANA BANCO', NULL, 2, 2, 0, 999999999, true, 19.00, 'Paraná com seguro 2 anos'),
  ('2026-01-01', 'PARANA BANCO', NULL, 3, 3, 0, 999999999, true, 22.00, 'Paraná com seguro 3 anos'),
  ('2026-01-01', 'PARANA BANCO', NULL, 4, 4, 0, 999999999, true, 24.00, 'Paraná com seguro 4 anos'),
  ('2026-01-01', 'PARANA BANCO', NULL, 5, 5, 0, 999999999, true, 26.00, 'Paraná com seguro 5 anos');

-- Settings inicial padrão
INSERT INTO public.commission_settings_v2 (week_start_day, payment_day, bonus_mode)
VALUES (0, 5, 'valor');