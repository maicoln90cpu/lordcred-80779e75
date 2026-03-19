
-- Message shortcuts table for trigger word auto-responses
CREATE TABLE public.message_shortcuts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  chip_id UUID REFERENCES public.chips(id) ON DELETE CASCADE,
  trigger_word TEXT NOT NULL,
  response_text TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX idx_message_shortcuts_chip_trigger ON public.message_shortcuts(chip_id, trigger_word);
CREATE INDEX idx_message_shortcuts_user ON public.message_shortcuts(user_id);

-- RLS
ALTER TABLE public.message_shortcuts ENABLE ROW LEVEL SECURITY;

-- Admins can manage all
CREATE POLICY "Admins can manage all shortcuts" ON public.message_shortcuts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Support can manage all
CREATE POLICY "Support can manage all shortcuts" ON public.message_shortcuts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'support'::app_role))
  WITH CHECK (has_role(auth.uid(), 'support'::app_role));

-- Users can manage their own shortcuts
CREATE POLICY "Users can manage own shortcuts" ON public.message_shortcuts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- User role can manage all
CREATE POLICY "User role can manage all shortcuts" ON public.message_shortcuts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'user'::app_role))
  WITH CHECK (has_role(auth.uid(), 'user'::app_role));
