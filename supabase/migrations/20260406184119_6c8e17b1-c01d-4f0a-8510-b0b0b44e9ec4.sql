-- Fase 2: Migrar dados de taxas CLT para v2

-- 1. Converter obs "2 parceiros" → table_key "2 Parcela" no Banco C6
UPDATE public.commission_rates_clt
SET table_key = '2 Parcela'
WHERE bank = 'Banco C6' AND obs = '2 parceiros';

-- 2. Converter obs "4 parceiros" → table_key "4 Parcela" no Banco C6
UPDATE public.commission_rates_clt
SET table_key = '4 Parcela'
WHERE bank = 'Banco C6' AND obs = '4 parceiros';

-- 3. Inserir Hub Credito CLT — SONHO 3.25% (vigência 02/04/2026)
INSERT INTO public.commission_rates_clt (bank, rate, effective_date, has_insurance, term_min, term_max, table_key, obs)
VALUES ('Hub Credito', 3.25, '2026-04-02', false, 0, 999, 'SONHO', 'CLT - Ambos seguro');

INSERT INTO public.commission_rates_clt (bank, rate, effective_date, has_insurance, term_min, term_max, table_key, obs)
VALUES ('Hub Credito', 3.25, '2026-04-02', true, 0, 999, 'SONHO', 'CLT - Ambos seguro');

-- 4. Inserir Hub Credito CLT — FOCO 2.50%
INSERT INTO public.commission_rates_clt (bank, rate, effective_date, has_insurance, term_min, term_max, table_key, obs)
VALUES ('Hub Credito', 2.50, '2026-04-02', false, 0, 999, 'FOCO', 'CLT - Ambos seguro');

INSERT INTO public.commission_rates_clt (bank, rate, effective_date, has_insurance, term_min, term_max, table_key, obs)
VALUES ('Hub Credito', 2.50, '2026-04-02', true, 0, 999, 'FOCO', 'CLT - Ambos seguro');

-- 5. Inserir Hub Credito CLT — CARTADA 2.25%
INSERT INTO public.commission_rates_clt (bank, rate, effective_date, has_insurance, term_min, term_max, table_key, obs)
VALUES ('Hub Credito', 2.25, '2026-04-02', false, 0, 999, 'CARTADA', 'CLT - Ambos seguro');

INSERT INTO public.commission_rates_clt (bank, rate, effective_date, has_insurance, term_min, term_max, table_key, obs)
VALUES ('Hub Credito', 2.25, '2026-04-02', true, 0, 999, 'CARTADA', 'CLT - Ambos seguro');

-- 6. Expandir Qualibank prazo 36→99 (nova vigência 02/04/2026)
INSERT INTO public.commission_rates_clt (bank, rate, effective_date, has_insurance, term_min, term_max, table_key, obs)
VALUES ('Qualibank', 4.25, '2026-04-02', false, 24, 24, NULL, 'Mantém taxa 24m'),
       ('Qualibank', 5.00, '2026-04-02', false, 36, 99, NULL, 'Expandido para 36-99m');