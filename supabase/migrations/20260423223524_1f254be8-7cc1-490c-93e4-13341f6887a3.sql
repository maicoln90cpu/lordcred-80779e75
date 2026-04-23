-- 1) Catálogo de permissões
INSERT INTO public.feature_permissions (feature_key, feature_label, feature_group, allowed_user_ids, allowed_roles)
VALUES
  ('broadcasts', 'Disparos em Massa', 'CRM', ARRAY[]::uuid[], ARRAY['master','admin','manager']::text[]),
  ('commissions_v2', 'Comissões Parceiros V2', 'Comissões', ARRAY[]::uuid[], ARRAY['master','admin','manager']::text[]),
  ('v8_simulador', 'Simulador V8 CLT', 'Corban', ARRAY[]::uuid[], ARRAY['master','admin','manager','support','seller']::text[]),
  ('integrations', 'Integrações WhatsApp', 'Administração', ARRAY[]::uuid[], ARRAY['master','admin']::text[])
ON CONFLICT (feature_key) DO NOTHING;

-- 2) Painel master (toggles)
INSERT INTO public.master_feature_toggles (feature_key, feature_label, feature_group, is_enabled)
VALUES
  ('broadcasts', 'Disparos em Massa', 'CRM', true),
  ('commissions_v2', 'Comissões Parceiros V2', 'Comissões', true),
  ('v8_simulador', 'Simulador V8 CLT', 'Corban', true),
  ('integrations', 'Integrações WhatsApp', 'Administração', true)
ON CONFLICT (feature_key) DO NOTHING;

-- 3) Padronizar grupos em master_feature_toggles
UPDATE public.master_feature_toggles SET feature_group = 'Equipe'
WHERE feature_group IN ('equipe','EQUIPE','team','Team');
UPDATE public.master_feature_toggles SET feature_group = 'CRM'
WHERE feature_key = 'whatsapp' AND feature_group <> 'CRM';
UPDATE public.master_feature_toggles SET feature_group = 'Corban'
WHERE (feature_key LIKE 'corban_%' OR feature_key LIKE 'seller_%') AND feature_group <> 'Corban';
UPDATE public.master_feature_toggles SET feature_group = 'Administração'
WHERE feature_key IN ('users','permissions','audit_logs','master_admin','bank_credentials','webhooks')
  AND feature_group <> 'Administração';

-- 4) Padronizar grupos em feature_permissions
UPDATE public.feature_permissions SET feature_group = 'Equipe'
WHERE feature_group IN ('equipe','EQUIPE','team','Team');
UPDATE public.feature_permissions SET feature_group = 'CRM'
WHERE feature_key = 'whatsapp' AND feature_group <> 'CRM';
UPDATE public.feature_permissions SET feature_group = 'Corban'
WHERE (feature_key LIKE 'corban_%' OR feature_key LIKE 'seller_%') AND feature_group <> 'Corban';
UPDATE public.feature_permissions SET feature_group = 'Administração'
WHERE feature_key IN ('users','permissions','audit_logs','master_admin','bank_credentials','webhooks')
  AND feature_group <> 'Administração';