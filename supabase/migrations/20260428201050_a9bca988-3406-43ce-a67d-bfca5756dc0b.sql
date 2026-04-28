-- Índice por tipo (CONCURRENTLY não é permitido em migration; usamos índice normal).
CREATE INDEX IF NOT EXISTS idx_v8_webhook_logs_event_type
  ON public.v8_webhook_logs (event_type);

-- Função agregada: devolve contagem por tipo em uma única query.
CREATE OR REPLACE FUNCTION public.v8_webhook_type_counts()
RETURNS TABLE (event_type text, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(event_type, 'invalid')::text AS event_type,
         COUNT(*)::bigint AS total
  FROM public.v8_webhook_logs
  GROUP BY COALESCE(event_type, 'invalid');
$$;

-- Permite chamar via PostgREST autenticado (a tabela já tem RLS para privileged).
REVOKE ALL ON FUNCTION public.v8_webhook_type_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v8_webhook_type_counts() TO authenticated;
