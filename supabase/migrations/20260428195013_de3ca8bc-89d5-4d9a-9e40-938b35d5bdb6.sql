-- 1) Adicionar colunas com defaults retrocompatíveis
ALTER TABLE public.commission_rates_clt
  ADD COLUMN IF NOT EXISTS min_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_value numeric NOT NULL DEFAULT 999999999;

ALTER TABLE public.commission_rates_clt_v2
  ADD COLUMN IF NOT EXISTS min_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_value numeric NOT NULL DEFAULT 999999999;

ALTER TABLE public.cr_rules_clt
  ADD COLUMN IF NOT EXISTS valor_min numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_max numeric NOT NULL DEFAULT 999999999;

-- 2) Índices compostos para acelerar lookup
CREATE INDEX IF NOT EXISTS idx_clt_v1_lookup
  ON public.commission_rates_clt (bank, table_key, term_min, term_max, min_value, max_value, effective_date DESC);

CREATE INDEX IF NOT EXISTS idx_clt_v2_lookup
  ON public.commission_rates_clt_v2 (bank, table_key, term_min, term_max, min_value, max_value, effective_date DESC);

CREATE INDEX IF NOT EXISTS idx_cr_rules_clt_lookup
  ON public.cr_rules_clt (banco, tabela_chave, prazo_min, prazo_max, valor_min, valor_max, data_vigencia DESC);

-- 3) Atualizar trigger V1 (calculate_commission) - apenas o bloco CLT
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
        AND min_value <= COALESCE(NEW.released_value, 0)
        AND max_value >= COALESCE(NEW.released_value, 0)
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
      AND min_value <= COALESCE(NEW.released_value, 0)
      AND max_value >= COALESCE(NEW.released_value, 0)
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
        IF _bonus_fixed_value > 0 THEN _bonus_val := _bonus_fixed_value;
        ELSIF _bonus_rate > 0 THEN _bonus_val := ROUND(NEW.released_value * _bonus_rate / 100, 2);
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

-- 4) Atualizar trigger V2 (calculate_commission_v2) - apenas o bloco CLT
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
        AND min_value <= COALESCE(NEW.released_value, 0)
        AND max_value >= COALESCE(NEW.released_value, 0)
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
      AND min_value <= COALESCE(NEW.released_value, 0)
      AND max_value >= COALESCE(NEW.released_value, 0)
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

-- 5) Atualizar calculate_commission_audit para incluir filtro de valor no bloco CLT
CREATE OR REPLACE FUNCTION public.calculate_commission_audit(_date_from date DEFAULT NULL::date, _date_to date DEFAULT NULL::date)
 RETURNS TABLE(num_contrato text, nome text, banco text, produto text, tabela text, valor_liberado numeric, valor_assegurado numeric, prazo integer, seguro text, vendedor text, data_pago timestamp with time zone, comissao_recebida numeric, comissao_esperada numeric, diferenca numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  v_banco text;
  v_produto text;
  v_tabela text;
  v_valor numeric;
  v_prazo integer;
  v_seguro text;
  v_data_pago_sp date;
  v_tabela_chave text;
  v_lookup_value numeric;
  v_is_mercantil boolean;
  v_valor_calc numeric;
  v_valor_asseg numeric;
  v_rate numeric;
  v_max_vig date;
  v_cms_geral numeric;
  v_cms_repasse numeric;
  v_cms_seguro numeric;
  v_recebida numeric;
  v_esperada numeric;
BEGIN
  IF NOT is_privileged(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  FOR rec IN
    SELECT r.num_contrato, r.nome, r.banco, r.produto, r.tabela,
           r.valor_liberado, r.prazo, r.seguro, r.vendedor, r.data_pago
    FROM cr_relatorio r
    WHERE (_date_from IS NULL OR (r.data_pago AT TIME ZONE 'America/Sao_Paulo')::date >= _date_from)
      AND (_date_to IS NULL OR (r.data_pago AT TIME ZONE 'America/Sao_Paulo')::date <= _date_to)
  LOOP
    v_banco := UPPER(COALESCE(rec.banco, ''));
    v_produto := UPPER(COALESCE(rec.produto, ''));
    v_tabela := COALESCE(rec.tabela, '');
    v_valor := COALESCE(rec.valor_liberado, 0);
    v_prazo := COALESCE(rec.prazo, 0);
    v_seguro := COALESCE(rec.seguro, 'Não');
    v_is_mercantil := v_banco LIKE '%MERCANTIL%';
    v_valor_asseg := CASE WHEN v_is_mercantil THEN ROUND(v_valor / 0.7, 2) ELSE 0 END;
    v_valor_calc := CASE WHEN v_is_mercantil THEN v_valor_asseg ELSE v_valor END;

    v_data_pago_sp := NULL;
    IF rec.data_pago IS NOT NULL THEN
      v_data_pago_sp := (rec.data_pago AT TIME ZONE 'America/Sao_Paulo')::date;
    END IF;

    SELECT COALESCE(SUM(g.cms_rep), 0) INTO v_cms_geral
    FROM cr_geral g WHERE (g.ade = rec.num_contrato OR g.cod_contrato = rec.num_contrato)
      AND rec.num_contrato IS NOT NULL AND rec.num_contrato != '';

    SELECT COALESCE(SUM(rp.cms_rep_favorecido), 0) INTO v_cms_repasse
    FROM cr_repasse rp WHERE (rp.ade = rec.num_contrato OR rp.cod_contrato = rec.num_contrato)
      AND rec.num_contrato IS NOT NULL AND rec.num_contrato != '';

    SELECT COALESCE(SUM(s.valor_comissao), 0) INTO v_cms_seguro
    FROM cr_seguros s WHERE s.descricao ~* ('ADE\s+' || rec.num_contrato)
      AND rec.num_contrato IS NOT NULL AND rec.num_contrato != '';

    v_recebida := v_cms_geral + v_cms_repasse + v_cms_seguro;

    v_esperada := 0;

    IF v_produto LIKE '%FGTS%' THEN
      IF v_banco LIKE '%PARANA%' OR v_banco LIKE '%PARANÁ%' THEN
        v_tabela_chave := CASE WHEN v_seguro = 'Sim' THEN 'SEGURO' ELSE 'PARANA' END;
      ELSIF v_banco LIKE '%LOTUS%' THEN
        v_tabela_chave := ' ' || RIGHT(TRIM(v_tabela), 1) || ' ';
      ELSIF v_banco LIKE '%HUB%' THEN
        IF UPPER(v_tabela) LIKE '%SONHO%' THEN v_tabela_chave := 'SONHO';
        ELSIF UPPER(v_tabela) LIKE '%FOCO%' THEN v_tabela_chave := 'FOCO';
        ELSE v_tabela_chave := 'CARTA NA M';
        END IF;
      ELSIF v_banco LIKE '%FACTA%' THEN
        v_tabela_chave := CASE WHEN UPPER(v_tabela) LIKE '%PLUS%' THEN 'GOLD PLUS' ELSE 'GOLD POWER' END;
      ELSE
        v_tabela_chave := '*';
      END IF;

      v_lookup_value := CASE WHEN v_banco LIKE '%HUB%' THEN v_valor ELSE v_prazo END;

      SELECT MAX(rf.data_vigencia) INTO v_max_vig
      FROM cr_rules_fgts rf
      WHERE UPPER(rf.banco) = v_banco
        AND (v_data_pago_sp IS NULL OR rf.data_vigencia <= v_data_pago_sp);

      IF v_max_vig IS NOT NULL THEN
        SELECT COALESCE(SUM(rf.taxa), 0) INTO v_rate
        FROM cr_rules_fgts rf
        WHERE UPPER(rf.banco) = v_banco
          AND rf.data_vigencia = v_max_vig
          AND (v_tabela_chave = '*' OR rf.tabela_chave = '*' OR UPPER(v_tabela_chave) LIKE '%' || UPPER(rf.tabela_chave) || '%')
          AND v_lookup_value >= rf.min_valor AND v_lookup_value <= rf.max_valor
          AND (rf.seguro = v_seguro OR rf.seguro = 'Ambos');

        v_esperada := ROUND(v_valor * v_rate / 100, 2);
      END IF;

    ELSE
      -- CLT product
      IF v_banco LIKE '%HUB%' THEN
        IF UPPER(v_tabela) LIKE '%36X COM SEGURO%' THEN v_tabela_chave := '36X COM SEGURO';
        ELSIF UPPER(v_tabela) LIKE '%FOCO%' THEN v_tabela_chave := 'FOCO NO CORBAN';
        ELSIF UPPER(v_tabela) LIKE '%SONHO%' THEN v_tabela_chave := 'SONHO DO CLT';
        ELSIF UPPER(v_tabela) LIKE '%48X%' THEN v_tabela_chave := 'CONSIGNADO CLT 48x';
        ELSE v_tabela_chave := 'CARTADA CLT';
        END IF;
      ELSE
        v_tabela_chave := '*';
      END IF;

      SELECT MAX(rc.data_vigencia) INTO v_max_vig
      FROM cr_rules_clt rc
      WHERE UPPER(rc.banco) = v_banco
        AND (v_data_pago_sp IS NULL OR rc.data_vigencia <= v_data_pago_sp);

      IF v_max_vig IS NOT NULL THEN
        SELECT COALESCE(SUM(rc.taxa), 0) INTO v_rate
        FROM cr_rules_clt rc
        WHERE UPPER(rc.banco) = v_banco
          AND rc.data_vigencia = v_max_vig
          AND (v_tabela_chave = '*' OR rc.tabela_chave = '*' OR UPPER(v_tabela_chave) LIKE '%' || UPPER(rc.tabela_chave) || '%')
          AND v_prazo >= rc.prazo_min AND v_prazo <= rc.prazo_max
          AND v_valor_calc >= rc.valor_min AND v_valor_calc <= rc.valor_max
          AND (rc.seguro = v_seguro OR rc.seguro = 'Ambos');

        v_esperada := ROUND(v_valor_calc * v_rate / 100, 2);
      END IF;
    END IF;

    num_contrato := COALESCE(rec.num_contrato, '');
    nome := COALESCE(rec.nome, '');
    banco := COALESCE(rec.banco, '');
    produto := CASE WHEN v_produto LIKE '%FGTS%' THEN 'FGTS' ELSE 'CLT' END;
    tabela := v_tabela;
    valor_liberado := v_valor;
    valor_assegurado := v_valor_asseg;
    prazo := v_prazo;
    seguro := v_seguro;
    vendedor := COALESCE(rec.vendedor, '');
    data_pago := rec.data_pago;
    comissao_recebida := v_recebida;
    comissao_esperada := v_esperada;
    diferenca := ROUND(v_recebida - v_esperada, 2);
    RETURN NEXT;
  END LOOP;
END;
$function$;