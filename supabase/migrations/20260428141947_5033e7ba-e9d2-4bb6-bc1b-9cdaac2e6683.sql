-- V8 — Estratégia webhook_only: separa /consult de /simulate
-- Lote agora dispara só consulta de margem; simulate vira sob demanda (manual ou auto-throttled).

-- 1) Novas colunas em v8_simulations
ALTER TABLE public.v8_simulations
  ADD COLUMN IF NOT EXISTS simulate_status text DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS simulate_attempted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS simulation_strategy text DEFAULT 'legacy_sync';

COMMENT ON COLUMN public.v8_simulations.simulate_status IS
  'Etapa de simulate (POST /simulation): not_started | queued | running | done | failed. Independente do status da consulta de margem.';
COMMENT ON COLUMN public.v8_simulations.simulation_strategy IS
  'Estratégia de criação: legacy_sync (consulta+simulate juntos) | webhook_only (só consulta, simulate sob demanda).';

CREATE INDEX IF NOT EXISTS idx_v8_simulations_simulate_status
  ON public.v8_simulations(simulate_status)
  WHERE simulate_status IN ('not_started','queued','failed');

-- 2) Novas colunas em v8_settings (singleton)
ALTER TABLE public.v8_settings
  ADD COLUMN IF NOT EXISTS simulation_strategy text DEFAULT 'webhook_only',
  ADD COLUMN IF NOT EXISTS auto_simulate_after_consult boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS consult_throttle_ms integer DEFAULT 1200,
  ADD COLUMN IF NOT EXISTS simulate_throttle_ms integer DEFAULT 1200,
  ADD COLUMN IF NOT EXISTS webhook_wait_timeout_min integer DEFAULT 5;

COMMENT ON COLUMN public.v8_settings.simulation_strategy IS
  'webhook_only (recomendado) | legacy_sync (fluxo antigo, consulta+simulate síncrono).';
COMMENT ON COLUMN public.v8_settings.auto_simulate_after_consult IS
  'Se true, depois que webhook V8 retornar SUCCESS o sistema enfileira /simulate automaticamente (throttled).';