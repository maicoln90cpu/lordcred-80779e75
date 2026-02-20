-- Adicionar colunas anti-bloqueio na tabela system_settings
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS batch_size integer NOT NULL DEFAULT 5,
ADD COLUMN IF NOT EXISTS batch_pause_seconds integer NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS max_messages_per_hour integer NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS random_delay_variation integer NOT NULL DEFAULT 20,
ADD COLUMN IF NOT EXISTS typing_simulation boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS typing_speed_chars_sec integer NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS read_delay_seconds integer NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS online_offline_simulation boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS weekend_reduction_percent integer NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS night_mode_reduction integer NOT NULL DEFAULT 50,
ADD COLUMN IF NOT EXISTS consecutive_message_limit integer NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS cooldown_after_error integer NOT NULL DEFAULT 300,
ADD COLUMN IF NOT EXISTS human_pattern_mode boolean NOT NULL DEFAULT true;

-- Criar tabela de fila de mensagens
CREATE TABLE IF NOT EXISTS public.message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chip_id UUID NOT NULL REFERENCES public.chips(id) ON DELETE CASCADE,
  recipient_phone TEXT NOT NULL,
  message_content TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 5,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Habilitar RLS na tabela message_queue
ALTER TABLE public.message_queue ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para message_queue
CREATE POLICY "Admins can view all queue items"
ON public.message_queue
FOR SELECT
USING (is_admin());

CREATE POLICY "Admins can manage all queue items"
ON public.message_queue
FOR ALL
USING (is_admin());

CREATE POLICY "Users can view their own queue items"
ON public.message_queue
FOR SELECT
USING (chip_id IN (SELECT id FROM public.chips WHERE user_id = auth.uid()));

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_message_queue_status ON public.message_queue(status);
CREATE INDEX IF NOT EXISTS idx_message_queue_scheduled_at ON public.message_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_message_queue_chip_id ON public.message_queue(chip_id);

-- Habilitar realtime para message_queue
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_queue;