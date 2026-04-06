-- Fase 1: Novas colunas para Comissões v2

-- 1. Adicionar table_name e client_birth_date em commission_sales
ALTER TABLE public.commission_sales
  ADD COLUMN IF NOT EXISTS table_name text,
  ADD COLUMN IF NOT EXISTS client_birth_date text;

-- 2. Adicionar table_key em commission_rates_clt (nullable, NULL = taxa genérica)
ALTER TABLE public.commission_rates_clt
  ADD COLUMN IF NOT EXISTS table_key text;

-- Índice para facilitar busca por table_key
CREATE INDEX IF NOT EXISTS idx_commission_rates_clt_table_key
  ON public.commission_rates_clt (bank, table_key, effective_date DESC);