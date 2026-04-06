-- Backfill: fix commission_sales dates that were stored without -03:00 offset
-- Records at 21:00-23:59 UTC were actually 00:00-02:59 next day in São Paulo
UPDATE public.commission_sales
SET sale_date = sale_date + interval '3 hours',
    updated_at = now()
WHERE EXTRACT(HOUR FROM sale_date AT TIME ZONE 'UTC') >= 21
  AND sale_date < '2026-04-07'::timestamptz;