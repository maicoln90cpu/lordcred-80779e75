
-- Reagrupar feature_permissions conforme sidebar
UPDATE public.feature_permissions SET feature_group = 'Financeiro'
  WHERE feature_key IN ('v8_simulador','bank_credentials','contract_template','commissions','commissions_v2','commission_reports','partners');

UPDATE public.feature_permissions SET feature_group = 'Operações'
  WHERE feature_key IN ('webhooks','broadcasts','queue','chip_monitor','quick_replies','templates');

UPDATE public.feature_permissions SET feature_group = 'Ferramentas'
  WHERE feature_key IN ('audit_logs','permissions','remote_assistance','links');

UPDATE public.feature_permissions SET feature_group = 'Equipe'
  WHERE feature_key IN ('users','product_info','kanban','leads','performance');

UPDATE public.feature_permissions SET feature_group = 'Administração'
  WHERE feature_key IN ('integrations');

UPDATE public.feature_permissions SET feature_group = 'Sistema'
  WHERE feature_key = 'master_admin';

-- Mesmo reagrupamento para master_feature_toggles
UPDATE public.master_feature_toggles SET feature_group = 'Financeiro'
  WHERE feature_key IN ('v8_simulador','bank_credentials','contract_template','commissions','commissions_v2','commission_reports','partners');

UPDATE public.master_feature_toggles SET feature_group = 'Operações'
  WHERE feature_key IN ('webhooks','broadcasts','queue','chip_monitor','quick_replies','templates');

UPDATE public.master_feature_toggles SET feature_group = 'Ferramentas'
  WHERE feature_key IN ('audit_logs','permissions','remote_assistance','links');

UPDATE public.master_feature_toggles SET feature_group = 'Equipe'
  WHERE feature_key IN ('users','product_info','kanban','leads','performance');

UPDATE public.master_feature_toggles SET feature_group = 'Administração'
  WHERE feature_key IN ('integrations');

UPDATE public.master_feature_toggles SET feature_group = 'Sistema'
  WHERE feature_key = 'master_admin';

-- Padronizar rótulos divergentes entre as duas tabelas
UPDATE public.master_feature_toggles SET feature_label = 'Credenciais Bancos' WHERE feature_key = 'bank_credentials';
UPDATE public.master_feature_toggles SET feature_label = 'Dash. Aquecimento' WHERE feature_key = 'dashboard';
UPDATE public.master_feature_toggles SET feature_label = 'Relat. Aquecimento' WHERE feature_key = 'warming_reports';
UPDATE public.master_feature_toggles SET feature_label = 'Assets/Tabelas' WHERE feature_key = 'corban_assets';
UPDATE public.master_feature_toggles SET feature_label = 'Dashboard Corban' WHERE feature_key = 'corban_dashboard';
UPDATE public.master_feature_toggles SET feature_label = 'FGTS' WHERE feature_key = 'corban_fgts';
UPDATE public.master_feature_toggles SET feature_label = 'Propostas' WHERE feature_key = 'corban_propostas';
UPDATE public.master_feature_toggles SET feature_label = 'WhatsApp CRM' WHERE feature_key = 'whatsapp';
UPDATE public.master_feature_toggles SET feature_label = 'Relat. Comissões' WHERE feature_key = 'commission_reports';
