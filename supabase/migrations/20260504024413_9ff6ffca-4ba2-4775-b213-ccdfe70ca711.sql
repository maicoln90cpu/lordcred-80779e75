CREATE OR REPLACE FUNCTION public.recalculate_commissions_v2()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _count integer := 0;
BEGIN
  IF NOT public.is_privileged() THEN
    RAISE EXCEPTION 'Acesso negado: apenas privilegiados podem recalcular';
  END IF;

  UPDATE public.commission_sales_v2
  SET updated_at = now()
  WHERE id IS NOT NULL;
  GET DIAGNOSTICS _count = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'recalculated', _count);
END;
$function$;