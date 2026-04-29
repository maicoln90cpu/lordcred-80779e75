
-- Etapa 5: Criação de Proposta V8 (POST /operation)
-- (1) Tabela de rascunhos com auto-save
-- (2) Toggle "exigir documentos no envio" em v8_settings

CREATE TABLE IF NOT EXISTS public.v8_operation_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  origin_type TEXT NOT NULL CHECK (origin_type IN ('simulation', 'lead', 'blank')),
  origin_id TEXT,
  cpf TEXT,
  borrower_name TEXT,
  form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_step TEXT,
  is_submitted BOOLEAN NOT NULL DEFAULT false,
  submitted_operation_id TEXT,
  submitted_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v8_operation_drafts_user
  ON public.v8_operation_drafts (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_v8_operation_drafts_origin
  ON public.v8_operation_drafts (origin_type, origin_id) WHERE origin_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_v8_operation_drafts_pending
  ON public.v8_operation_drafts (user_id, is_submitted) WHERE is_submitted = false;

ALTER TABLE public.v8_operation_drafts ENABLE ROW LEVEL SECURITY;

-- Owner pode tudo no seu rascunho
CREATE POLICY "v8_drafts_owner_select"
  ON public.v8_operation_drafts FOR SELECT
  USING (auth.uid() = user_id OR public.is_privileged());

CREATE POLICY "v8_drafts_owner_insert"
  ON public.v8_operation_drafts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "v8_drafts_owner_update"
  ON public.v8_operation_drafts FOR UPDATE
  USING (auth.uid() = user_id OR public.is_privileged());

CREATE POLICY "v8_drafts_owner_delete"
  ON public.v8_operation_drafts FOR DELETE
  USING (auth.uid() = user_id OR public.is_privileged());

-- Trigger updated_at
CREATE TRIGGER trg_v8_operation_drafts_updated_at
  BEFORE UPDATE ON public.v8_operation_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- (2) Toggle no v8_settings
ALTER TABLE public.v8_settings
  ADD COLUMN IF NOT EXISTS require_documents_on_create BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.v8_settings.require_documents_on_create IS
  'Quando true, o POST /operation só é aceito com pelo menos 1 documento anexado pelo usuário.';
COMMENT ON TABLE public.v8_operation_drafts IS
  'Rascunhos do formulário Criar Proposta V8 com auto-save por usuário.';
