
-- Adicionar ordem nas mensagens
ALTER TABLE public.warming_messages 
ADD COLUMN IF NOT EXISTS message_order INTEGER DEFAULT 0;

-- Numerar mensagens existentes
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) - 1 as rn
  FROM public.warming_messages
)
UPDATE public.warming_messages 
SET message_order = numbered.rn
FROM numbered
WHERE warming_messages.id = numbered.id;

-- Contador global na tabela system_settings
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS global_message_cursor INTEGER DEFAULT 0;
