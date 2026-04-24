
-- Etapa 5: infra para receber webhooks V8 em tempo real

-- 1. Marca quando última atualização via webhook foi recebida (debug + UI)
ALTER TABLE public.v8_simulations
  ADD COLUMN IF NOT EXISTS last_webhook_at timestamptz,
  ADD COLUMN IF NOT EXISTS webhook_status text;

CREATE INDEX IF NOT EXISTS v8_simulations_consult_id_idx
  ON public.v8_simulations (consult_id) WHERE consult_id IS NOT NULL;

-- 2. Tabela leve para rastrear operações V8 recebidas via webhook
CREATE TABLE IF NOT EXISTS public.v8_operations_local (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id text NOT NULL UNIQUE,
  consult_id text,
  v8_simulation_id text,
  status text,
  raw_payload jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS v8_operations_local_consult_idx
  ON public.v8_operations_local (consult_id);

ALTER TABLE public.v8_operations_local ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Privileged read v8_operations_local" ON public.v8_operations_local;
CREATE POLICY "Privileged read v8_operations_local"
  ON public.v8_operations_local FOR SELECT
  TO authenticated
  USING (public.is_privileged(auth.uid()));

-- 3. Tabela para guardar status do registro de webhook na V8
CREATE TABLE IF NOT EXISTS public.v8_webhook_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_type text NOT NULL UNIQUE,  -- 'consult' | 'operation'
  registered_url text NOT NULL,
  last_registered_at timestamptz,
  last_status text,                    -- 'success' | 'failed' | 'pending'
  last_error text,
  last_test_received_at timestamptz,   -- recebemos webhook.test
  last_confirm_received_at timestamptz, -- recebemos webhook.registered
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.v8_webhook_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Privileged read v8_webhook_registrations" ON public.v8_webhook_registrations;
CREATE POLICY "Privileged read v8_webhook_registrations"
  ON public.v8_webhook_registrations FOR SELECT
  TO authenticated
  USING (public.is_privileged(auth.uid()));
