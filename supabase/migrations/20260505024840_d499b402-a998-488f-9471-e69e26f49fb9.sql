
-- ---------- V8 Simulador ----------
DROP POLICY IF EXISTS "Feature access view v8_simulations" ON public.v8_simulations;
CREATE POLICY "Feature access view v8_simulations" ON public.v8_simulations FOR SELECT TO authenticated USING (public.has_feature_access(auth.uid(), 'v8_simulador'));

DROP POLICY IF EXISTS "Feature access view v8_batches" ON public.v8_batches;
CREATE POLICY "Feature access view v8_batches" ON public.v8_batches FOR SELECT TO authenticated USING (public.has_feature_access(auth.uid(), 'v8_simulador'));

DROP POLICY IF EXISTS "Feature access view v8_simulation_attempts" ON public.v8_simulation_attempts;
CREATE POLICY "Feature access view v8_simulation_attempts" ON public.v8_simulation_attempts FOR SELECT TO authenticated USING (public.has_feature_access(auth.uid(), 'v8_simulador'));

DROP POLICY IF EXISTS "Feature access view v8_operations_local" ON public.v8_operations_local;
CREATE POLICY "Feature access view v8_operations_local" ON public.v8_operations_local FOR SELECT TO authenticated USING (public.has_feature_access(auth.uid(), 'v8_simulador'));

DROP POLICY IF EXISTS "Feature access view v8_settings" ON public.v8_settings;
CREATE POLICY "Feature access view v8_settings" ON public.v8_settings FOR SELECT TO authenticated USING (public.has_feature_access(auth.uid(), 'v8_simulador'));

DROP POLICY IF EXISTS "Feature access view v8_configs_cache" ON public.v8_configs_cache;
CREATE POLICY "Feature access view v8_configs_cache" ON public.v8_configs_cache FOR SELECT TO authenticated USING (public.has_feature_access(auth.uid(), 'v8_simulador'));

DROP POLICY IF EXISTS "Feature access view v8_contact_pool" ON public.v8_contact_pool;
CREATE POLICY "Feature access view v8_contact_pool" ON public.v8_contact_pool FOR SELECT TO authenticated USING (public.has_feature_access(auth.uid(), 'v8_simulador'));

DROP POLICY IF EXISTS "Feature access view v8_contact_pool_imports" ON public.v8_contact_pool_imports;
CREATE POLICY "Feature access view v8_contact_pool_imports" ON public.v8_contact_pool_imports FOR SELECT TO authenticated USING (public.has_feature_access(auth.uid(), 'v8_simulador'));

DROP POLICY IF EXISTS "Feature access view v8_margin_config" ON public.v8_margin_config;
CREATE POLICY "Feature access view v8_margin_config" ON public.v8_margin_config FOR SELECT TO authenticated USING (public.has_feature_access(auth.uid(), 'v8_simulador'));

DROP POLICY IF EXISTS "Feature access view v8_webhook_logs" ON public.v8_webhook_logs;
CREATE POLICY "Feature access view v8_webhook_logs" ON public.v8_webhook_logs FOR SELECT TO authenticated USING (public.has_feature_access(auth.uid(), 'v8_simulador'));

-- ---------- Broadcasts ----------
DROP POLICY IF EXISTS "Feature access manage broadcast_campaigns" ON public.broadcast_campaigns;
CREATE POLICY "Feature access manage broadcast_campaigns" ON public.broadcast_campaigns FOR ALL TO authenticated USING (public.has_feature_access(auth.uid(), 'broadcasts')) WITH CHECK (public.has_feature_access(auth.uid(), 'broadcasts'));

DROP POLICY IF EXISTS "Feature access manage broadcast_recipients" ON public.broadcast_recipients;
CREATE POLICY "Feature access manage broadcast_recipients" ON public.broadcast_recipients FOR ALL TO authenticated USING (public.has_feature_access(auth.uid(), 'broadcasts')) WITH CHECK (public.has_feature_access(auth.uid(), 'broadcasts'));

DROP POLICY IF EXISTS "Feature access manage broadcast_blacklist" ON public.broadcast_blacklist;
CREATE POLICY "Feature access manage broadcast_blacklist" ON public.broadcast_blacklist FOR ALL TO authenticated USING (public.has_feature_access(auth.uid(), 'broadcasts')) WITH CHECK (public.has_feature_access(auth.uid(), 'broadcasts'));

-- ---------- Comissões V2 ----------
DROP POLICY IF EXISTS "Feature access read commission_sales_v2" ON public.commission_sales_v2;
CREATE POLICY "Feature access read commission_sales_v2" ON public.commission_sales_v2 FOR SELECT TO authenticated USING (public.has_feature_access(auth.uid(), 'commissions_v2'));

DROP POLICY IF EXISTS "Feature access read commission_rates_fgts_v2" ON public.commission_rates_fgts_v2;
CREATE POLICY "Feature access read commission_rates_fgts_v2" ON public.commission_rates_fgts_v2 FOR SELECT TO authenticated USING (public.has_feature_access(auth.uid(), 'commissions_v2'));

DROP POLICY IF EXISTS "Feature access read commission_rates_clt_v2" ON public.commission_rates_clt_v2;
CREATE POLICY "Feature access read commission_rates_clt_v2" ON public.commission_rates_clt_v2 FOR SELECT TO authenticated USING (public.has_feature_access(auth.uid(), 'commissions_v2'));

DROP POLICY IF EXISTS "Feature access read commission_settings_v2" ON public.commission_settings_v2;
CREATE POLICY "Feature access read commission_settings_v2" ON public.commission_settings_v2 FOR SELECT TO authenticated USING (public.has_feature_access(auth.uid(), 'commissions_v2'));

DROP POLICY IF EXISTS "Feature access read commission_bonus_tiers_v2" ON public.commission_bonus_tiers_v2;
CREATE POLICY "Feature access read commission_bonus_tiers_v2" ON public.commission_bonus_tiers_v2 FOR SELECT TO authenticated USING (public.has_feature_access(auth.uid(), 'commissions_v2'));

DROP POLICY IF EXISTS "Feature access read commission_annual_rewards_v2" ON public.commission_annual_rewards_v2;
CREATE POLICY "Feature access read commission_annual_rewards_v2" ON public.commission_annual_rewards_v2 FOR SELECT TO authenticated USING (public.has_feature_access(auth.uid(), 'commissions_v2'));

DROP POLICY IF EXISTS "Feature access read seller_pix_v2" ON public.seller_pix_v2;
CREATE POLICY "Feature access read seller_pix_v2" ON public.seller_pix_v2 FOR SELECT TO authenticated USING (public.has_feature_access(auth.uid(), 'commissions_v2'));

-- ---------- Queue ----------
DROP POLICY IF EXISTS "Feature access view message_queue" ON public.message_queue;
CREATE POLICY "Feature access view message_queue" ON public.message_queue FOR SELECT TO authenticated USING (public.has_feature_access(auth.uid(), 'queue'));

DROP POLICY IF EXISTS "Feature access update message_queue" ON public.message_queue;
CREATE POLICY "Feature access update message_queue" ON public.message_queue FOR UPDATE TO authenticated USING (public.has_feature_access(auth.uid(), 'queue'));

DROP POLICY IF EXISTS "Feature access delete message_queue" ON public.message_queue;
CREATE POLICY "Feature access delete message_queue" ON public.message_queue FOR DELETE TO authenticated USING (public.has_feature_access(auth.uid(), 'queue'));

-- ---------- Tickets ----------
DROP POLICY IF EXISTS "Feature access manage support_tickets" ON public.support_tickets;
CREATE POLICY "Feature access manage support_tickets" ON public.support_tickets FOR ALL TO authenticated USING (public.has_feature_access(auth.uid(), 'tickets')) WITH CHECK (public.has_feature_access(auth.uid(), 'tickets'));

DROP POLICY IF EXISTS "Feature access manage ticket_messages" ON public.ticket_messages;
CREATE POLICY "Feature access manage ticket_messages" ON public.ticket_messages FOR ALL TO authenticated USING (public.has_feature_access(auth.uid(), 'tickets')) WITH CHECK (public.has_feature_access(auth.uid(), 'tickets'));

-- ---------- Audit / Chip / Warming ----------
DROP POLICY IF EXISTS "Feature access read audit_logs" ON public.audit_logs;
CREATE POLICY "Feature access read audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_feature_access(auth.uid(), 'audit_logs'));

DROP POLICY IF EXISTS "Feature access read chip_lifecycle_logs" ON public.chip_lifecycle_logs;
CREATE POLICY "Feature access read chip_lifecycle_logs" ON public.chip_lifecycle_logs FOR SELECT TO authenticated USING (public.has_feature_access(auth.uid(), 'chip_monitor'));

DROP POLICY IF EXISTS "Feature access read message_history warming" ON public.message_history;
CREATE POLICY "Feature access read message_history warming" ON public.message_history FOR SELECT TO authenticated USING (public.has_feature_access(auth.uid(), 'warming_reports'));

-- =========================================================
-- SEED feature_permissions — todas as 38 keys (com label/group)
-- =========================================================
INSERT INTO public.feature_permissions (feature_key, feature_label, feature_group, allowed_roles, allowed_user_ids) VALUES
  ('audit_logs','Logs de Auditoria','Operações','{}','{}'),
  ('bank_credentials','Bancos','Financeiro','{}','{}'),
  ('broadcasts','Broadcasts','Comunicação','{}','{}'),
  ('chip_monitor','Monitor de Chips','Operações','{}','{}'),
  ('chips','Meus Chips','WhatsApp','{}','{}'),
  ('commission_reports','Relat. Comissões','Financeiro','{}','{}'),
  ('commissions','Comissões Parceiros','Financeiro','{}','{}'),
  ('commissions_v2','Comissões V2','Financeiro','{}','{}'),
  ('contract_template','Template Contrato','Parceiros','{}','{}'),
  ('corban_assets','Corban Assets','Corban','{}','{}'),
  ('corban_config','Corban Config','Corban','{}','{}'),
  ('corban_dashboard','Corban Dashboard','Corban','{}','{}'),
  ('corban_fgts','Corban FGTS','Corban','{}','{}'),
  ('corban_propostas','Corban Propostas','Corban','{}','{}'),
  ('dashboard','Dashboard','Geral','{}','{}'),
  ('hr','RH','Equipe','{}','{}'),
  ('integrations','Integrações','Admin','{}','{}'),
  ('internal_chat','Chat Interno','Comunicação','{}','{}'),
  ('kanban','Kanban','CRM','{}','{}'),
  ('leads','Leads','CRM','{}','{}'),
  ('links','Links Úteis','Ferramentas','{}','{}'),
  ('partners','Parceiros','Parceiros','{}','{}'),
  ('performance','Performance','Equipe','{}','{}'),
  ('permissions','Permissões','Admin','{}','{}'),
  ('product_info','Info Produtos','Equipe','{}','{}'),
  ('queue','Fila de Mensagens','Operações','{}','{}'),
  ('quick_replies','Notas Rápidas','Operações','{}','{}'),
  ('remote_assistance','Assistência Remota','Admin','{}','{}'),
  ('seller_fgts','FGTS (Vendedor)','Corban','{}','{}'),
  ('seller_propostas','Propostas (Vendedor)','Corban','{}','{}'),
  ('settings_warming','Config. Aquecimento','WhatsApp','{}','{}'),
  ('templates','Templates','Operações','{}','{}'),
  ('tickets','Tickets','Comunicação','{}','{}'),
  ('users','Usuários','Equipe','{}','{}'),
  ('v8_simulador','Simulador V8 CLT','Financeiro','{}','{}'),
  ('warming_reports','Relat. Aquecimento','WhatsApp','{}','{}'),
  ('webhooks','Webhooks','Operações','{}','{}'),
  ('whatsapp','WhatsApp','WhatsApp','{}','{}')
ON CONFLICT (feature_key) DO NOTHING;
