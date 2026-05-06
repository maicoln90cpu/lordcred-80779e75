CREATE OR REPLACE FUNCTION public.v8_simulations_after_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM v8_recalc_batch_counters(NEW.batch_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM v8_recalc_batch_counters(OLD.batch_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND COALESCE(OLD.status,'') IS DISTINCT FROM COALESCE(NEW.status,'') THEN
    -- Caminho rápido: pending -> success/failed usa incremento atômico (sub-ms).
    IF COALESCE(OLD.status,'') = 'pending' AND NEW.status = 'success' THEN
      PERFORM v8_increment_batch_success(NEW.batch_id);
    ELSIF COALESCE(OLD.status,'') = 'pending' AND NEW.status = 'failed' THEN
      PERFORM v8_increment_batch_failure(NEW.batch_id);
    ELSE
      -- Casos raros (success->failed, failed->success, etc): recount completo.
      PERFORM v8_recalc_batch_counters(NEW.batch_id);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$function$;