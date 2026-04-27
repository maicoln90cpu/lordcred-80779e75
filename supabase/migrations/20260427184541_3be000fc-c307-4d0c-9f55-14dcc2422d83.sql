-- 1) Tabela singleton de configurações do simulador V8
CREATE TABLE IF NOT EXISTS public.v8_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  max_auto_retry_attempts integer NOT NULL DEFAULT 15 CHECK (max_auto_retry_attempts >= 0 AND max_auto_retry_attempts <= 100),
  retry_min_backoff_seconds integer NOT NULL DEFAULT 10 CHECK (retry_min_backoff_seconds >= 1),
  retry_max_backoff_seconds integer NOT NULL DEFAULT 120 CHECK (retry_max_backoff_seconds >= 1),
  background_retry_enabled boolean NOT NULL DEFAULT true,
  retry_batch_size integer NOT NULL DEFAULT 25 CHECK (retry_batch_size >= 1 AND retry_batch_size <= 200),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.v8_settings (singleton) VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

ALTER TABLE public.v8_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v8_settings_select_privileged" ON public.v8_settings
  FOR SELECT TO authenticated
  USING (public.is_privileged(auth.uid()));

CREATE POLICY "v8_settings_update_privileged" ON public.v8_settings
  FOR UPDATE TO authenticated
  USING (public.is_privileged(auth.uid()))
  WITH CHECK (public.is_privileged(auth.uid()));

-- 2) Histórico granular de cada tentativa de simulação
CREATE TABLE IF NOT EXISTS public.v8_simulation_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id uuid NOT NULL REFERENCES public.v8_simulations(id) ON DELETE CASCADE,
  batch_id uuid,
  attempt_number integer NOT NULL,
  triggered_by text NOT NULL DEFAULT 'user', -- user | cron | manual_retry
  triggered_by_user uuid,
  request_payload jsonb,
  response_body jsonb,
  http_status integer,
  status text, -- success | failed | pending | processing
  error_kind text,
  error_message text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v8_attempts_sim ON public.v8_simulation_attempts(simulation_id, attempt_number DESC);
CREATE INDEX IF NOT EXISTS idx_v8_attempts_batch ON public.v8_simulation_attempts(batch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_v8_attempts_created ON public.v8_simulation_attempts(created_at DESC);

ALTER TABLE public.v8_simulation_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "v8_attempts_select_owner_or_priv" ON public.v8_simulation_attempts
  FOR SELECT TO authenticated
  USING (
    public.is_privileged(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.v8_simulations s
      WHERE s.id = simulation_id AND s.created_by = auth.uid()
    )
  );

-- INSERT é feito por edge functions (service role), sem policy de insert para usuários comuns

-- 3) Índice auxiliar para o cron varrer simulações elegíveis a retry
CREATE INDEX IF NOT EXISTS idx_v8_sim_retry_candidates
  ON public.v8_simulations(status, last_attempt_at)
  WHERE status = 'failed';

-- 4) Trigger para manter updated_at em v8_settings
CREATE OR REPLACE FUNCTION public.v8_settings_touch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_v8_settings_touch ON public.v8_settings;
CREATE TRIGGER trg_v8_settings_touch
  BEFORE UPDATE ON public.v8_settings
  FOR EACH ROW EXECUTE FUNCTION public.v8_settings_touch();