
-- Drop if exists for idempotency
DROP FUNCTION IF EXISTS public.calculate_commission_audit(date, date);

CREATE OR REPLACE FUNCTION public.calculate_commission_audit(
  _date_from date DEFAULT NULL,
  _date_to date DEFAULT NULL
)
RETURNS TABLE (
  num_contrato text,
  nome text,
  banco text,
  produto text,
  tabela text,
  valor_liberado numeric,
  valor_assegurado numeric,
  prazo integer,
  seguro text,
  vendedor text,
  data_pago timestamptz,
  comissao_recebida numeric,
  comissao_esperada numeric,
  diferenca numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  -- Check privilege
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

    -- Convert data_pago to SP date
    v_data_pago_sp := NULL;
    IF rec.data_pago IS NOT NULL THEN
      v_data_pago_sp := (rec.data_pago AT TIME ZONE 'America/Sao_Paulo')::date;
    END IF;

    -- Cross-reference: comissão recebida
    SELECT COALESCE(SUM(g.cms_rep), 0) INTO v_cms_geral
    FROM cr_geral g WHERE (g.ade = rec.num_contrato OR g.cod_contrato = rec.num_contrato)
      AND rec.num_contrato IS NOT NULL AND rec.num_contrato != '';

    SELECT COALESCE(SUM(rp.cms_rep_favorecido), 0) INTO v_cms_repasse
    FROM cr_repasse rp WHERE (rp.ade = rec.num_contrato OR rp.cod_contrato = rec.num_contrato)
      AND rec.num_contrato IS NOT NULL AND rec.num_contrato != '';

    -- Seguros: match by ADE number in descricao
    SELECT COALESCE(SUM(s.valor_comissao), 0) INTO v_cms_seguro
    FROM cr_seguros s WHERE s.descricao ~* ('ADE\s+' || rec.num_contrato)
      AND rec.num_contrato IS NOT NULL AND rec.num_contrato != '';

    v_recebida := v_cms_geral + v_cms_repasse + v_cms_seguro;

    -- Calculate expected commission
    v_esperada := 0;

    IF v_produto LIKE '%FGTS%' THEN
      -- Extract FGTS table key
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

      -- Hub uses valor as lookup, others use prazo
      v_lookup_value := CASE WHEN v_banco LIKE '%HUB%' THEN v_valor ELSE v_prazo END;

      -- Find most recent vigencia for this bank
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
      -- Extract CLT table key
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

      -- Find most recent vigencia
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
          AND (rc.seguro = v_seguro OR rc.seguro = 'Ambos');

        v_esperada := ROUND(v_valor_calc * v_rate / 100, 2);
      END IF;
    END IF;

    -- Return row
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
$$;
