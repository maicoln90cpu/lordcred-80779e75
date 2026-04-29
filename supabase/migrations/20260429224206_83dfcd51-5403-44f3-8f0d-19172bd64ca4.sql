-- Etapa 1 (item D do plano V8): a função cleanup_webhook_logs() só limpava
-- public.webhook_logs (UazAPI/WhatsApp) e ignorava public.v8_webhook_logs.
-- Resultado: 134k linhas / 387 MB acumulados em 7 dias na tabela V8 sem nunca
-- serem apagados. Esta migration:
--   1. Estende a função para limpar AMBAS as tabelas (>3 dias).
--   2. Roda uma limpeza única imediata para liberar espaço agora.
--   3. Não mexe no agendamento do pg_cron (já roda 04:00 UTC diariamente).

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
  WHERE created_at < now() - interval '3 days';
  GET DIAGNOSTICS deleted_uazapi = ROW_COUNT;

  DELETE FROM public.v8_webhook_logs
  WHERE received_at < now() - interval '3 days';
  GET DIAGNOSTICS deleted_v8 = ROW_COUNT;

  RAISE LOG 'cleanup_webhook_logs: webhook_logs=% v8_webhook_logs=%',
    deleted_uazapi, deleted_v8;
END;
$function$;

-- Limpeza única imediata (libera ~250 MB agora, sem esperar o próximo cron).
SELECT public.cleanup_webhook_logs();