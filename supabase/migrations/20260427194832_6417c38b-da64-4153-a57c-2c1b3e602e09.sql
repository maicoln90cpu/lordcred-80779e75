-- ============================================================
-- FGTS HUB — reset e recriação conforme planilha (6 linhas oficiais)
-- ============================================================
DELETE FROM public.commission_rates_fgts_v2 WHERE bank = 'HUB';

INSERT INTO public.commission_rates_fgts_v2
  (effective_date, bank, table_key, term_min, term_max, min_value, max_value, has_insurance, rate, obs)
VALUES
  (CURRENT_DATE, 'HUB', 'SONHO',          0, 999, 0,    250,        false, 13.25, 'HUB Sonho no Corban até 250'),
  (CURRENT_DATE, 'HUB', 'SONHO',          0, 999, 250.01, 999999999, false, 11.15, 'HUB Sonho no Corban acima 250'),
  (CURRENT_DATE, 'HUB', 'FOCO',           0, 999, 0,    250,        false, 10.25, 'HUB Foco no Corban até 250'),
  (CURRENT_DATE, 'HUB', 'FOCO',           0, 999, 250.01, 999999999, false,  9.25, 'HUB Foco no Corban acima 250'),
  (CURRENT_DATE, 'HUB', 'CARTA NA MANGA', 0, 999, 0,    250,        false,  2.75, 'HUB Carta na Manga até 250'),
  (CURRENT_DATE, 'HUB', 'CARTA NA MANGA', 0, 999, 250.01, 999999999, false,  4.25, 'HUB Carta na Manga acima 250');

-- Linhas "Com valor contrato R$ 0,01-250 = 20.50" e "251-999.999 = 17.00" da planilha
-- ficam como banco genérico "GENERICO" para o usuário revisar depois.
INSERT INTO public.commission_rates_fgts_v2
  (effective_date, bank, table_key, term_min, term_max, min_value, max_value, has_insurance, rate, obs)
VALUES
  (CURRENT_DATE, 'GENERICO', 'FAIXA VALOR', 0, 999, 0.01,   250,       false, 20.50, 'Faixa valor R$ 0,01 a 250 — revisar mapeamento de banco'),
  (CURRENT_DATE, 'GENERICO', 'FAIXA VALOR', 0, 999, 251,    999999.99, false, 17.00, 'Faixa valor R$ 251 a 999.999 — revisar mapeamento de banco');

-- ============================================================
-- CLT FACTA — remove 2 linhas legadas genéricas
-- ============================================================
DELETE FROM public.commission_rates_clt_v2
WHERE bank = 'FACTA' AND table_key IS NULL;

-- ============================================================
-- CLT Banco C6 — remove 8 linhas extras não previstas na planilha
-- A planilha tem 21: 6/9/12/18/24/36/48 sem seguro (7) + 2P/4P/6P/9P × 12/18/24/36/48 (parciais).
-- Lista oficial: C6 6 Todos, 9 Todos, 12/18/24/36-48 Normal sem seg + faixas com seguro 4P/6P/9P (sem 2P).
-- Hoje DB tem 29: vou remover 2 Parcela (não existe na planilha, era linha 40-50 antiga),
-- e a linha duplicada de 36m com rate 3.20 (não está na planilha — tem só 36 ao 48 = 2.70).
-- ============================================================

-- Remove tabela "2 Parcela" (não existe na planilha)
DELETE FROM public.commission_rates_clt_v2
WHERE bank = 'Banco C6' AND table_key = '2 Parcela';

-- Remove linha "36 Normal" rate 3.2 (planilha tem só 36 ao 48 = 2.70)
DELETE FROM public.commission_rates_clt_v2
WHERE bank = 'Banco C6' AND table_key IS NULL AND term_min = 36 AND term_max = 36 AND rate = 3.2;

-- Remove linha "48 Normal" rate 3.5 (planilha tem 36 ao 48 unificado em 2.70)
DELETE FROM public.commission_rates_clt_v2
WHERE bank = 'Banco C6' AND table_key IS NULL AND term_min = 48 AND term_max = 48 AND rate = 3.5;

-- ============================================================
-- CLT Qualibank — remove duplicata de 36m (mantém faixa 36-99)
-- ============================================================
DELETE FROM public.commission_rates_clt_v2
WHERE bank = 'Qualibank' AND term_min = 36 AND term_max = 36;

-- ============================================================
-- CLT ZiliCred — remove linha duplicada genérica
-- ============================================================
DELETE FROM public.commission_rates_clt_v2
WHERE bank = 'ZiliCred' AND has_insurance = false AND term_min = 0 AND term_max = 999 AND rate = 1.5;

-- ============================================================
-- RLS nas tabelas backup (silencia 2 ERRORs do linter)
-- ============================================================
ALTER TABLE public.commission_rates_fgts_v2_backup_20260427b ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rates_clt_v2_backup_20260427b ENABLE ROW LEVEL SECURITY;

-- Apenas privileged podem ler os backups (admin/manager/master)
CREATE POLICY "Privileged read fgts backup b"
  ON public.commission_rates_fgts_v2_backup_20260427b
  FOR SELECT TO authenticated
  USING (public.is_privileged(auth.uid()));

CREATE POLICY "Privileged read clt backup b"
  ON public.commission_rates_clt_v2_backup_20260427b
  FOR SELECT TO authenticated
  USING (public.is_privileged(auth.uid()));

-- ============================================================
-- Recálculo final de vendas V2 com taxas atualizadas
-- ============================================================
UPDATE public.commission_sales_v2 SET sale_date = sale_date;
