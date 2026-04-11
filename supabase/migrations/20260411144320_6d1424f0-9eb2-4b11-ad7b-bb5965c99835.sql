
-- Create contract_templates table
CREATE TABLE public.contract_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

-- Authenticated can read active templates
CREATE POLICY "Authenticated can read contract templates"
ON public.contract_templates
FOR SELECT
TO authenticated
USING (true);

-- Privileged can manage all templates
CREATE POLICY "Privileged can manage contract templates"
ON public.contract_templates
FOR ALL
TO authenticated
USING (is_privileged(auth.uid()))
WITH CHECK (is_privileged(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_contract_templates_updated_at
BEFORE UPDATE ON public.contract_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
