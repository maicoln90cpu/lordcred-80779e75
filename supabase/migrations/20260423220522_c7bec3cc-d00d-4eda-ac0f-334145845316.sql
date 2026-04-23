-- ============================================================
-- ETAPA 1: Simulador V8 CLT — Estrutura de banco
-- ============================================================

-- 1) Cache de configurações (tabelas de taxa) da V8
CREATE TABLE public.v8_configs_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id text NOT NULL UNIQUE,
  name text NOT NULL,
  product_type text,
  bank_name text,
  min_term integer,
  max_term integer,
  min_value numeric,
  max_value numeric,
  raw_data jsonb,
  is_active boolean NOT NULL DEFAULT true,
  synced_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_v8_configs_cache_active ON public.v8_configs_cache(is_active);
CREATE INDEX idx_v8_configs_cache_bank ON public.v8_configs_cache(bank_name);

-- 2) Lotes de simulação
CREATE TABLE public.v8_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  config_id text,
  config_name text,
  installments integer,
  total_count integer NOT NULL DEFAULT 0,
  pending_count integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  failure_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'processing',
  created_by uuid NOT NULL,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_v8_batches_created_by ON public.v8_batches(created_by);
CREATE INDEX idx_v8_batches_status ON public.v8_batches(status);
CREATE INDEX idx_v8_batches_created_at ON public.v8_batches(created_at DESC);

-- 3) Simulações individuais
CREATE TABLE public.v8_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.v8_batches(id) ON DELETE CASCADE,
  cpf text NOT NULL,
  name text,
  birth_date date,
  config_id text,
  config_name text,
  installments integer,
  released_value numeric,
  installment_value numeric,
  total_value numeric,
  interest_rate numeric,
  company_margin numeric,
  amount_to_charge numeric,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  raw_response jsonb,
  created_by uuid NOT NULL,
  processed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_v8_simulations_batch ON public.v8_simulations(batch_id);
CREATE INDEX idx_v8_simulations_cpf ON public.v8_simulations(cpf);
CREATE INDEX idx_v8_simulations_status ON public.v8_simulations(status);
CREATE INDEX idx_v8_simulations_created_by ON public.v8_simulations(created_by);

-- 4) Configuração de margem (singleton)
CREATE TABLE public.v8_margin_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  margin_percent numeric NOT NULL DEFAULT 5.0,
  notes text,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO public.v8_margin_config (margin_percent, notes) VALUES (5.0, 'Margem padrão inicial');

-- 5) View de resumo por lote
CREATE OR REPLACE VIEW public.v8_batch_summary AS
SELECT
  b.id,
  b.name,
  b.config_name,
  b.installments,
  b.total_count,
  b.pending_count,
  b.success_count,
  b.failure_count,
  b.status,
  b.created_by,
  b.created_at,
  b.completed_at,
  CASE WHEN b.total_count > 0 THEN ROUND(b.success_count::numeric / b.total_count * 100, 1) ELSE 0 END AS success_rate,
  COALESCE(SUM(s.released_value) FILTER (WHERE s.status = 'success'), 0) AS total_released,
  COALESCE(SUM(s.company_margin) FILTER (WHERE s.status = 'success'), 0) AS total_margin,
  COALESCE(AVG(s.released_value) FILTER (WHERE s.status = 'success'), 0) AS avg_released
FROM public.v8_batches b
LEFT JOIN public.v8_simulations s ON s.batch_id = b.id
GROUP BY b.id;

-- 6) Funções para incremento atômico de contadores
CREATE OR REPLACE FUNCTION public.v8_increment_batch_success(_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.v8_batches
  SET success_count = success_count + 1,
      pending_count = GREATEST(pending_count - 1, 0),
      updated_at = now(),
      status = CASE WHEN pending_count - 1 <= 0 THEN 'completed' ELSE status END,
      completed_at = CASE WHEN pending_count - 1 <= 0 THEN now() ELSE completed_at END
  WHERE id = _batch_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.v8_increment_batch_failure(_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.v8_batches
  SET failure_count = failure_count + 1,
      pending_count = GREATEST(pending_count - 1, 0),
      updated_at = now(),
      status = CASE WHEN pending_count - 1 <= 0 THEN 'completed' ELSE status END,
      completed_at = CASE WHEN pending_count - 1 <= 0 THEN now() ELSE completed_at END
  WHERE id = _batch_id;
END;
$$;

-- 7) Triggers para updated_at
CREATE TRIGGER update_v8_configs_cache_updated_at
  BEFORE UPDATE ON public.v8_configs_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_v8_batches_updated_at
  BEFORE UPDATE ON public.v8_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_v8_simulations_updated_at
  BEFORE UPDATE ON public.v8_simulations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_v8_margin_config_updated_at
  BEFORE UPDATE ON public.v8_margin_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8) RLS
ALTER TABLE public.v8_configs_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v8_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v8_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v8_margin_config ENABLE ROW LEVEL SECURITY;

-- v8_configs_cache: leitura para autenticados, escrita só privilegiados
CREATE POLICY "Authenticated can read v8 configs"
  ON public.v8_configs_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Privileged can manage v8 configs"
  ON public.v8_configs_cache FOR ALL
  TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- v8_batches: vendedor vê só os próprios; privilegiados veem tudo
CREATE POLICY "Users see own batches or privileged see all"
  ON public.v8_batches FOR SELECT
  TO authenticated
  USING (created_by = auth.uid() OR is_privileged(auth.uid()));

CREATE POLICY "Authenticated can create batches"
  ON public.v8_batches FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owner or privileged can update batches"
  ON public.v8_batches FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR is_privileged(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR is_privileged(auth.uid()));

CREATE POLICY "Privileged can delete batches"
  ON public.v8_batches FOR DELETE
  TO authenticated
  USING (is_privileged(auth.uid()));

-- v8_simulations: mesma lógica do batch dono
CREATE POLICY "Users see own simulations or privileged see all"
  ON public.v8_simulations FOR SELECT
  TO authenticated
  USING (created_by = auth.uid() OR is_privileged(auth.uid()));

CREATE POLICY "Authenticated can create simulations"
  ON public.v8_simulations FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owner or privileged can update simulations"
  ON public.v8_simulations FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR is_privileged(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR is_privileged(auth.uid()));

CREATE POLICY "Privileged can delete simulations"
  ON public.v8_simulations FOR DELETE
  TO authenticated
  USING (is_privileged(auth.uid()));

-- v8_margin_config: leitura todos, edição privilegiados
CREATE POLICY "Authenticated can read margin config"
  ON public.v8_margin_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Privileged can manage margin config"
  ON public.v8_margin_config FOR ALL
  TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));