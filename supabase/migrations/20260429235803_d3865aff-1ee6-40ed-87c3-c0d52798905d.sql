
-- Etapa 4C: Aba Calendário no RH (eventos manuais; integração Google futura)
CREATE TABLE IF NOT EXISTS public.hr_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'other', -- interview_e1 | interview_e2 | meeting | reminder | other
  candidate_id UUID REFERENCES public.hr_candidates(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  location TEXT,
  color TEXT, -- hsl token override opcional
  created_by UUID,
  google_event_id TEXT, -- reservado p/ futura integração
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_calendar_events_starts_at ON public.hr_calendar_events(starts_at);
CREATE INDEX IF NOT EXISTS idx_hr_calendar_events_candidate ON public.hr_calendar_events(candidate_id);

ALTER TABLE public.hr_calendar_events ENABLE ROW LEVEL SECURITY;

-- Acesso: privilegiados (master/admin/manager) + support podem tudo. Sellers só leem.
CREATE POLICY "Privileged manage hr_calendar_events"
  ON public.hr_calendar_events
  FOR ALL
  USING (public.is_privileged() OR public.has_role(auth.uid(), 'support'))
  WITH CHECK (public.is_privileged() OR public.has_role(auth.uid(), 'support'));

CREATE POLICY "Authenticated can view hr_calendar_events"
  ON public.hr_calendar_events
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE TRIGGER trg_hr_calendar_events_updated_at
  BEFORE UPDATE ON public.hr_calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
