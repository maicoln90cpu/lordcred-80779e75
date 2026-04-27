-- ============================================================
-- BACKUP DE SEGURANÇA (snapshots antes de qualquer alteração)
-- ============================================================
DROP TABLE IF EXISTS public.commission_rates_clt_v2_backup_20260427;
CREATE TABLE public.commission_rates_clt_v2_backup_20260427 AS
  SELECT * FROM public.commission_rates_clt_v2;

DROP TABLE IF EXISTS public.commission_rates_fgts_v2_backup_20260427;
CREATE TABLE public.commission_rates_fgts_v2_backup_20260427 AS
  SELECT * FROM public.commission_rates_fgts_v2;

ALTER TABLE public.commission_rates_clt_v2_backup_20260427 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rates_fgts_v2_backup_20260427 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Privileged read clt backup" ON public.commission_rates_clt_v2_backup_20260427
  FOR SELECT TO authenticated USING (public.is_privileged(auth.uid()));
CREATE POLICY "Privileged read fgts backup" ON public.commission_rates_fgts_v2_backup_20260427
  FOR SELECT TO authenticated USING (public.is_privileged(auth.uid()));

-- ============================================================
-- CLT V2 — DUPLICATAS: deletar grupos duplicados, reinserir oficial
-- ============================================================
-- Banco C6 — sem table_key
DELETE FROM public.commission_rates_clt_v2 WHERE bank='Banco C6' AND table_key IS NULL AND term_min=6  AND term_max=6  AND has_insurance=false;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='Banco C6' AND table_key IS NULL AND term_min=12 AND term_max=12 AND has_insurance=false;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='Banco C6' AND table_key IS NULL AND term_min=18 AND term_max=18 AND has_insurance=false;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='Banco C6' AND table_key IS NULL AND term_min=24 AND term_max=24 AND has_insurance=false;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='Banco C6' AND table_key IS NULL AND term_min=36 AND term_max=48 AND has_insurance=false;

-- Banco C6 — table_key '4 Parcela'
DELETE FROM public.commission_rates_clt_v2 WHERE bank='Banco C6' AND table_key='4 Parcela' AND term_min=12 AND term_max=12 AND has_insurance=true;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='Banco C6' AND table_key='4 Parcela' AND term_min=18 AND term_max=18 AND has_insurance=true;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='Banco C6' AND table_key='4 Parcela' AND term_min=24 AND term_max=24 AND has_insurance=true;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='Banco C6' AND table_key='4 Parcela' AND term_min=36 AND term_max=36 AND has_insurance=true;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='Banco C6' AND table_key='4 Parcela' AND term_min=48 AND term_max=48 AND has_insurance=true;

-- FACTA, Happy, Mercantil, Prata, Presença, Qualibank, V8 Bank, ZiliCred
DELETE FROM public.commission_rates_clt_v2 WHERE bank='FACTA'        AND table_key IS NULL AND term_min=6  AND term_max=20 AND has_insurance=false;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='FACTA'        AND table_key IS NULL AND term_min=24 AND term_max=48 AND has_insurance=false;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='Happy Consig' AND table_key IS NULL AND term_min=18 AND term_max=18 AND has_insurance=false;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='Happy Consig' AND table_key IS NULL AND term_min=18 AND term_max=18 AND has_insurance=true;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='Happy Consig' AND table_key IS NULL AND term_min=24 AND term_max=24 AND has_insurance=false;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='Happy Consig' AND table_key IS NULL AND term_min=24 AND term_max=24 AND has_insurance=true;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='Happy Consig' AND table_key IS NULL AND term_min=36 AND term_max=36 AND has_insurance=false;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='Happy Consig' AND table_key IS NULL AND term_min=36 AND term_max=36 AND has_insurance=true;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='MERCANTIL'    AND table_key IS NULL AND term_min=0  AND term_max=999 AND has_insurance=false;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='MERCANTIL'    AND table_key IS NULL AND term_min=0  AND term_max=999 AND has_insurance=true;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='Prata Digital'AND table_key IS NULL AND term_min=6  AND term_max=6  AND has_insurance=false;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='Prata Digital'AND table_key IS NULL AND term_min=12 AND term_max=12 AND has_insurance=false;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='Prata Digital'AND table_key IS NULL AND term_min=24 AND term_max=36 AND has_insurance=false;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='Presença Bank'AND table_key IS NULL AND term_min=6  AND term_max=6  AND has_insurance=false;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='Presença Bank'AND table_key IS NULL AND term_min=12 AND term_max=12 AND has_insurance=false;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='Presença Bank'AND table_key IS NULL AND term_min=24 AND term_max=24 AND has_insurance=false;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='Presença Bank'AND table_key IS NULL AND term_min=36 AND term_max=36 AND has_insurance=false;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='Qualibank'    AND table_key IS NULL AND term_min=24 AND term_max=24 AND has_insurance=false;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='V8 Bank'      AND table_key IS NULL AND term_min=6  AND term_max=10 AND has_insurance=false;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='V8 Bank'      AND table_key IS NULL AND term_min=12 AND term_max=18 AND has_insurance=false;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='V8 Bank'      AND table_key IS NULL AND term_min=24 AND term_max=24 AND has_insurance=false;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='V8 Bank'      AND table_key IS NULL AND term_min=36 AND term_max=36 AND has_insurance=false;
DELETE FROM public.commission_rates_clt_v2 WHERE bank='ZiliCred'     AND table_key IS NULL AND term_min=0  AND term_max=999 AND has_insurance=true;

-- Reinserções oficiais (bank, table_key, has_insurance, term_min, term_max, rate, effective_date)
INSERT INTO public.commission_rates_clt_v2 (bank, table_key, has_insurance, term_min, term_max, rate, effective_date) VALUES
  ('Banco C6',     NULL,         false, 6,  6,  1.50, CURRENT_DATE),
  ('Banco C6',     NULL,         false, 12, 12, 2.00, CURRENT_DATE),
  ('Banco C6',     NULL,         false, 18, 18, 2.20, CURRENT_DATE),
  ('Banco C6',     NULL,         false, 24, 24, 2.50, CURRENT_DATE),
  ('Banco C6',     NULL,         false, 36, 48, 2.70, CURRENT_DATE),
  ('Banco C6',     '4 Parcela',  true,  12, 12, 2.20, CURRENT_DATE),
  ('Banco C6',     '4 Parcela',  true,  18, 18, 2.60, CURRENT_DATE),
  ('Banco C6',     '4 Parcela',  true,  24, 24, 2.90, CURRENT_DATE),
  ('Banco C6',     '4 Parcela',  true,  36, 36, 3.10, CURRENT_DATE),
  ('Banco C6',     '4 Parcela',  true,  48, 48, 3.40, CURRENT_DATE),
  ('FACTA',        NULL,         false, 6,  20, 3.30, CURRENT_DATE),
  ('FACTA',        NULL,         false, 24, 48, 3.80, CURRENT_DATE),
  ('Happy Consig', NULL,         false, 18, 18, 1.00, CURRENT_DATE),
  ('Happy Consig', NULL,         true,  18, 18, 1.80, CURRENT_DATE),
  ('Happy Consig', NULL,         false, 24, 24, 1.40, CURRENT_DATE),
  ('Happy Consig', NULL,         true,  24, 24, 2.25, CURRENT_DATE),
  ('Happy Consig', NULL,         false, 36, 36, 2.00, CURRENT_DATE),
  ('Happy Consig', NULL,         true,  36, 36, 3.60, CURRENT_DATE),
  ('MERCANTIL',    NULL,         false, 0,  999, 3.00, CURRENT_DATE),
  ('MERCANTIL',    NULL,         true,  0,  999, 4.50, CURRENT_DATE),
  ('Prata Digital',NULL,         false, 6,  6,  2.75, CURRENT_DATE),
  ('Prata Digital',NULL,         false, 12, 12, 3.25, CURRENT_DATE),
  ('Prata Digital',NULL,         false, 24, 36, 5.00, CURRENT_DATE),
  ('Presença Bank',NULL,         false, 6,  6,  3.25, CURRENT_DATE),
  ('Presença Bank',NULL,         false, 12, 12, 4.25, CURRENT_DATE),
  ('Presença Bank',NULL,         false, 24, 24, 4.50, CURRENT_DATE),
  ('Presença Bank',NULL,         false, 36, 36, 4.75, CURRENT_DATE),
  ('Qualibank',    NULL,         false, 24, 24, 4.25, CURRENT_DATE),
  ('V8 Bank',      NULL,         false, 6,  10, 2.50, CURRENT_DATE),
  ('V8 Bank',      NULL,         false, 12, 18, 3.00, CURRENT_DATE),
  ('V8 Bank',      NULL,         false, 24, 24, 3.75, CURRENT_DATE),
  ('V8 Bank',      NULL,         false, 36, 36, 4.25, CURRENT_DATE),
  ('ZiliCred',     NULL,         true,  0,  999, 2.90, CURRENT_DATE);

-- ============================================================
-- FGTS V2 — DIVERGÊNCIA: PARANA BANCO 14% -> 4%
-- ============================================================
UPDATE public.commission_rates_fgts_v2
   SET rate = 4.00
 WHERE bank = 'PARANA BANCO' AND table_key IS NULL;

-- ============================================================
-- CLT V2 — FALTANTES (HUB CLT + C6 com seguro 6P e 9P)
-- (V8 Bank, C6 Normal e C6 4P já entraram acima)
-- ============================================================
INSERT INTO public.commission_rates_clt_v2 (bank, table_key, has_insurance, term_min, term_max, rate, effective_date) VALUES
  ('HUB',      'SONHO DO CLT',    false, 0,  999, 3.25, CURRENT_DATE),
  ('HUB',      'FOCO NO CORBAN',  false, 0,  999, 2.50, CURRENT_DATE),
  ('HUB',      'CARTADA CLT',     false, 0,  999, 2.25, CURRENT_DATE),
  ('Banco C6', NULL,              false, 9,  9,  1.50, CURRENT_DATE),
  ('Banco C6', '6 Parcela',       true,  12, 12, 2.20, CURRENT_DATE),
  ('Banco C6', '6 Parcela',       true,  18, 18, 2.70, CURRENT_DATE),
  ('Banco C6', '6 Parcela',       true,  24, 24, 3.00, CURRENT_DATE),
  ('Banco C6', '6 Parcela',       true,  36, 36, 3.20, CURRENT_DATE),
  ('Banco C6', '6 Parcela',       true,  48, 48, 3.50, CURRENT_DATE),
  ('Banco C6', '9 Parcela',       true,  12, 12, 2.40, CURRENT_DATE),
  ('Banco C6', '9 Parcela',       true,  18, 18, 2.90, CURRENT_DATE),
  ('Banco C6', '9 Parcela',       true,  24, 24, 3.20, CURRENT_DATE),
  ('Banco C6', '9 Parcela',       true,  36, 36, 3.40, CURRENT_DATE),
  ('Banco C6', '9 Parcela',       true,  48, 48, 3.60, CURRENT_DATE);

-- ============================================================
-- FGTS V2 — FALTANTES
-- ============================================================
INSERT INTO public.commission_rates_fgts_v2 (bank, table_key, has_insurance, term_min, term_max, min_value, max_value, rate, effective_date) VALUES
  ('PARANA BANCO', NULL,            true,  0, 999, 0.01, 999999999.99, 6.50, CURRENT_DATE),
  ('HUB',          'CARTA NA MANGA', false, 0, 999, 0.01, 250.00,       20.50, CURRENT_DATE),
  ('HUB',          'CARTA NA MANGA', false, 0, 999, 251.00, 999999.99,  17.00, CURRENT_DATE);

-- ============================================================
-- PERFORMANCE V2 — filtros por contacted_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_performance_stats_v2(
  _date_from timestamp with time zone DEFAULT NULL,
  _date_to   timestamp with time zone DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  lead_stats jsonb;
  msg_stats jsonb;
BEGIN
  -- Permissão: apenas master/admin/manager
  IF NOT public.is_privileged(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Lead stats: contatados/aprovados pelo período em que o vendedor tirou de pendente.
  -- 'total' = leads atribuídos no período (mantém a base de comparação).
  -- 'pending' = leads atribuídos no período que ainda estão pendentes (não dependem de data de contato).
  SELECT COALESCE(jsonb_agg(row_to_json(sub)), '[]'::jsonb)
    INTO lead_stats
  FROM (
    SELECT
      cl.assigned_to AS user_id,
      COUNT(*) FILTER (
        WHERE (_date_from IS NULL OR cl.created_at >= _date_from)
          AND (_date_to   IS NULL OR cl.created_at <= _date_to)
      ) AS total,
      COUNT(*) FILTER (
        WHERE cl.contacted_at IS NOT NULL
          AND (_date_from IS NULL OR cl.contacted_at >= _date_from)
          AND (_date_to   IS NULL OR cl.contacted_at <= _date_to)
      ) AS contacted,
      COUNT(*) FILTER (
        WHERE UPPER(cl.status) = 'APROVADO'
          AND cl.contacted_at IS NOT NULL
          AND (_date_from IS NULL OR cl.contacted_at >= _date_from)
          AND (_date_to   IS NULL OR cl.contacted_at <= _date_to)
      ) AS approved,
      COUNT(*) FILTER (
        WHERE (cl.status IS NULL OR cl.status = 'pendente')
          AND (_date_from IS NULL OR cl.created_at >= _date_from)
          AND (_date_to   IS NULL OR cl.created_at <= _date_to)
      ) AS pending
    FROM client_leads cl
    WHERE cl.assigned_to IS NOT NULL
    GROUP BY cl.assigned_to
  ) sub;

  -- Mensagens (mantém created_at: mensagens são imutáveis)
  SELECT COALESCE(jsonb_agg(row_to_json(sub)), '[]'::jsonb)
    INTO msg_stats
  FROM (
    SELECT
      mh.chip_id,
      COUNT(*) FILTER (WHERE mh.direction = 'outgoing') AS sent,
      COUNT(*) FILTER (WHERE mh.direction = 'incoming') AS received
    FROM message_history mh
    INNER JOIN chips c ON c.id = mh.chip_id AND c.chip_type != 'warming'
    WHERE (_date_from IS NULL OR mh.created_at >= _date_from)
      AND (_date_to   IS NULL OR mh.created_at <= _date_to)
    GROUP BY mh.chip_id
  ) sub;

  result := jsonb_build_object('leads', lead_stats, 'messages', msg_stats);
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_lead_status_distribution_v2(
  _date_from timestamp with time zone DEFAULT NULL,
  _date_to   timestamp with time zone DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_privileged(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(sub)), '[]'::jsonb)
    INTO result
  FROM (
    SELECT
      COALESCE(NULLIF(TRIM(status), ''), 'pendente') AS status,
      COUNT(*) AS count
    FROM client_leads
    WHERE
      -- Pendentes: contam pela criação (não há contato ainda)
      (
        (status IS NULL OR status = 'pendente')
        AND (_date_from IS NULL OR created_at >= _date_from)
        AND (_date_to   IS NULL OR created_at <= _date_to)
      )
      OR
      -- Demais status: filtram pela data em que vendedor tirou de pendente
      (
        status IS NOT NULL AND status <> 'pendente'
        AND contacted_at IS NOT NULL
        AND (_date_from IS NULL OR contacted_at >= _date_from)
        AND (_date_to   IS NULL OR contacted_at <= _date_to)
      )
    GROUP BY COALESCE(NULLIF(TRIM(status), ''), 'pendente')
    ORDER BY count DESC
  ) sub;

  RETURN result;
END;
$$;