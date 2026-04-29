-- Bonus B: coluna dedicada para erro do /simulate (separado do erro da /consult)
ALTER TABLE public.v8_simulations
  ADD COLUMN IF NOT EXISTS simulate_error_message TEXT;

COMMENT ON COLUMN public.v8_simulations.simulate_error_message IS
  'Mensagem de erro retornada pela V8 no endpoint /simulate. Separado de error_message (que é da /consult) para evitar sobrescrita quando a consulta deu OK mas a simulação falhou.';

-- Bonus A: backfill — remove prefixo "Rejeitada pela V8:" de linhas antigas
UPDATE public.v8_simulations
SET error_message = REGEXP_REPLACE(error_message, '^Rejeitada pela V8:\s*', '', 'i')
WHERE error_message ILIKE 'Rejeitada pela V8:%';