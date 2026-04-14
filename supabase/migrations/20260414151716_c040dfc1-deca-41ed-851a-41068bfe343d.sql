-- Tabela de campanhas de disparo em massa
CREATE TABLE public.broadcast_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  message_content TEXT NOT NULL,
  chip_id UUID NOT NULL REFERENCES public.chips(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft',
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  rate_per_minute INTEGER NOT NULL DEFAULT 10,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.broadcast_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Privileged users can view campaigns"
ON public.broadcast_campaigns FOR SELECT
TO authenticated
USING (public.is_privileged(auth.uid()));

CREATE POLICY "Privileged users can manage campaigns"
ON public.broadcast_campaigns FOR ALL
TO authenticated
USING (public.is_privileged(auth.uid()))
WITH CHECK (public.is_privileged(auth.uid()));

CREATE TRIGGER update_broadcast_campaigns_updated_at
BEFORE UPDATE ON public.broadcast_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de destinatários por campanha
CREATE TABLE public.broadcast_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.broadcast_campaigns(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.broadcast_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Privileged users can view recipients"
ON public.broadcast_recipients FOR SELECT
TO authenticated
USING (public.is_privileged(auth.uid()));

CREATE POLICY "Privileged users can manage recipients"
ON public.broadcast_recipients FOR ALL
TO authenticated
USING (public.is_privileged(auth.uid()))
WITH CHECK (public.is_privileged(auth.uid()));

CREATE INDEX idx_broadcast_recipients_campaign ON public.broadcast_recipients(campaign_id);
CREATE INDEX idx_broadcast_recipients_status ON public.broadcast_recipients(campaign_id, status);