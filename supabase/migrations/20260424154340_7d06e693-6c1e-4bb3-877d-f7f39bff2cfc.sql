-- 1. Colunas novas em v8_simulations
ALTER TABLE public.v8_simulations
  ADD COLUMN IF NOT EXISTS consult_id text,
  ADD COLUMN IF NOT EXISTS margem_valor numeric;

CREATE INDEX IF NOT EXISTS idx_v8_simulations_consult_id
  ON public.v8_simulations(consult_id)
  WHERE consult_id IS NOT NULL;

COMMENT ON COLUMN public.v8_simulations.consult_id IS
  'UUID retornado pela V8 no POST /private-consignment/consult — usado para correlacionar webhooks de status.';
COMMENT ON COLUMN public.v8_simulations.margem_valor IS
  'Margem da empresa em reais (released_value × percentual em v8_margin_config) calculada no momento da simulação.';

-- 2. Tabela de logs de webhook V8
CREATE TABLE IF NOT EXISTS public.v8_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  consult_id text,
  operation_id text,
  v8_simulation_id text,
  status text,
  payload jsonb NOT NULL,
  headers jsonb,
  processed boolean NOT NULL DEFAULT false,
  process_error text,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v8_webhook_logs_consult_id
  ON public.v8_webhook_logs(consult_id) WHERE consult_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_v8_webhook_logs_operation_id
  ON public.v8_webhook_logs(operation_id) WHERE operation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_v8_webhook_logs_received_at
  ON public.v8_webhook_logs(received_at DESC);

ALTER TABLE public.v8_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v8_webhook_logs_read_privileged"
  ON public.v8_webhook_logs FOR SELECT
  TO authenticated
  USING (public.is_privileged(auth.uid()));

COMMENT ON TABLE public.v8_webhook_logs IS
  'Eventos brutos recebidos do webhook V8 (consult/operation). Auditoria + replay. Inserts feitos pela edge function v8-webhook via service role.';