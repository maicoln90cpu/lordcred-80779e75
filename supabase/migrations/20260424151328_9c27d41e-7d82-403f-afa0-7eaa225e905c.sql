-- Adiciona coluna para guardar o ID externo da simulação V8 (Crédito do Trabalhador)
ALTER TABLE public.v8_simulations
  ADD COLUMN IF NOT EXISTS v8_simulation_id text;

CREATE INDEX IF NOT EXISTS idx_v8_simulations_v8_simulation_id
  ON public.v8_simulations(v8_simulation_id)
  WHERE v8_simulation_id IS NOT NULL;

COMMENT ON COLUMN public.v8_simulations.v8_simulation_id
  IS 'ID externo da simulação retornado pela V8 (usado para formalização posterior).';