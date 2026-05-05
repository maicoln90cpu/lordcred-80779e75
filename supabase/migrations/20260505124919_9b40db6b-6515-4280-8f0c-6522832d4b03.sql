-- Etapa 2 Corban: deep extraction + backfill
-- Helper: extrai campos canônicos a partir de raw_data (estrutura NewCorban).

CREATE OR REPLACE FUNCTION public.corban_extract_field(raw jsonb, paths text[])
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  p text;
  parts text[];
  cur jsonb;
  i int;
  v text;
BEGIN
  IF raw IS NULL THEN RETURN NULL; END IF;
  FOREACH p IN ARRAY paths LOOP
    parts := string_to_array(p, '.');
    cur := raw;
    FOR i IN 1..array_length(parts, 1) LOOP
      IF cur IS NULL OR jsonb_typeof(cur) <> 'object' THEN cur := NULL; EXIT; END IF;
      cur := cur -> parts[i];
    END LOOP;
    IF cur IS NULL OR jsonb_typeof(cur) = 'null' THEN CONTINUE; END IF;
    IF jsonb_typeof(cur) = 'string' THEN
      v := cur #>> '{}';
    ELSE
      v := cur::text;
      v := trim(both '"' from v);
    END IF;
    IF v IS NOT NULL AND v <> '' AND v <> 'null' THEN
      RETURN v;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

-- Normaliza CPF: aceita string ou número (notação científica), retorna 11 dígitos com zeros à esquerda.
CREATE OR REPLACE FUNCTION public.corban_normalize_cpf(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  digits text;
  num numeric;
BEGIN
  IF raw IS NULL OR raw = '' THEN RETURN NULL; END IF;
  -- Caso venha como notação científica (ex: 9.26592769e+10), converter via numeric
  IF raw ~ '^[0-9.]+e[+-]?[0-9]+$' THEN
    BEGIN
      num := raw::numeric;
      digits := regexp_replace(to_char(num, 'FM99999999999'), '[^0-9]', '', 'g');
    EXCEPTION WHEN OTHERS THEN
      digits := regexp_replace(raw, '[^0-9]', '', 'g');
    END;
  ELSE
    digits := regexp_replace(raw, '[^0-9]', '', 'g');
  END IF;
  IF digits IS NULL OR digits = '' THEN RETURN NULL; END IF;
  -- Pad com zeros à esquerda até 11 dígitos
  IF length(digits) < 11 THEN
    digits := lpad(digits, 11, '0');
  END IF;
  RETURN digits;
END;
$$;

-- Backfill: atualiza linhas com campos NULL usando raw_data
UPDATE public.corban_propostas_snapshot
SET
  cpf = COALESCE(cpf, public.corban_normalize_cpf(public.corban_extract_field(raw_data, ARRAY['cpf','cliente.cliente_cpf','cliente.cpf','pessoais.cpf']))),
  nome = COALESCE(nome, public.corban_extract_field(raw_data, ARRAY['nome','cliente.cliente_nome','cliente.nome','cliente_nome','pessoais.nome'])),
  banco = COALESCE(banco, public.corban_extract_field(raw_data, ARRAY['banco','proposta.banco_nome','banco_nome','instituicao'])),
  produto = COALESCE(produto, public.corban_extract_field(raw_data, ARRAY['produto','proposta.produto_nome','produto_nome'])),
  status = COALESCE(status, public.corban_extract_field(raw_data, ARRAY['status_nome','status','api.status_api','status_id'])),
  valor_liberado = COALESCE(valor_liberado, NULLIF(public.corban_extract_field(raw_data, ARRAY['valor_liberado','proposta.valor_liberado','valorLiberado','vlr_liberado']),'')::numeric),
  valor_parcela = COALESCE(valor_parcela, NULLIF(public.corban_extract_field(raw_data, ARRAY['valor_parcela','proposta.valor_parcela','valorParcela','vlr_parcela']),'')::numeric),
  prazo = COALESCE(NULLIF(prazo,''), public.corban_extract_field(raw_data, ARRAY['prazo','proposta.prazo','prazos'])),
  vendedor_nome = COALESCE(vendedor_nome, public.corban_extract_field(raw_data, ARRAY['vendedor_nome','vendedor','equipe.vendedor','digitador_nome'])),
  data_cadastro = COALESCE(data_cadastro, public.corban_extract_field(raw_data, ARRAY['data_cadastro','datas.cadastro','dataCadastro','created_at'])),
  convenio = COALESCE(convenio, public.corban_extract_field(raw_data, ARRAY['convenio','proposta.convenio_nome','convenio_nome'])),
  updated_at = now()
WHERE raw_data IS NOT NULL
  AND (
    cpf IS NULL OR nome IS NULL OR banco IS NULL OR produto IS NULL OR status IS NULL
    OR valor_liberado IS NULL OR valor_parcela IS NULL OR prazo IS NULL OR prazo = ''
    OR vendedor_nome IS NULL OR data_cadastro IS NULL OR convenio IS NULL
  );