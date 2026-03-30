
-- Remove master_admin from feature_permissions (item 4)
DELETE FROM feature_permissions WHERE feature_key = 'master_admin';

-- Aquecimento: support + manager only
UPDATE feature_permissions SET allowed_roles = ARRAY['support', 'manager'] WHERE feature_key IN ('dashboard', 'chips', 'settings_warming', 'warming_reports');

-- Equipe: users, leads, kanban, product_info → support + manager
UPDATE feature_permissions SET allowed_roles = ARRAY['support', 'manager'] WHERE feature_key IN ('users', 'leads', 'kanban', 'product_info');

-- Performance → manager only
UPDATE feature_permissions SET allowed_roles = ARRAY['manager'] WHERE feature_key = 'performance';

-- Comissões → seller + support + manager
UPDATE feature_permissions SET allowed_roles = ARRAY['seller', 'support', 'manager'] WHERE feature_key = 'commissions';

-- Operações: chip_monitor, queue, webhooks → support + manager
UPDATE feature_permissions SET allowed_roles = ARRAY['support', 'manager'] WHERE feature_key IN ('chip_monitor', 'queue', 'webhooks');

-- Templates, Notas Rápidas → seller + support + manager
UPDATE feature_permissions SET allowed_roles = ARRAY['seller', 'support', 'manager'] WHERE feature_key IN ('templates', 'quick_replies');

-- Comunicação: tickets, internal_chat → seller + support + manager
UPDATE feature_permissions SET allowed_roles = ARRAY['seller', 'support', 'manager'] WHERE feature_key IN ('tickets', 'internal_chat');

-- Ferramentas: links, remote_assistance, audit_logs → support + manager
UPDATE feature_permissions SET allowed_roles = ARRAY['support', 'manager'] WHERE feature_key IN ('links', 'remote_assistance', 'audit_logs');

-- Permissões → ninguém (apenas master/admin via bypass)
UPDATE feature_permissions SET allowed_roles = ARRAY[]::text[] WHERE feature_key = 'permissions';

-- Corban admin → support + manager
UPDATE feature_permissions SET allowed_roles = ARRAY['support', 'manager'] WHERE feature_key IN ('corban_dashboard', 'corban_propostas', 'corban_fgts', 'corban_assets', 'corban_config');

-- Seller Corban → seller + manager
UPDATE feature_permissions SET allowed_roles = ARRAY['seller', 'manager'] WHERE feature_key IN ('seller_propostas', 'seller_fgts');

-- WhatsApp → seller + support + manager
UPDATE feature_permissions SET allowed_roles = ARRAY['seller', 'support', 'manager'] WHERE feature_key = 'whatsapp';
