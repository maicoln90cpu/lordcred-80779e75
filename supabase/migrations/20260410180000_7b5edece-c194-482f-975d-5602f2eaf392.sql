-- Adicionar coluna document_key para rastrear o documento ClickSign
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS document_key text;

-- Criar índice para busca rápida pelo webhook
CREATE INDEX IF NOT EXISTS idx_partners_document_key ON public.partners (document_key) WHERE document_key IS NOT NULL;
