
-- 1) Reduzir retenção de 15 → 5 dias (operação não consulta logs antigos; V8 gera ~7k/dia)
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
  WHERE created_at < now() - interval '5 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'cleanup_audit_logs: removed % rows (retention=5d)', deleted_count;
END;
$function$;

-- 2) Housekeeping imediato (apaga ~80k linhas antigas agora)
DELETE FROM public.audit_logs WHERE created_at < now() - interval '5 days';

-- 3) Índices para acelerar filtros do painel
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_desc
  ON public.audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_category
  ON public.audit_logs ((details->>'category'), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON public.audit_logs (action, created_at DESC);

-- 4) Função de contagem APROXIMADA (usa pg_class.reltuples — instantânea)
-- Evita o COUNT(*) exato que estoura statement_timeout em tabelas grandes.
CREATE OR REPLACE FUNCTION public.audit_logs_estimated_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(reltuples::bigint, 0)
  FROM pg_class
  WHERE oid = 'public.audit_logs'::regclass;
$function$;

GRANT EXECUTE ON FUNCTION public.audit_logs_estimated_count() TO authenticated;
