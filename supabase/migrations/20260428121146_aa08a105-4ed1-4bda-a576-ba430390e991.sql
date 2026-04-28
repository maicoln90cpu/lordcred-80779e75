ALTER TABLE public.v8_simulations
  ADD COLUMN IF NOT EXISTS admission_months_diff integer,
  ADD COLUMN IF NOT EXISTS sim_month_min integer,
  ADD COLUMN IF NOT EXISTS sim_month_max integer,
  ADD COLUMN IF NOT EXISTS sim_installments_min integer,
  ADD COLUMN IF NOT EXISTS sim_installments_max integer,
  ADD COLUMN IF NOT EXISTS sim_value_min numeric(14,2),
  ADD COLUMN IF NOT EXISTS sim_value_max numeric(14,2);

COMMENT ON COLUMN public.v8_simulations.admission_months_diff IS 'V8 webhook: admissionDateMonthsDifference — meses entre hoje e a admissão do trabalhador';
COMMENT ON COLUMN public.v8_simulations.sim_month_min IS 'V8 webhook: simulationLimit.monthMin — meses mín. da faixa do trabalhador';
COMMENT ON COLUMN public.v8_simulations.sim_month_max IS 'V8 webhook: simulationLimit.monthMax — meses máx. da faixa do trabalhador';
COMMENT ON COLUMN public.v8_simulations.sim_installments_min IS 'V8 webhook: simulationLimit.installmentsMin';
COMMENT ON COLUMN public.v8_simulations.sim_installments_max IS 'V8 webhook: simulationLimit.installmentsMax';
COMMENT ON COLUMN public.v8_simulations.sim_value_min IS 'V8 webhook: simulationLimit.valueMin';
COMMENT ON COLUMN public.v8_simulations.sim_value_max IS 'V8 webhook: simulationLimit.valueMax';