
-- ===== ETAPA 4A: Pool de contatos (mestra 300k+) =====

-- Tabela mestra de contatos importados (CPF + telefone + nome + dados extras)
CREATE TABLE IF NOT EXISTS public.v8_contact_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf text NOT NULL,
  full_name text,
  phone text,
  birth_date date,
  extra jsonb DEFAULT '{}'::jsonb,
  source_file text,
  source_batch_id uuid,
  imported_by uuid,
  imported_at timestamptz NOT NULL DEFAULT now(),
  -- Status de uso na simulação V8
  last_simulated_at timestamptz,
  last_simulation_status text,
  last_batch_id uuid,
  simulation_count integer NOT NULL DEFAULT 0,
  -- Cache de margem disponível (último resultado)
  last_available_margin numeric,
  -- Flags operacionais
  is_blocked boolean NOT NULL DEFAULT false,
  blocked_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- CPF normalizado deve ser único
CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_contact_pool_cpf
  ON public.v8_contact_pool ((regexp_replace(cpf, '\D', '', 'g')));

-- Índices para filtros frequentes
CREATE INDEX IF NOT EXISTS idx_v8_contact_pool_last_sim ON public.v8_contact_pool (last_simulated_at NULLS FIRST);
CREATE INDEX IF NOT EXISTS idx_v8_contact_pool_status ON public.v8_contact_pool (last_simulation_status);
CREATE INDEX IF NOT EXISTS idx_v8_contact_pool_blocked ON public.v8_contact_pool (is_blocked);
CREATE INDEX IF NOT EXISTS idx_v8_contact_pool_imported_at ON public.v8_contact_pool (imported_at DESC);

-- Trigger updated_at
CREATE TRIGGER trg_v8_contact_pool_touch
  BEFORE UPDATE ON public.v8_contact_pool
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.v8_contact_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Privileged can read pool"
  ON public.v8_contact_pool FOR SELECT
  USING (public.is_privileged(auth.uid()));

CREATE POLICY "Privileged can insert pool"
  ON public.v8_contact_pool FOR INSERT
  WITH CHECK (public.is_privileged(auth.uid()));

CREATE POLICY "Privileged can update pool"
  ON public.v8_contact_pool FOR UPDATE
  USING (public.is_privileged(auth.uid()));

CREATE POLICY "Privileged can delete pool"
  ON public.v8_contact_pool FOR DELETE
  USING (public.is_privileged(auth.uid()));

-- ===== Lotes de importação do pool =====
CREATE TABLE IF NOT EXISTS public.v8_contact_pool_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  storage_path text,
  row_count integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  invalid_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  error_message text,
  imported_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.v8_contact_pool_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Privileged can manage pool imports"
  ON public.v8_contact_pool_imports FOR ALL
  USING (public.is_privileged(auth.uid()))
  WITH CHECK (public.is_privileged(auth.uid()));

-- ===== Função: marcar contatos após simulação =====
CREATE OR REPLACE FUNCTION public.v8_pool_mark_simulated(
  _cpf text,
  _batch_id uuid,
  _status text,
  _available_margin numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.v8_contact_pool
  SET last_simulated_at = now(),
      last_simulation_status = _status,
      last_batch_id = _batch_id,
      last_available_margin = COALESCE(_available_margin, last_available_margin),
      simulation_count = simulation_count + 1,
      updated_at = now()
  WHERE regexp_replace(cpf, '\D', '', 'g') = regexp_replace(_cpf, '\D', '', 'g');
END;
$$;

-- ===== Bucket de storage para arquivos originais =====
INSERT INTO storage.buckets (id, name, public)
VALUES ('v8-contact-pool', 'v8-contact-pool', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Privileged can read pool files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'v8-contact-pool' AND public.is_privileged(auth.uid()));

CREATE POLICY "Privileged can upload pool files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'v8-contact-pool' AND public.is_privileged(auth.uid()));

CREATE POLICY "Privileged can delete pool files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'v8-contact-pool' AND public.is_privileged(auth.uid()));
