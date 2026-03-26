-- Table: corban_feature_config — controls visibility of Corban features per role
CREATE TABLE public.corban_feature_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text UNIQUE NOT NULL,
  feature_label text NOT NULL,
  category text NOT NULL,
  description text,
  visible_to_sellers boolean DEFAULT false,
  visible_to_support boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.corban_feature_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage corban config" ON public.corban_feature_config
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read corban config" ON public.corban_feature_config
  FOR SELECT TO authenticated USING (true);

-- Table: corban_assets_cache — cached assets from NewCorban API
CREATE TABLE public.corban_assets_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type text NOT NULL,
  asset_id text NOT NULL,
  asset_label text NOT NULL,
  raw_data jsonb,
  synced_at timestamptz DEFAULT now(),
  UNIQUE(asset_type, asset_id)
);

ALTER TABLE public.corban_assets_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage corban assets cache" ON public.corban_assets_cache
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Authenticated can read corban assets" ON public.corban_assets_cache
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service can insert corban assets" ON public.corban_assets_cache
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Service can update corban assets" ON public.corban_assets_cache
  FOR UPDATE TO public USING (true) WITH CHECK (true);

-- Seed the 30 features
INSERT INTO public.corban_feature_config (feature_key, feature_label, category, description, visible_to_sellers, visible_to_support, sort_order) VALUES
('admin_dashboard_propostas', 'Dashboard de Propostas', 'admin_consultas', 'Painel com total de propostas por status, banco e período', false, true, 1),
('admin_monitor_status', 'Monitor de Status em Tempo Real', 'admin_consultas', 'Gráfico de funil mostrando propostas por etapa', false, true, 2),
('admin_relatorio_banco', 'Relatório por Banco', 'admin_consultas', 'Tabela comparativa de volume por banco', false, true, 3),
('admin_relatorio_equipe', 'Relatório por Equipe', 'admin_consultas', 'Performance por equipe cadastrada na NewCorban', false, true, 4),
('admin_relatorio_origem', 'Relatório por Origem', 'admin_consultas', 'Rastreio de qual canal gera mais propostas', false, true, 5),
('admin_sync_bancos', 'Sincronizar Bancos', 'admin_sync', 'Auto-popular Info Produtos com lista de bancos atualizada', false, true, 6),
('admin_sync_status', 'Sincronizar Status', 'admin_sync', 'Manter lista de status sincronizada para filtros', false, true, 7),
('admin_sync_convenios', 'Sincronizar Convênios', 'admin_sync', 'Lista de convênios disponível para consulta', false, true, 8),
('admin_sync_produtos', 'Sincronizar Produtos', 'admin_sync', 'Tipos de produto (consignado, FGTS, etc)', false, true, 9),
('admin_logins_fgts', 'Gerenciar Logins FGTS', 'admin_fgts', 'Visualizar logins ativos por instituição', false, true, 10),
('admin_monitor_fila_fgts', 'Monitor de Fila FGTS', 'admin_fgts', 'Painel de acompanhamento de consultas FGTS', false, true, 11),
('admin_config_credenciais', 'Configuração de Credenciais', 'admin_config', 'Tela admin para salvar credenciais Corban', false, false, 12),
('admin_logs_integracao', 'Logs de Integração', 'admin_config', 'Registrar chamadas à API Corban em audit_logs', false, true, 13),
('admin_relatorio_tabelas', 'Relatório de Tabelas/Taxas', 'admin_config', 'Visualizar tabelas de taxas por banco', false, true, 14),
('admin_relatorio_franquias', 'Relatório de Franquias', 'admin_config', 'Listar franquias ativas na operação', false, true, 15),
('seller_consulta_cpf', 'Consulta Propostas por CPF', 'seller_consultas', 'Buscar propostas pelo CPF do lead', true, true, 1),
('seller_status_proposta', 'Status da Proposta no Lead', 'seller_consultas', 'Badge com status atual da proposta', true, true, 2),
('seller_historico_propostas', 'Histórico de Propostas', 'seller_consultas', 'Timeline de todas as propostas de um CPF', true, true, 3),
('seller_propostas_abertas', 'Verificar Propostas Abertas', 'seller_consultas', 'Alerta se já existe proposta em andamento', true, true, 4),
('seller_consulta_fgts', 'Consulta FGTS Rápida', 'seller_fgts', 'Botão "Consultar FGTS" no detalhe do lead', false, true, 5),
('seller_status_fgts', 'Status da Consulta FGTS', 'seller_fgts', 'Indicador se consulta FGTS está pendente/concluída', false, true, 6),
('seller_resultado_fgts', 'Resultado FGTS do Lead', 'seller_fgts', 'Saldo/parcelas FGTS disponível no lead', false, true, 7),
('seller_criar_proposta', 'Criar Proposta a partir do Lead', 'seller_acoes', 'Botão "Enviar para Corban" usando dados do lead', false, true, 8),
('seller_selecao_banco', 'Seleção de Banco', 'seller_acoes', 'Dropdown de bancos disponíveis ao criar proposta', true, true, 9),
('seller_selecao_convenio', 'Seleção de Convênio', 'seller_acoes', 'Dropdown de convênios ao criar proposta', true, true, 10),
('seller_selecao_produto', 'Seleção de Produto', 'seller_acoes', 'Escolher tipo de produto na criação', true, true, 11),
('seller_acompanhamento', 'Acompanhamento de Propostas', 'seller_acompanhamento', 'Lista "Minhas Propostas" com status atualizado', true, true, 12),
('seller_notificacao_status', 'Notificação de Mudança de Status', 'seller_acompanhamento', 'Alerta quando proposta muda de status', false, true, 13),
('seller_simulacao', 'Cálculo de Simulação', 'seller_acompanhamento', 'Simular valor liberado/parcela antes de enviar', false, true, 14),
('seller_bancos_disponiveis', 'Bancos Disponíveis', 'seller_acompanhamento', 'Ver quais bancos estão operando no momento', true, true, 15);