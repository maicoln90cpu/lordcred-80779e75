
-- Webhook logs table for diagnostics
CREATE TABLE public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chip_id uuid REFERENCES public.chips(id) ON DELETE CASCADE,
  instance_name text,
  event_type text NOT NULL,
  payload jsonb,
  status_code integer DEFAULT 200,
  processing_result text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhook logs" ON public.webhook_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Support can view webhook logs" ON public.webhook_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Users can view webhook logs" ON public.webhook_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Service can insert webhook logs" ON public.webhook_logs FOR INSERT TO public
  WITH CHECK (true);

-- RLS for support to manage message_queue (update/delete for pause/cancel)
CREATE POLICY "Support can update message queue" ON public.message_queue FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'support'::app_role))
  WITH CHECK (has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Support can delete message queue" ON public.message_queue FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'support'::app_role));

-- Index for webhook_logs performance
CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs (created_at DESC);
CREATE INDEX idx_webhook_logs_chip_id ON public.webhook_logs (chip_id);
