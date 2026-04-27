-- ============================================================
-- ETAPA 1: BACKUP
-- ============================================================
DROP TABLE IF EXISTS public.commission_rates_fgts_v2_backup_20260427b;
DROP TABLE IF EXISTS public.commission_rates_clt_v2_backup_20260427b;
CREATE TABLE public.commission_rates_fgts_v2_backup_20260427b AS
  SELECT * FROM public.commission_rates_fgts_v2;
CREATE TABLE public.commission_rates_clt_v2_backup_20260427b AS
  SELECT * FROM public.commission_rates_clt_v2;

-- ============================================================
-- ETAPA 2: FGTS
-- ============================================================

-- 2a) PARANA BANCO: zera e recria como 2 linhas oficiais
DELETE FROM public.commission_rates_fgts_v2 WHERE bank = 'PARANA BANCO';
INSERT INTO public.commission_rates_fgts_v2
  (effective_date, bank, table_key, term_min, term_max, min_value, max_value, has_insurance, rate, obs)
VALUES
  (CURRENT_DATE, 'PARANA BANCO', NULL, 0, 999, 0, 999999999, false, 4.00, 'Paraná Banco — sem seguro'),
  (CURRENT_DATE, 'PARANA BANCO', NULL, 0, 999, 0, 999999999, true,  6.50, 'Paraná Banco — com seguro');

-- 2b) HUB CARTA NA MANGA: remove 4 linhas legadas de faixa de valor
DELETE FROM public.commission_rates_fgts_v2
WHERE bank = 'HUB'
  AND table_key = 'CARTA NA MANGA'
  AND term_min = 1 AND term_max = 5;

-- 2c) LOTUS: insere 9 variantes faltantes
INSERT INTO public.commission_rates_fgts_v2
  (effective_date, bank, table_key, term_min, term_max, min_value, max_value, has_insurance, rate, obs)
VALUES
  (CURRENT_DATE, 'LOTUS', 'LOTUS 1+',     1, 1, 0, 999999999, true,  12.0, 'LOTUS 1+ Com Seguro'),
  (CURRENT_DATE, 'LOTUS', 'LOTUS 1R+',    1, 1, 0, 999999999, false, 11.0, 'LOTUS 1R+'),
  (CURRENT_DATE, 'LOTUS', 'LOTUS 2+',     2, 2, 0, 999999999, true,  10.5, 'LOTUS 2+ Com Seguro'),
  (CURRENT_DATE, 'LOTUS', 'LOTUS 2R+',    2, 2, 0, 999999999, false,  9.5, 'LOTUS 2R+'),
  (CURRENT_DATE, 'LOTUS', 'LOTUS 3+',     3, 3, 0, 999999999, true,   9.5, 'LOTUS 3+ Com Seguro'),
  (CURRENT_DATE, 'LOTUS', 'LOTUS 3R+',    3, 3, 0, 999999999, false,  8.5, 'LOTUS 3R+'),
  (CURRENT_DATE, 'LOTUS', 'LOTUS 4+',     4, 5, 0, 999999999, true,   7.5, 'LOTUS 4+ Com Seguro'),
  (CURRENT_DATE, 'LOTUS', 'LOTUS 4R+',    4, 5, 0, 999999999, false,  6.5, 'LOTUS 4R+'),
  (CURRENT_DATE, 'LOTUS', 'LOTUS SEM TAC',0, 999, 0, 999999999, false, 3.5, 'LOTUS SEM TAC');

-- ============================================================
-- ETAPA 3: CLT
-- ============================================================

-- 3a) Consolidar Hub Credito → HUB (uniformizar table_key também)
UPDATE public.commission_rates_clt_v2
SET bank = 'HUB',
    table_key = CASE
      WHEN UPPER(table_key) LIKE '%SONHO%' THEN 'SONHO DO CLT'
      WHEN UPPER(table_key) LIKE '%FOCO%'  THEN 'FOCO NO CORBAN'
      WHEN UPPER(table_key) LIKE '%CARTA%' THEN 'CARTADA CLT'
      ELSE table_key
    END
WHERE bank IN ('HUB', 'Hub Credito');

-- 3b) Banco C6: remover duplicatas (mantém menor ID por grupo)
DELETE FROM public.commission_rates_clt_v2
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY bank, COALESCE(table_key,''), term_min, term_max, has_insurance, rate
      ORDER BY id
    ) AS rn
    FROM public.commission_rates_clt_v2
    WHERE bank = 'Banco C6'
  ) t WHERE rn > 1
);

-- 3c) HUB CLT: remover duplicatas resultantes da consolidação acima
DELETE FROM public.commission_rates_clt_v2
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY bank, COALESCE(table_key,''), term_min, term_max, has_insurance
      ORDER BY id
    ) AS rn
    FROM public.commission_rates_clt_v2
    WHERE bank = 'HUB'
  ) t WHERE rn > 1
);

-- 3d) Happy Consig: remover sobras (linhas extras de 12m com rate 0.7/1.1 não previstas)
DELETE FROM public.commission_rates_clt_v2
WHERE bank = 'Happy Consig'
  AND term_min = 12 AND term_max = 12
  AND rate IN (0.7, 1.1);

-- 3e) Qualibank e ZiliCred: remover duplicatas restantes
DELETE FROM public.commission_rates_clt_v2
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY bank, COALESCE(table_key,''), term_min, term_max, has_insurance, rate
      ORDER BY id
    ) AS rn
    FROM public.commission_rates_clt_v2
    WHERE bank IN ('Qualibank', 'ZiliCred')
  ) t WHERE rn > 1
);

-- 3f) FACTA CLT: insere 10 tabelas faltantes
-- Remove possíveis duplicatas com mesmas chaves antes do INSERT
DELETE FROM public.commission_rates_clt_v2
WHERE bank = 'FACTA' AND table_key IN ('NOVO GOLD 2','NOVO GOLD 3','NOVO GOLD 4','NOVO SMART');

INSERT INTO public.commission_rates_clt_v2
  (effective_date, bank, table_key, term_min, term_max, has_insurance, rate, obs)
VALUES
  (CURRENT_DATE, 'FACTA', 'NOVO GOLD 2', 12, 18, false, 3.00, 'NOVO GOLD 2 - 12 a 18'),
  (CURRENT_DATE, 'FACTA', 'NOVO GOLD 2', 24, 24, false, 3.25, 'NOVO GOLD 2 - 24'),
  (CURRENT_DATE, 'FACTA', 'NOVO GOLD 2', 35, 48, false, 3.00, 'NOVO GOLD 2 - 35 a 48'),
  (CURRENT_DATE, 'FACTA', 'NOVO GOLD 3', 12, 18, false, 3.50, 'NOVO GOLD 3 - 12 a 18'),
  (CURRENT_DATE, 'FACTA', 'NOVO GOLD 3', 24, 24, false, 3.75, 'NOVO GOLD 3 - 24'),
  (CURRENT_DATE, 'FACTA', 'NOVO GOLD 3', 35, 48, false, 3.50, 'NOVO GOLD 3 - 35 a 48'),
  (CURRENT_DATE, 'FACTA', 'NOVO GOLD 4', 12, 18, false, 4.00, 'NOVO GOLD 4 - 12 a 18'),
  (CURRENT_DATE, 'FACTA', 'NOVO GOLD 4', 24, 24, false, 4.25, 'NOVO GOLD 4 - 24'),
  (CURRENT_DATE, 'FACTA', 'NOVO GOLD 4', 35, 48, false, 4.50, 'NOVO GOLD 4 - 35 a 48'),
  (CURRENT_DATE, 'FACTA', 'NOVO SMART',  12, 48, false, 2.55, 'NOVO SMART - 12 a 48');

-- ============================================================
-- ETAPA 4: PROTEÇÃO — UNIQUE INDEX (previne duplicatas futuras)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS commission_rates_fgts_v2_uniq
  ON public.commission_rates_fgts_v2
  (bank, COALESCE(table_key,''), term_min, term_max, has_insurance, min_value, max_value, effective_date);

CREATE UNIQUE INDEX IF NOT EXISTS commission_rates_clt_v2_uniq
  ON public.commission_rates_clt_v2
  (bank, COALESCE(table_key,''), term_min, term_max, has_insurance, effective_date);

-- ============================================================
-- ETAPA 5: RECÁLCULO DE VENDAS V2 já lançadas
-- (força o trigger calculate_commission_v2 via UPDATE no-op)
-- ============================================================
UPDATE public.commission_sales_v2 SET sale_date = sale_date;
