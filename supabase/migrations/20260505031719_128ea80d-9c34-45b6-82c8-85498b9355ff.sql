-- ===== Etapa A: role_scopes (none/menu_only/full) =====

-- 1. Coluna nova
ALTER TABLE public.feature_permissions
  ADD COLUMN IF NOT EXISTS role_scopes JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. Backfill: tudo que está em allowed_roles vira "full"
UPDATE public.feature_permissions
SET role_scopes = (
  SELECT COALESCE(jsonb_object_agg(r, 'full'), '{}'::jsonb)
  FROM unnest(allowed_roles) AS r
)
WHERE role_scopes = '{}'::jsonb
  AND array_length(allowed_roles, 1) IS NOT NULL;

-- 3. Função: get_feature_scope
CREATE OR REPLACE FUNCTION public.get_feature_scope(_user_id uuid, _feature_key text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_is_master boolean;
  v_toggle_enabled boolean;
  v_perm RECORD;
  v_scope text;
BEGIN
  IF _user_id IS NULL THEN
    RETURN 'none';
  END IF;

  -- Master bypass
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'master')
    INTO v_is_master;
  IF v_is_master THEN RETURN 'full'; END IF;

  -- Toggle global desligado bloqueia (exceto master)
  SELECT is_enabled INTO v_toggle_enabled
  FROM public.master_feature_toggles
  WHERE feature_key = _feature_key;
  IF v_toggle_enabled IS NOT NULL AND v_toggle_enabled = false THEN
    RETURN 'none';
  END IF;

  -- Role principal do usuário
  SELECT role::text INTO v_role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY CASE role::text
    WHEN 'master' THEN 1 WHEN 'admin' THEN 2
    WHEN 'manager' THEN 3 WHEN 'support' THEN 4 ELSE 5 END
  LIMIT 1;

  IF v_role IS NULL THEN RETURN 'none'; END IF;
  IF v_role = 'admin' THEN RETURN 'full'; END IF;
  IF v_role = 'manager' THEN
    RETURN CASE WHEN _feature_key = 'permissions' THEN 'none' ELSE 'full' END;
  END IF;

  -- Support / Seller: consultar feature_permissions
  SELECT * INTO v_perm
  FROM public.feature_permissions
  WHERE feature_key = _feature_key;

  IF NOT FOUND THEN
    -- Sem registro = default-open (comportamento atual)
    RETURN 'full';
  END IF;

  -- User_id explícito sempre full
  IF v_perm.allowed_user_ids IS NOT NULL
     AND _user_id = ANY(v_perm.allowed_user_ids) THEN
    RETURN 'full';
  END IF;

  -- role_scopes
  v_scope := v_perm.role_scopes ->> v_role;
  IF v_scope IN ('none','menu_only','full') THEN
    RETURN v_scope;
  END IF;

  -- Fallback: allowed_roles legado
  IF v_perm.allowed_roles IS NOT NULL AND v_role = ANY(v_perm.allowed_roles) THEN
    RETURN 'full';
  END IF;

  -- Sem nenhuma regra para o role nem usuário, e nada no array = aberto (default-open)
  IF (v_perm.allowed_roles IS NULL OR array_length(v_perm.allowed_roles,1) IS NULL)
     AND (v_perm.allowed_user_ids IS NULL OR array_length(v_perm.allowed_user_ids,1) IS NULL)
     AND v_perm.role_scopes = '{}'::jsonb THEN
    RETURN 'full';
  END IF;

  RETURN 'none';
END;
$$;

-- 4. has_feature_access continua existindo, agora delega
CREATE OR REPLACE FUNCTION public.has_feature_access(_user_id uuid, _feature_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_feature_scope(_user_id, _feature_key) IN ('menu_only','full');
$$;

-- 5. Helper booleano para RLS de listas: "vê dados de todos?"
CREATE OR REPLACE FUNCTION public.has_full_feature_access(_user_id uuid, _feature_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_feature_scope(_user_id, _feature_key) = 'full';
$$;
