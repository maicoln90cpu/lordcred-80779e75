-- ETAPA 1a: Apenas adicionar 'master' ao enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'master';