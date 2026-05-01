INSERT INTO public.feature_permissions (feature_key, feature_label, feature_group, allowed_roles, allowed_user_ids)
VALUES ('hr', 'RH/Recrutamento', 'Equipe', '{}', '{}')
ON CONFLICT (feature_key) DO NOTHING;

INSERT INTO public.master_feature_toggles (feature_key, feature_label, feature_group, is_enabled)
VALUES ('hr', 'RH/Recrutamento', 'Equipe', true)
ON CONFLICT (feature_key) DO NOTHING;