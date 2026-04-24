-- Etapa 4: Auto-provisionamento de usuário ao aprovar parceiro + fuzzy match para comissões
-- pg_trgm já existe no schema public neste projeto (similarity, gtrgm_*, gin_trgm_*), então usamos referências sem schema

ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS auto_user_id uuid;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS commission_name_match_threshold numeric NOT NULL DEFAULT 0.55;

-- Índice trigram em profiles.name (operator class no schema public, onde está o pg_trgm)
CREATE INDEX IF NOT EXISTS idx_profiles_name_trgm
  ON public.profiles USING gin (lower(name) gin_trgm_ops);

-- RPC para fuzzy match de vendedor por nome
CREATE OR REPLACE FUNCTION public.match_seller_by_name(
  _name text,
  _threshold numeric DEFAULT 0.55
)
RETURNS TABLE(user_id uuid, name text, score numeric, ambiguous boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _q text;
  _best_user uuid;
  _best_name text;
  _best_score numeric;
  _runner_score numeric;
  _ambiguous boolean := false;
BEGIN
  _q := lower(coalesce(_name, ''));
  IF _q = '' THEN RETURN; END IF;

  -- Match exato (preserva comportamento anterior)
  SELECT p.user_id, p.name, 1.0::numeric
    INTO _best_user, _best_name, _best_score
  FROM profiles p
  WHERE lower(p.name) = _q OR lower(p.email) = _q
  LIMIT 1;

  IF _best_user IS NOT NULL THEN
    user_id := _best_user; name := _best_name; score := _best_score; ambiguous := false;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Fuzzy via similarity()
  SELECT p.user_id, p.name, similarity(lower(p.name), _q)
    INTO _best_user, _best_name, _best_score
  FROM profiles p
  WHERE p.name IS NOT NULL AND p.name <> ''
  ORDER BY similarity(lower(p.name), _q) DESC
  LIMIT 1;

  IF _best_user IS NULL OR _best_score < _threshold THEN
    RETURN;
  END IF;

  SELECT similarity(lower(p.name), _q)
    INTO _runner_score
  FROM profiles p
  WHERE p.name IS NOT NULL AND p.user_id <> _best_user
  ORDER BY similarity(lower(p.name), _q) DESC
  LIMIT 1;

  IF _runner_score IS NOT NULL AND _runner_score >= 0.7 AND _runner_score >= _best_score - 0.05 THEN
    _ambiguous := true;
  END IF;

  user_id := _best_user; name := _best_name; score := _best_score; ambiguous := _ambiguous;
  RETURN NEXT;
END;
$$;

-- Trigger function: dispara edge function quando parceiro vira 'ativo'
CREATE OR REPLACE FUNCTION public.notify_partner_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _request_id bigint;
BEGIN
  IF NEW.pipeline_status = 'ativo'
     AND COALESCE(OLD.pipeline_status, '') <> 'ativo'
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
              jsonb_build_object('email', NEW.email, 'request_id', _request_id));
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_partner_approved ON public.partners;
CREATE TRIGGER trg_notify_partner_approved
  AFTER UPDATE OF pipeline_status ON public.partners
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_partner_approved();