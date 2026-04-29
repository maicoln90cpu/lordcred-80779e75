-- =========================================================================
-- ETAPA 4 — Persistência ampliada de v8_operations_local
-- =========================================================================

-- 1) COLUNAS NOVAS ---------------------------------------------------------
ALTER TABLE public.v8_operations_local
  ADD COLUMN IF NOT EXISTS borrower_name           text,
  ADD COLUMN IF NOT EXISTS borrower_cpf            text,
  ADD COLUMN IF NOT EXISTS borrower_email          text,
  ADD COLUMN IF NOT EXISTS borrower_phone          text,
  ADD COLUMN IF NOT EXISTS disbursed_amount        numeric(14,2),
  ADD COLUMN IF NOT EXISTS installment_value       numeric(14,2),
  ADD COLUMN IF NOT EXISTS number_of_installments  integer,
  ADD COLUMN IF NOT EXISTS monthly_interest_rate   numeric(8,4),
  ADD COLUMN IF NOT EXISTS contract_number         text,
  ADD COLUMN IF NOT EXISTS formalization_url       text,
  ADD COLUMN IF NOT EXISTS contract_url            text,
  ADD COLUMN IF NOT EXISTS v8_created_at           timestamptz,
  ADD COLUMN IF NOT EXISTS first_due_date          date,
  ADD COLUMN IF NOT EXISTS paid_at                 timestamptz,
  ADD COLUMN IF NOT EXISTS last_status_change_at   timestamptz;

CREATE INDEX IF NOT EXISTS v8_ops_local_borrower_cpf_idx
  ON public.v8_operations_local (borrower_cpf);
CREATE INDEX IF NOT EXISTS v8_ops_local_paid_at_idx
  ON public.v8_operations_local (paid_at) WHERE paid_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS v8_ops_local_formalization_pending_idx
  ON public.v8_operations_local (formalization_url) WHERE formalization_url IS NOT NULL;

-- 2) HELPER: pega 1ª string não-vazia entre as chaves de um objeto jsonb ---
CREATE OR REPLACE FUNCTION public.jsonb_pick_text(_obj jsonb, VARIADIC _keys text[])
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE k text; v text;
BEGIN
  IF _obj IS NULL OR jsonb_typeof(_obj) <> 'object' THEN RETURN NULL; END IF;
  FOREACH k IN ARRAY _keys LOOP
    v := _obj->>k;
    IF v IS NOT NULL AND v <> '' THEN RETURN v; END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

-- 3) EXTRATOR PRINCIPAL ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.v8_extract_operation_fields(_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  p             jsonb;
  borrower      jsonb;
  op_data       jsonb;
  op_history    jsonb;
  v_paid_at     text;
  v_first_due   text;
  v_v8_created  text;
  v_last_change text;
  v_cpf_raw     text;
  v_phone       text;
  result        jsonb := '{}'::jsonb;
BEGIN
  IF _payload IS NULL OR jsonb_typeof(_payload) <> 'object' THEN
    RETURN '{}'::jsonb;
  END IF;

  -- Achata: payload pode vir direto OU embrulhado em "data"
  p := COALESCE(_payload->'data', _payload);
  IF jsonb_typeof(p) <> 'object' THEN p := _payload; END IF;

  borrower   := COALESCE(p->'borrower',         _payload->'borrower');
  op_data    := COALESCE(p->'operation_data',   p->'operationData', _payload->'operation_data');
  op_history := COALESCE(p->'operation_history', p->'operationHistory', _payload->'operation_history');

  -- ===== Tomador =====
  v_cpf_raw := COALESCE(
    public.jsonb_pick_text(borrower, 'document_number', 'documentNumber', 'cpf'),
    public.jsonb_pick_text(p,        'document_number', 'documentNumber', 'cpf')
  );

  -- Telefone: tenta objeto estruturado, depois string plana
  v_phone := NULLIF(
    concat_ws('',
      COALESCE(borrower->'borrower_phone'->>'country_code', borrower->'phone'->>'country_code', ''),
      COALESCE(borrower->'borrower_phone'->>'area_code',    borrower->'phone'->>'area_code', ''),
      COALESCE(borrower->'borrower_phone'->>'number',       borrower->'phone'->>'number', '')
    ), '');
  IF v_phone IS NULL THEN
    v_phone := public.jsonb_pick_text(borrower, 'phone', 'mobile_phone');
  END IF;

  result := result || jsonb_build_object(
    'borrower_name',  public.jsonb_pick_text(borrower, 'name', 'full_name', 'fullName'),
    'borrower_cpf',   NULLIF(regexp_replace(COALESCE(v_cpf_raw, ''), '\D', '', 'g'), ''),
    'borrower_email', public.jsonb_pick_text(borrower, 'email'),
    'borrower_phone', v_phone
  );

  -- ===== Financeiros =====
  result := result || jsonb_build_object(
    'disbursed_amount', NULLIF(COALESCE(
      public.jsonb_pick_text(op_data, 'disbursed_issue_amount', 'disbursedIssueAmount', 'issue_amount', 'issueAmount', 'operation_amount', 'operationAmount'),
      public.jsonb_pick_text(p,       'disbursed_issue_amount', 'disbursedIssueAmount', 'issue_amount', 'issueAmount')
    ), '')::numeric,
    'installment_value', NULLIF(COALESCE(
      public.jsonb_pick_text(op_data, 'installment_face_value', 'installmentFaceValue', 'installment_value'),
      public.jsonb_pick_text(p,       'installment_face_value', 'installmentFaceValue')
    ), '')::numeric,
    'number_of_installments', NULLIF(COALESCE(
      public.jsonb_pick_text(op_data, 'number_of_installments', 'numberOfInstallments', 'installments'),
      public.jsonb_pick_text(p,       'number_of_installments', 'numberOfInstallments')
    ), '')::integer,
    'monthly_interest_rate', NULLIF(COALESCE(
      public.jsonb_pick_text(op_data, 'monthly_interest_rate', 'monthlyInterestRate', 'interest_rate'),
      public.jsonb_pick_text(p,       'monthly_interest_rate', 'monthlyInterestRate')
    ), '')::numeric
  );

  -- ===== Contrato =====
  result := result || jsonb_build_object(
    'contract_number',   COALESCE(
      public.jsonb_pick_text(p,       'contract_number',   'contractNumber'),
      public.jsonb_pick_text(op_data, 'contract_number',   'contractNumber')),
    'formalization_url', COALESCE(
      public.jsonb_pick_text(p,        'formalization_url', 'formalizationUrl', 'signature_url', 'signatureUrl'),
      public.jsonb_pick_text(_payload, 'formalization_url', 'formalizationUrl')),
    'contract_url',      COALESCE(
      public.jsonb_pick_text(p,        'contract_url', 'contractUrl', 'ccb_url', 'ccbUrl'),
      public.jsonb_pick_text(_payload, 'contract_url', 'contractUrl'))
  );

  -- ===== Datas =====
  v_v8_created  := COALESCE(public.jsonb_pick_text(p, 'created_at', 'createdAt'),
                            public.jsonb_pick_text(_payload, 'created_at', 'createdAt'));
  v_first_due   := COALESCE(public.jsonb_pick_text(op_data, 'first_due_date', 'firstDueDate'),
                            public.jsonb_pick_text(p, 'first_due_date', 'firstDueDate'));
  v_last_change := COALESCE(public.jsonb_pick_text(p, 'updated_at', 'updatedAt', 'last_status_change_at'),
                            public.jsonb_pick_text(_payload, 'updated_at', 'updatedAt'));

  -- paid_at: extrai do operation_history quando algum item indica pagamento
  IF op_history IS NOT NULL AND jsonb_typeof(op_history) = 'array' THEN
    SELECT (h->>'created_at')
      INTO v_paid_at
      FROM jsonb_array_elements(op_history) h
     WHERE lower(COALESCE(h->>'action', h->>'description', '')) LIKE '%paid%'
        OR lower(COALESCE(h->>'action', '')) IN ('paid', 'payment_done', 'pago')
     ORDER BY (h->>'created_at') DESC NULLS LAST
     LIMIT 1;
  END IF;
  IF v_paid_at IS NULL AND lower(COALESCE(p->>'status', _payload->>'status', '')) = 'paid' THEN
    v_paid_at := v_last_change;
  END IF;

  result := result || jsonb_build_object(
    'v8_created_at',         NULLIF(v_v8_created,  '')::timestamptz,
    'first_due_date',        NULLIF(v_first_due,   '')::date,
    'paid_at',               NULLIF(v_paid_at,     '')::timestamptz,
    'last_status_change_at', NULLIF(v_last_change, '')::timestamptz
  );

  RETURN result;

EXCEPTION WHEN OTHERS THEN
  RETURN '{}'::jsonb;
END;
$$;

-- 4) TRIGGER: preenche colunas a partir do raw_payload --------------------
CREATE OR REPLACE FUNCTION public.v8_operations_local_promote_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE ext jsonb;
BEGIN
  IF NEW.raw_payload IS NULL THEN RETURN NEW; END IF;

  ext := public.v8_extract_operation_fields(NEW.raw_payload);
  IF ext = '{}'::jsonb THEN RETURN NEW; END IF;

  NEW.borrower_name           := COALESCE(NULLIF(ext->>'borrower_name', ''),       NEW.borrower_name);
  NEW.borrower_cpf            := COALESCE(NULLIF(ext->>'borrower_cpf', ''),        NEW.borrower_cpf);
  NEW.borrower_email          := COALESCE(NULLIF(ext->>'borrower_email', ''),      NEW.borrower_email);
  NEW.borrower_phone          := COALESCE(NULLIF(ext->>'borrower_phone', ''),      NEW.borrower_phone);
  NEW.disbursed_amount        := COALESCE((ext->>'disbursed_amount')::numeric,     NEW.disbursed_amount);
  NEW.installment_value       := COALESCE((ext->>'installment_value')::numeric,    NEW.installment_value);
  NEW.number_of_installments  := COALESCE((ext->>'number_of_installments')::int,   NEW.number_of_installments);
  NEW.monthly_interest_rate   := COALESCE((ext->>'monthly_interest_rate')::numeric, NEW.monthly_interest_rate);
  NEW.contract_number         := COALESCE(NULLIF(ext->>'contract_number', ''),     NEW.contract_number);
  NEW.formalization_url       := COALESCE(NULLIF(ext->>'formalization_url', ''),   NEW.formalization_url);
  NEW.contract_url            := COALESCE(NULLIF(ext->>'contract_url', ''),        NEW.contract_url);
  NEW.v8_created_at           := COALESCE((ext->>'v8_created_at')::timestamptz,    NEW.v8_created_at);
  NEW.first_due_date          := COALESCE((ext->>'first_due_date')::date,          NEW.first_due_date);
  NEW.paid_at                 := COALESCE((ext->>'paid_at')::timestamptz,          NEW.paid_at);
  NEW.last_status_change_at   := COALESCE((ext->>'last_status_change_at')::timestamptz, NEW.last_status_change_at);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS v8_operations_local_promote_fields_trg ON public.v8_operations_local;
CREATE TRIGGER v8_operations_local_promote_fields_trg
  BEFORE INSERT OR UPDATE OF raw_payload, status
  ON public.v8_operations_local
  FOR EACH ROW
  EXECUTE FUNCTION public.v8_operations_local_promote_fields();

-- 5) BACKFILL idempotente -------------------------------------------------
CREATE OR REPLACE FUNCTION public.v8_backfill_operation_fields(_limit integer DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _affected int;
BEGIN
  WITH upd AS (
    UPDATE public.v8_operations_local AS t
       SET raw_payload = t.raw_payload  -- força a trigger a rodar
     WHERE t.raw_payload IS NOT NULL
       AND t.id IN (
         SELECT id FROM public.v8_operations_local
          WHERE raw_payload IS NOT NULL
            AND (borrower_name IS NULL OR disbursed_amount IS NULL
                 OR formalization_url IS NULL OR v8_created_at IS NULL)
          LIMIT COALESCE(_limit, 100000)
       )
    RETURNING 1
  )
  SELECT COUNT(*) INTO _affected FROM upd;
  RETURN _affected;
END;
$$;

-- Roda o backfill agora.
SELECT public.v8_backfill_operation_fields();