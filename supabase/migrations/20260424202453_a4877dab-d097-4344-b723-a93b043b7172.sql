-- Atualiza trigger para disparar quando contrato é assinado (em vez de pipeline_status='ativo')
CREATE OR REPLACE FUNCTION public.notify_partner_approved()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _request_id bigint;
BEGIN
  -- Dispara quando contrato_status muda para 'assinado' (ou pipeline_status='contrato_assinado')
  -- e ainda não foi provisionado
  IF (
       (NEW.contrato_status = 'assinado' AND COALESCE(OLD.contrato_status, '') <> 'assinado')
       OR
       (NEW.pipeline_status = 'contrato_assinado' AND COALESCE(OLD.pipeline_status, '') <> 'contrato_assinado')
     )
     AND NEW.auto_user_id IS NULL
     AND NEW.email IS NOT NULL AND NEW.email <> '' THEN

    SELECT net.http_post(
      url := 'https://sibfqmzsnftscnlyuwiu.supabase.co/functions/v1/partner-auto-provision',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpYmZxbXpzbmZ0c2NubHl1d2l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTg0NTAsImV4cCI6MjA4NzE3NDQ1MH0.kzRxoVKtKopnL_OD3TQMlXfCfbJCd6jYhx-IyU7Q67U"}'::jsonb,
      body := jsonb_build_object('partner_id', NEW.id::text)
    ) INTO _request_id;

    BEGIN
      INSERT INTO public.audit_logs (user_id, action, target_table, target_id, details)
      VALUES (auth.uid(), 'partner_auto_provision_triggered', 'partners', NEW.id::text,
              jsonb_build_object('email', NEW.email, 'request_id', _request_id, 'trigger', 'contrato_assinado'));
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$function$;