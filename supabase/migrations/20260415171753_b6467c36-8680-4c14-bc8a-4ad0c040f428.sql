
-- Tabela de controle global de módulos pelo Master
CREATE TABLE public.master_feature_toggles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key TEXT NOT NULL UNIQUE,
  feature_label TEXT NOT NULL,
  feature_group TEXT NOT NULL DEFAULT 'Geral',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.master_feature_toggles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read toggles"
  ON public.master_feature_toggles FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Only master can manage toggles"
  ON public.master_feature_toggles FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'master'))
  WITH CHECK (has_role(auth.uid(), 'master'));

-- Seed com todos os módulos
INSERT INTO public.master_feature_toggles (feature_key, feature_label, feature_group, is_enabled) VALUES
  ('dashboard', 'Dashboard Aquecimento', 'Aquecimento', true),
  ('chips', 'Meus Chips', 'Aquecimento', true),
  ('settings_warming', 'Config. Aquecimento', 'Aquecimento', true),
  ('warming_reports', 'Relatórios Aquecimento', 'Aquecimento', true),
  ('whatsapp', 'WhatsApp CRM', 'CRM', true),
  ('internal_chat', 'Chat Interno', 'Comunicação', true),
  ('tickets', 'Tickets', 'Comunicação', true),
  ('corban_dashboard', 'Dashboard Corban', 'Corban', true),
  ('corban_propostas', 'Propostas Corban', 'Corban', true),
  ('corban_fgts', 'FGTS Corban', 'Corban', true),
  ('corban_assets', 'Assets Corban', 'Corban', true),
  ('corban_config', 'Config Corban', 'Corban', true),
  ('seller_propostas', 'Minhas Propostas', 'Corban Vendedor', true),
  ('seller_fgts', 'Consulta FGTS', 'Corban Vendedor', true),
  ('users', 'Usuários', 'Equipe', true),
  ('leads', 'Leads', 'Equipe', true),
  ('kanban', 'Kanban', 'Equipe', true),
  ('performance', 'Performance', 'Equipe', true),
  ('product_info', 'Info Produtos', 'Equipe', true),
  ('commissions', 'Comissões Parceiros', 'Financeiro', true),
  ('commission_reports', 'Relatório Comissões', 'Financeiro', true),
  ('bank_credentials', 'Bancos', 'Financeiro', true),
  ('partners', 'Parceiros', 'Financeiro', true),
  ('contract_template', 'Template Contrato', 'Financeiro', true),
  ('broadcasts', 'Disparos em Massa', 'Operações', true),
  ('queue', 'Fila de Mensagens', 'Operações', true),
  ('chip_monitor', 'Monitor de Chips', 'Operações', true),
  ('templates', 'Templates', 'Operações', true),
  ('quick_replies', 'Notas Rápidas', 'Operações', true),
  ('webhooks', 'Webhooks', 'Operações', true),
  ('links', 'Links Úteis', 'Ferramentas', true),
  ('audit_logs', 'Logs de Auditoria', 'Ferramentas', true),
  ('remote_assistance', 'Assistência Remota', 'Ferramentas', true),
  ('permissions', 'Permissões', 'Ferramentas', true);
