
-- Blacklist global de números
CREATE TABLE public.broadcast_blacklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT broadcast_blacklist_phone_unique UNIQUE (phone)
);

ALTER TABLE public.broadcast_blacklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Privileged can manage blacklist"
  ON public.broadcast_blacklist
  FOR ALL
  TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

CREATE POLICY "Service can read blacklist"
  ON public.broadcast_blacklist
  FOR SELECT
  TO public
  USING (true);

-- Coluna lead_id em broadcast_recipients para vincular leads (variáveis dinâmicas)
ALTER TABLE public.broadcast_recipients
  ADD COLUMN IF NOT EXISTS lead_id UUID;

-- Coluna variant para suporte futuro A/B testing
ALTER TABLE public.broadcast_recipients
  ADD COLUMN IF NOT EXISTS variant TEXT;
