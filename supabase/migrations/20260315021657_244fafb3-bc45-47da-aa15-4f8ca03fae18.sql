
-- Phase 5: Global message templates table
CREATE TABLE public.message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'geral',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- All authenticated can read active templates
CREATE POLICY "Authenticated can read active templates"
  ON public.message_templates FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admins can manage all templates
CREATE POLICY "Admins can manage templates"
  ON public.message_templates FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- User role can manage templates
CREATE POLICY "Users can manage templates"
  ON public.message_templates FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'user'::app_role))
  WITH CHECK (has_role(auth.uid(), 'user'::app_role));

-- Support can manage templates
CREATE POLICY "Support can manage templates"
  ON public.message_templates FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'support'::app_role))
  WITH CHECK (has_role(auth.uid(), 'support'::app_role));
