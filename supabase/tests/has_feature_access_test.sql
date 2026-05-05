-- ============================================================================
-- Regression tests for public.has_feature_access(uid, feature_key)
-- ============================================================================
-- Como rodar:
--   psql -f supabase/tests/has_feature_access_test.sql
--
-- O script:
--   1. Cria 5 usuários fixtures (master, admin, manager, support, seller).
--   2. Insere uma feature de teste em master_feature_toggles + feature_permissions.
--   3. Roda asserts variando: toggle on/off, role permission, user_id permission.
--   4. Reverte tudo (ROLLBACK) — não deixa lixo no banco.
--
-- Falha → o BLOCK levanta exception com a regra violada.
-- Sucesso → "ALL has_feature_access TESTS PASSED".
-- ============================================================================

BEGIN;

DO $$
DECLARE
  u_master  uuid := '00000000-0000-0000-0000-00000000m001';
  u_admin   uuid := '00000000-0000-0000-0000-00000000a001';
  u_manager uuid := '00000000-0000-0000-0000-00000000g001';
  u_support uuid := '00000000-0000-0000-0000-00000000s001';
  u_seller  uuid := '00000000-0000-0000-0000-00000000v001';
  test_key  text := '__test_feature_access__';
BEGIN
  -- Cleanup prévio (caso teste anterior tenha falhado sem rollback)
  DELETE FROM public.user_roles WHERE user_id IN (u_master, u_admin, u_manager, u_support, u_seller);
  DELETE FROM public.feature_permissions WHERE feature_key = test_key;
  DELETE FROM public.master_feature_toggles WHERE feature_key = test_key;

  -- Fixtures: roles
  INSERT INTO public.user_roles (user_id, role) VALUES
    (u_master,  'master'),
    (u_admin,   'admin'),
    (u_manager, 'manager'),
    (u_support, 'support'),
    (u_seller,  'seller');

  -- Fixtures: feature padrão (toggle ON, sem allowed_roles, sem allowed_user_ids)
  INSERT INTO public.master_feature_toggles (feature_key, feature_label, feature_group, is_enabled)
    VALUES (test_key, 'Test Feature', 'Tests', true);
  INSERT INTO public.feature_permissions (feature_key, feature_label, feature_group, allowed_roles, allowed_user_ids)
    VALUES (test_key, 'Test Feature', 'Tests', ARRAY[]::text[], ARRAY[]::uuid[]);

  -- ============= GROUP 1: Privileged sempre passam =============
  IF NOT public.has_feature_access(u_master, test_key) THEN
    RAISE EXCEPTION 'FAIL G1.1: master deveria ter acesso (toggle ON, sem roles)';
  END IF;
  IF NOT public.has_feature_access(u_admin, test_key) THEN
    RAISE EXCEPTION 'FAIL G1.2: admin deveria ter acesso (toggle ON, sem roles)';
  END IF;
  IF NOT public.has_feature_access(u_manager, test_key) THEN
    RAISE EXCEPTION 'FAIL G1.3: manager deveria ter acesso (toggle ON, sem roles)';
  END IF;

  -- ============= GROUP 2: Não-privileged bloqueados sem permissão =============
  IF public.has_feature_access(u_support, test_key) THEN
    RAISE EXCEPTION 'FAIL G2.1: support NÃO deveria ter acesso sem allowed_roles';
  END IF;
  IF public.has_feature_access(u_seller, test_key) THEN
    RAISE EXCEPTION 'FAIL G2.2: seller NÃO deveria ter acesso sem allowed_roles';
  END IF;

  -- ============= GROUP 3: Liberar Suporte via allowed_roles =============
  UPDATE public.feature_permissions
    SET allowed_roles = ARRAY['support']
    WHERE feature_key = test_key;

  IF NOT public.has_feature_access(u_support, test_key) THEN
    RAISE EXCEPTION 'FAIL G3.1: support deveria passar com allowed_roles=[support]';
  END IF;
  IF public.has_feature_access(u_seller, test_key) THEN
    RAISE EXCEPTION 'FAIL G3.2: seller NÃO deveria passar com allowed_roles=[support]';
  END IF;

  -- ============= GROUP 4: Liberar Vendedor específico via allowed_user_ids =============
  UPDATE public.feature_permissions
    SET allowed_roles = ARRAY[]::text[],
        allowed_user_ids = ARRAY[u_seller]
    WHERE feature_key = test_key;

  IF NOT public.has_feature_access(u_seller, test_key) THEN
    RAISE EXCEPTION 'FAIL G4.1: seller deveria passar com allowed_user_ids contendo seu uid';
  END IF;
  IF public.has_feature_access(u_support, test_key) THEN
    RAISE EXCEPTION 'FAIL G4.2: support NÃO deveria passar quando só seller está em allowed_user_ids';
  END IF;

  -- ============= GROUP 5: Master toggle OFF bloqueia não-privileged =============
  UPDATE public.master_feature_toggles SET is_enabled = false WHERE feature_key = test_key;
  UPDATE public.feature_permissions
    SET allowed_roles = ARRAY['support', 'seller']
    WHERE feature_key = test_key;

  IF NOT public.has_feature_access(u_admin, test_key) THEN
    RAISE EXCEPTION 'FAIL G5.1: admin deveria continuar passando mesmo com toggle OFF (privileged bypass)';
  END IF;
  IF NOT public.has_feature_access(u_master, test_key) THEN
    RAISE EXCEPTION 'FAIL G5.2: master deveria continuar passando mesmo com toggle OFF';
  END IF;
  IF public.has_feature_access(u_support, test_key) THEN
    RAISE EXCEPTION 'FAIL G5.3: support NÃO deveria passar com toggle OFF (mesmo com allowed_roles)';
  END IF;
  IF public.has_feature_access(u_seller, test_key) THEN
    RAISE EXCEPTION 'FAIL G5.4: seller NÃO deveria passar com toggle OFF';
  END IF;

  -- ============= GROUP 6: Feature inexistente =============
  IF public.has_feature_access(u_seller, '__feature_que_nao_existe__') THEN
    RAISE EXCEPTION 'FAIL G6.1: seller NÃO deveria passar em feature inexistente';
  END IF;
  IF NOT public.has_feature_access(u_admin, '__feature_que_nao_existe__') THEN
    RAISE EXCEPTION 'FAIL G6.2: admin SIM deveria passar em feature inexistente (privileged bypass)';
  END IF;

  -- ============= GROUP 7: Usuário sem role nenhuma =============
  IF public.has_feature_access('11111111-1111-1111-1111-111111111111'::uuid, test_key) THEN
    RAISE EXCEPTION 'FAIL G7.1: usuário sem role NÃO deveria passar';
  END IF;

  RAISE NOTICE '✅ ALL has_feature_access TESTS PASSED (7 grupos, 14 asserts)';
END $$;

-- Rollback tudo (fixtures + alterações de teste)
ROLLBACK;
