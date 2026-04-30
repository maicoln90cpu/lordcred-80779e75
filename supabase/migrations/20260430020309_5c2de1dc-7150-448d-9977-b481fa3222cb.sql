
-- 1) Retenção 1 dia em audit_logs
CREATE OR REPLACE FUNCTION public.cleanup_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.audit_logs
  WHERE created_at < now() - interval '1 day';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'cleanup_audit_logs: removed % rows (retention=1d)', deleted_count;
END;
$function$;

-- 2) Retenção 1 dia em webhook_logs / v8_webhook_logs
CREATE OR REPLACE FUNCTION public.cleanup_webhook_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  deleted_uazapi integer := 0;
  deleted_v8 integer := 0;
BEGIN
  DELETE FROM public.webhook_logs
  WHERE created_at < now() - interval '1 day';
  GET DIAGNOSTICS deleted_uazapi = ROW_COUNT;

  DELETE FROM public.v8_webhook_logs
  WHERE received_at < now() - interval '1 day';
  GET DIAGNOSTICS deleted_v8 = ROW_COUNT;

  RAISE LOG 'cleanup_webhook_logs: webhook_logs=% v8_webhook_logs=%',
    deleted_uazapi, deleted_v8;
END;
$function$;

-- 3) Função "guarda-chuva" também em 1 dia (mantida por compatibilidade)
CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  audit_deleted   integer := 0;
  v8_deleted      integer := 0;
  webhook_deleted integer := 0;
BEGIN
  DELETE FROM public.audit_logs
  WHERE created_at < now() - interval '1 day';
  GET DIAGNOSTICS audit_deleted = ROW_COUNT;

  DELETE FROM public.v8_webhook_logs
  WHERE received_at < now() - interval '1 day';
  GET DIAGNOSTICS v8_deleted = ROW_COUNT;

  DELETE FROM public.webhook_logs
  WHERE created_at < now() - interval '1 day';
  GET DIAGNOSTICS webhook_deleted = ROW_COUNT;

  RAISE LOG 'cleanup_old_logs: audit=% v8=% webhook=%',
    audit_deleted, v8_deleted, webhook_deleted;

  RETURN jsonb_build_object(
    'audit_logs_deleted', audit_deleted,
    'v8_webhook_logs_deleted', v8_deleted,
    'webhook_logs_deleted', webhook_deleted,
    'ran_at', now()
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.cleanup_audit_logs() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_webhook_logs() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_logs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_audit_logs() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_webhook_logs() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_logs() TO authenticated, service_role;

-- 4) Trigger anti-UPDATE em audit_logs (logs imutáveis)
CREATE OR REPLACE FUNCTION public.audit_logs_block_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Permite somente ao master burlar (situação extrema). Demais sempre bloqueado.
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'master'
  ) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'audit_logs is append-only: UPDATE not allowed';
END;
$function$;

DROP TRIGGER IF EXISTS trg_audit_logs_block_update ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_block_update
BEFORE UPDATE ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.audit_logs_block_update();
