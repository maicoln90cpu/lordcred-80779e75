-- Tabela de regras de progressão automática de aquecimento
CREATE TABLE public.warming_phase_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phase_from TEXT NOT NULL,
  phase_to TEXT NOT NULL,
  min_days INTEGER NOT NULL DEFAULT 3,
  min_avg_messages INTEGER NOT NULL DEFAULT 5,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(phase_from)
);

ALTER TABLE public.warming_phase_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Privileged users can view warming rules"
ON public.warming_phase_rules FOR SELECT
TO authenticated
USING (public.is_privileged(auth.uid()));

CREATE POLICY "Privileged users can manage warming rules"
ON public.warming_phase_rules FOR ALL
TO authenticated
USING (public.is_privileged(auth.uid()))
WITH CHECK (public.is_privileged(auth.uid()));

-- Regras padrão
INSERT INTO public.warming_phase_rules (phase_from, phase_to, min_days, min_avg_messages, sort_order) VALUES
  ('novo', 'iniciante', 3, 5, 1),
  ('iniciante', 'crescimento', 4, 15, 2),
  ('crescimento', 'aquecido', 7, 30, 3),
  ('aquecido', 'maduro', 14, 50, 4);

-- Trigger para updated_at
CREATE TRIGGER update_warming_phase_rules_updated_at
BEFORE UPDATE ON public.warming_phase_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();