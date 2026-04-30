
-- ============================================================
-- ETAPA 2/6 — HARDENING de funções SECURITY DEFINER
-- 1) REVOKE EXECUTE de anon/public em todas SECURITY DEFINER
-- 2) GRANT EXECUTE para authenticated (mantém uso legítimo)
-- 3) Fixar search_path na trigger faltante
-- Reversível e idempotente.
-- ============================================================

DO $$
DECLARE
  r RECORD;
  ident text;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           p.proname AS fn_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.prosecdef = true
  LOOP
    ident := format('%I.%I(%s)', r.schema_name, r.fn_name, r.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', ident);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon',   ident);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO authenticated', ident);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION %s TO service_role', ident);
  END LOOP;
END$$;

-- 3) Fixar search_path na única trigger nossa que faltava
ALTER FUNCTION public.v8_auto_best_jobs_set_updated_at()
  SET search_path = public;
