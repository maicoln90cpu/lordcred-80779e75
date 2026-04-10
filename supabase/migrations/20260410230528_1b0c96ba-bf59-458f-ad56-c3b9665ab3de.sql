INSERT INTO feature_permissions (feature_key, feature_label, feature_group, allowed_roles, allowed_user_ids)
VALUES 
  ('bank_credentials', 'Credenciais Bancos', 'Financeiro', '{}', '{}'),
  ('partners', 'Parceiros', 'Financeiro', '{}', '{}'),
  ('contract_template', 'Template Contrato', 'Financeiro', '{}', '{}')
ON CONFLICT (feature_key) DO NOTHING;