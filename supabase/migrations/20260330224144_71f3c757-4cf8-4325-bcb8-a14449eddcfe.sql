
-- Feature permissions table
CREATE TABLE public.feature_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text NOT NULL UNIQUE,
  feature_label text NOT NULL,
  feature_group text NOT NULL,
  allowed_user_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read feature permissions"
  ON public.feature_permissions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage feature permissions"
  ON public.feature_permissions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Seed all system features
INSERT INTO public.feature_permissions (feature_key, feature_label, feature_group) VALUES
  ('dashboard', 'Dash. Aquecimento', 'Aquecimento'),
  ('chips', 'Meus Chips', 'Aquecimento'),
  ('settings_warming', 'Config. Aquecimento', 'Aquecimento'),
  ('warming_reports', 'Relat. Aquecimento', 'Aquecimento'),
  ('users', 'Usuários', 'Equipe'),
  ('leads', 'Leads', 'Equipe'),
  ('performance', 'Performance', 'Equipe'),
  ('kanban', 'Kanban', 'Equipe'),
  ('product_info', 'Info Produtos', 'Equipe'),
  ('commissions', 'Comissões Parceiros', 'Equipe'),
  ('chip_monitor', 'Monitor de Chips', 'Operações'),
  ('queue', 'Fila de Mensagens', 'Operações'),
  ('webhooks', 'Webhooks', 'Operações'),
  ('templates', 'Templates', 'Operações'),
  ('quick_replies', 'Notas Rápidas', 'Operações'),
  ('tickets', 'Tickets', 'Comunicação'),
  ('internal_chat', 'Chat Interno', 'Comunicação'),
  ('links', 'Links Úteis', 'Ferramentas'),
  ('remote_assistance', 'Assistência Remota', 'Ferramentas'),
  ('audit_logs', 'Logs de Auditoria', 'Ferramentas'),
  ('permissions', 'Permissões', 'Ferramentas'),
  ('corban_dashboard', 'Dashboard Corban', 'Corban'),
  ('corban_propostas', 'Propostas', 'Corban'),
  ('corban_fgts', 'FGTS', 'Corban'),
  ('corban_assets', 'Assets/Tabelas', 'Corban'),
  ('corban_config', 'Config Corban', 'Corban'),
  ('seller_propostas', 'Minhas Propostas', 'Corban'),
  ('seller_fgts', 'Consulta FGTS', 'Corban'),
  ('whatsapp', 'Chat WhatsApp', 'WhatsApp'),
  ('master_admin', 'Master Admin', 'Sistema');
