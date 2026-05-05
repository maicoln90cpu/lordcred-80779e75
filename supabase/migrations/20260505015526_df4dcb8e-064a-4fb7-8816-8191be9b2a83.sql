-- Adiciona suporte a eventos "dia inteiro" no calendário do RH
ALTER TABLE public.hr_calendar_events
  ADD COLUMN IF NOT EXISTS all_day BOOLEAN NOT NULL DEFAULT false;

-- Backfill conservador: marca como all_day eventos com duração >= 24h
-- (ex.: "Início 15 dias depois" que hoje quebra a grade)
UPDATE public.hr_calendar_events
SET all_day = true
WHERE ends_at IS NOT NULL
  AND ends_at - starts_at >= INTERVAL '24 hours';

-- Index opcional para filtros futuros
CREATE INDEX IF NOT EXISTS idx_hr_calendar_events_all_day
  ON public.hr_calendar_events(all_day)
  WHERE all_day = true;