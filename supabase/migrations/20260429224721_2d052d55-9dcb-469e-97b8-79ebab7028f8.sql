-- Função de leitura de métricas para o cartão "Saúde do banco" (Etapa 2 V8).
-- SECURITY DEFINER porque pg_total_relation_size/pg_database_size dependem
-- de catálogos do sistema. is_privileged() já garante a checagem de role
-- sem cair em recursão de RLS.

CREATE OR REPLACE FUNCTION public.get_v8_database_health()
RETURNS TABLE (
  total_simulations bigint,
  total_webhooks_v8 bigint,
  webhooks_v8_older_than_3d bigint,
  v8_webhook_table_size text,
  v8_simulations_table_size text,
  database_total_size text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_privileged() THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.v8_simulations)::bigint,
    (SELECT COUNT(*) FROM public.v8_webhook_logs)::bigint,
    (SELECT COUNT(*) FROM public.v8_webhook_logs
       WHERE received_at < now() - interval '3 days')::bigint,
    pg_size_pretty(pg_total_relation_size('public.v8_webhook_logs'))::text,
    pg_size_pretty(pg_total_relation_size('public.v8_simulations'))::text,
    pg_size_pretty(pg_database_size(current_database()))::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_v8_database_health() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_webhook_logs() TO authenticated;