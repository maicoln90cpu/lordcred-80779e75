-- Adicionar colunas de controle de aquecimento
ALTER TABLE public.chips
ADD COLUMN IF NOT EXISTS messages_sent_today INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP WITH TIME ZONE;

-- Função para resetar contador diário (será chamada por cron)
CREATE OR REPLACE FUNCTION public.reset_daily_message_count()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.chips SET messages_sent_today = 0;
END;
$$;

-- Habilitar realtime para chips e message_history
ALTER PUBLICATION supabase_realtime ADD TABLE public.chips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_history;