ALTER TABLE public.v8_simulations
  ADD COLUMN IF NOT EXISTS total_paid numeric,
  ADD COLUMN IF NOT EXISTS total_interest numeric,
  ADD COLUMN IF NOT EXISTS markup_pct numeric,
  ADD COLUMN IF NOT EXISTS cet_monthly_pct numeric,
  ADD COLUMN IF NOT EXISTS cet_annual_pct numeric;

CREATE OR REPLACE FUNCTION public.v8_compute_financial_breakdown(
  _released numeric,
  _installment numeric,
  _installments integer
) RETURNS TABLE (
  total_paid numeric,
  total_interest numeric,
  markup_pct numeric,
  cet_monthly_pct numeric,
  cet_annual_pct numeric
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_total numeric;
  v_int numeric;
  v_lo numeric := 1e-7;
  v_hi numeric := 0.5;
  v_mid numeric;
  v_pv numeric;
  v_rate numeric;
  i integer;
BEGIN
  IF _released IS NULL OR _installment IS NULL OR _installments IS NULL
     OR _released <= 0 OR _installment <= 0 OR _installments <= 0 THEN
    RETURN;
  END IF;

  v_total := _installment * _installments;
  v_int := v_total - _released;

  IF v_total <= _released THEN
    total_paid := v_total;
    total_interest := GREATEST(v_int, 0);
    markup_pct := CASE WHEN _released > 0 THEN (total_interest / _released) * 100 ELSE 0 END;
    cet_monthly_pct := 0;
    cet_annual_pct := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  FOR i IN 1..80 LOOP
    v_mid := (v_lo + v_hi) / 2;
    v_pv := (_installment * (1 - power(1 + v_mid, -_installments))) / v_mid;
    IF v_pv > _released THEN v_lo := v_mid; ELSE v_hi := v_mid; END IF;
  END LOOP;
  v_rate := (v_lo + v_hi) / 2;

  total_paid := v_total;
  total_interest := v_int;
  markup_pct := (v_int / _released) * 100;
  cet_monthly_pct := v_rate * 100;
  cet_annual_pct := (power(1 + v_rate, 12) - 1) * 100;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.v8_simulations_compute_cet_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF NEW.released_value IS NOT NULL
     AND NEW.installment_value IS NOT NULL
     AND NEW.installments IS NOT NULL
     AND NEW.released_value > 0
     AND NEW.installment_value > 0
     AND NEW.installments > 0 THEN
    SELECT * INTO r FROM public.v8_compute_financial_breakdown(
      NEW.released_value::numeric,
      NEW.installment_value::numeric,
      NEW.installments::integer
    );
    IF FOUND THEN
      NEW.total_paid := r.total_paid;
      NEW.total_interest := r.total_interest;
      NEW.markup_pct := r.markup_pct;
      NEW.cet_monthly_pct := r.cet_monthly_pct;
      NEW.cet_annual_pct := r.cet_annual_pct;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_v8_simulations_compute_cet ON public.v8_simulations;
CREATE TRIGGER trg_v8_simulations_compute_cet
BEFORE INSERT OR UPDATE OF released_value, installment_value, installments
ON public.v8_simulations
FOR EACH ROW
EXECUTE FUNCTION public.v8_simulations_compute_cet_trigger();

UPDATE public.v8_simulations
SET released_value = released_value
WHERE released_value IS NOT NULL
  AND installment_value IS NOT NULL
  AND installments IS NOT NULL
  AND released_value > 0
  AND installment_value > 0
  AND installments > 0
  AND cet_monthly_pct IS NULL;