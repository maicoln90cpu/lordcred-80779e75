
-- 1. Add feature_permissions to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.feature_permissions;

-- 2. Create is_privileged() function (master, admin, manager)
CREATE OR REPLACE FUNCTION public.is_privileged(_user_id uuid DEFAULT auth.uid())
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('master', 'admin', 'manager')
  )
$$;

-- 3. Drop duplicate admin/manager/master policies and consolidate
-- We'll keep support policies separate since they have different access patterns

-- ============ chips ============
DROP POLICY IF EXISTS "Admins can manage all chips" ON public.chips;
DROP POLICY IF EXISTS "Admins can view all chips" ON public.chips;
DROP POLICY IF EXISTS "Managers can manage all chips" ON public.chips;
CREATE POLICY "Privileged can manage all chips" ON public.chips FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ client_leads ============
DROP POLICY IF EXISTS "Admins can manage all leads" ON public.client_leads;
DROP POLICY IF EXISTS "Managers can manage all leads" ON public.client_leads;
CREATE POLICY "Privileged can manage all leads" ON public.client_leads FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ conversations ============
DROP POLICY IF EXISTS "Admin role can view all conversations" ON public.conversations;
DROP POLICY IF EXISTS "Admins can manage all conversations" ON public.conversations;
DROP POLICY IF EXISTS "Admins can view all conversations" ON public.conversations;
DROP POLICY IF EXISTS "Managers can manage all conversations" ON public.conversations;
CREATE POLICY "Privileged can manage all conversations" ON public.conversations FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ message_history ============
DROP POLICY IF EXISTS "Admin role can view all messages" ON public.message_history;
DROP POLICY IF EXISTS "Admins can view all messages" ON public.message_history;
DROP POLICY IF EXISTS "Managers can view all messages" ON public.message_history;
DROP POLICY IF EXISTS "Managers can insert messages" ON public.message_history;
DROP POLICY IF EXISTS "Managers can update messages" ON public.message_history;
CREATE POLICY "Privileged can view all messages" ON public.message_history FOR SELECT TO authenticated
  USING (is_privileged(auth.uid()));
CREATE POLICY "Privileged can insert messages" ON public.message_history FOR INSERT TO authenticated
  WITH CHECK (is_privileged(auth.uid()));
CREATE POLICY "Privileged can update messages" ON public.message_history FOR UPDATE TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ message_queue ============
DROP POLICY IF EXISTS "Admins can manage all queue items" ON public.message_queue;
DROP POLICY IF EXISTS "Admins can view all queue items" ON public.message_queue;
DROP POLICY IF EXISTS "Managers can manage message queue" ON public.message_queue;
CREATE POLICY "Privileged can manage message queue" ON public.message_queue FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ profiles ============
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Managers can manage all profiles" ON public.profiles;
CREATE POLICY "Privileged can manage all profiles" ON public.profiles FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ conversation_notes ============
DROP POLICY IF EXISTS "Admins can manage all conversation notes" ON public.conversation_notes;
DROP POLICY IF EXISTS "Managers can manage conversation notes" ON public.conversation_notes;
CREATE POLICY "Privileged can manage conversation notes" ON public.conversation_notes FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ kanban_cards ============
DROP POLICY IF EXISTS "Admins can manage all kanban cards" ON public.kanban_cards;
DROP POLICY IF EXISTS "Managers can manage kanban cards" ON public.kanban_cards;
CREATE POLICY "Privileged can manage kanban cards" ON public.kanban_cards FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ kanban_columns ============
DROP POLICY IF EXISTS "Admin role can manage kanban columns" ON public.kanban_columns;
DROP POLICY IF EXISTS "Admins can manage kanban columns" ON public.kanban_columns;
DROP POLICY IF EXISTS "Managers can manage kanban columns" ON public.kanban_columns;
CREATE POLICY "Privileged can manage kanban columns" ON public.kanban_columns FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ message_shortcuts ============
DROP POLICY IF EXISTS "Admin role can manage all shortcuts" ON public.message_shortcuts;
DROP POLICY IF EXISTS "Masters can manage all shortcuts" ON public.message_shortcuts;
DROP POLICY IF EXISTS "Managers can manage all shortcuts" ON public.message_shortcuts;
CREATE POLICY "Privileged can manage all shortcuts" ON public.message_shortcuts FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ message_templates ============
DROP POLICY IF EXISTS "Admins can manage templates" ON public.message_templates;
DROP POLICY IF EXISTS "Masters can manage templates" ON public.message_templates;
DROP POLICY IF EXISTS "Managers can manage templates" ON public.message_templates;
CREATE POLICY "Privileged can manage templates" ON public.message_templates FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ labels ============
DROP POLICY IF EXISTS "Admins can manage all labels" ON public.labels;
DROP POLICY IF EXISTS "Managers can manage labels" ON public.labels;
CREATE POLICY "Privileged can manage labels" ON public.labels FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ audit_logs ============
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Masters can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Managers can view audit logs" ON public.audit_logs;
CREATE POLICY "Privileged can view audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (is_privileged(auth.uid()));

-- ============ feature_permissions ============
DROP POLICY IF EXISTS "Admins can manage feature permissions" ON public.feature_permissions;
DROP POLICY IF EXISTS "Managers can read feature permissions" ON public.feature_permissions;
CREATE POLICY "Privileged can manage feature permissions" ON public.feature_permissions FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ commission_sales ============
DROP POLICY IF EXISTS "Admins can manage all sales" ON public.commission_sales;
DROP POLICY IF EXISTS "Managers can manage commission sales" ON public.commission_sales;
CREATE POLICY "Privileged can manage commission sales" ON public.commission_sales FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ commission_rates_clt ============
DROP POLICY IF EXISTS "Admins can manage clt rates" ON public.commission_rates_clt;
DROP POLICY IF EXISTS "Managers can manage clt rates" ON public.commission_rates_clt;
CREATE POLICY "Privileged can manage clt rates" ON public.commission_rates_clt FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ commission_rates_fgts ============
DROP POLICY IF EXISTS "Admins can manage fgts rates" ON public.commission_rates_fgts;
DROP POLICY IF EXISTS "Managers can manage fgts rates" ON public.commission_rates_fgts;
CREATE POLICY "Privileged can manage fgts rates" ON public.commission_rates_fgts FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ commission_settings ============
DROP POLICY IF EXISTS "Admins can manage commission settings" ON public.commission_settings;
DROP POLICY IF EXISTS "Managers can manage commission settings" ON public.commission_settings;
CREATE POLICY "Privileged can manage commission settings" ON public.commission_settings FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ external_numbers ============
DROP POLICY IF EXISTS "Admins can delete external numbers" ON public.external_numbers;
DROP POLICY IF EXISTS "Admins can insert external numbers" ON public.external_numbers;
DROP POLICY IF EXISTS "Admins can manage external numbers" ON public.external_numbers;
DROP POLICY IF EXISTS "Admins can read external numbers" ON public.external_numbers;
DROP POLICY IF EXISTS "Admins can update external numbers" ON public.external_numbers;
DROP POLICY IF EXISTS "Managers can manage external numbers" ON public.external_numbers;
CREATE POLICY "Privileged can manage external numbers" ON public.external_numbers FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ internal_channels ============
DROP POLICY IF EXISTS "Masters and admins can manage channels" ON public.internal_channels;
DROP POLICY IF EXISTS "Managers can manage channels" ON public.internal_channels;
CREATE POLICY "Privileged can manage channels" ON public.internal_channels FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ internal_channel_members ============
DROP POLICY IF EXISTS "Masters and admins can manage channel members" ON public.internal_channel_members;
DROP POLICY IF EXISTS "Managers can manage channel members" ON public.internal_channel_members;
CREATE POLICY "Privileged can manage channel members" ON public.internal_channel_members FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ internal_messages ============
DROP POLICY IF EXISTS "Masters and admins can manage messages" ON public.internal_messages;
DROP POLICY IF EXISTS "Managers can manage internal messages" ON public.internal_messages;
CREATE POLICY "Privileged can manage internal messages" ON public.internal_messages FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ user_roles ============
DROP POLICY IF EXISTS "Managers can view user roles" ON public.user_roles;
CREATE POLICY "Privileged can view user roles" ON public.user_roles FOR SELECT TO authenticated
  USING (is_privileged(auth.uid()));

-- ============ support_tickets ============
DROP POLICY IF EXISTS "Managers can manage tickets" ON public.support_tickets;
CREATE POLICY "Privileged can manage tickets" ON public.support_tickets FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ ticket_messages ============
DROP POLICY IF EXISTS "Managers can manage ticket messages" ON public.ticket_messages;
CREATE POLICY "Privileged can manage ticket messages" ON public.ticket_messages FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ webhook_logs ============
DROP POLICY IF EXISTS "Managers can view webhook logs" ON public.webhook_logs;
CREATE POLICY "Privileged can view webhook logs" ON public.webhook_logs FOR SELECT TO authenticated
  USING (is_privileged(auth.uid()));

-- ============ chip_lifecycle_logs ============
DROP POLICY IF EXISTS "Admins can view all lifecycle logs" ON public.chip_lifecycle_logs;
DROP POLICY IF EXISTS "Managers can view lifecycle logs" ON public.chip_lifecycle_logs;
CREATE POLICY "Privileged can view lifecycle logs" ON public.chip_lifecycle_logs FOR SELECT TO authenticated
  USING (is_privileged(auth.uid()));

-- ============ corban_assets_cache ============
DROP POLICY IF EXISTS "Admins can manage corban assets cache" ON public.corban_assets_cache;
DROP POLICY IF EXISTS "Managers can manage corban assets" ON public.corban_assets_cache;
CREATE POLICY "Privileged can manage corban assets" ON public.corban_assets_cache FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ corban_feature_config ============
DROP POLICY IF EXISTS "Admins can manage corban config" ON public.corban_feature_config;
DROP POLICY IF EXISTS "Managers can manage corban config" ON public.corban_feature_config;
CREATE POLICY "Privileged can manage corban config" ON public.corban_feature_config FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ useful_links ============
DROP POLICY IF EXISTS "Managers can manage useful links" ON public.useful_links;
CREATE POLICY "Privileged can manage useful links" ON public.useful_links FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ message_favorites ============
DROP POLICY IF EXISTS "Managers can manage favorites" ON public.message_favorites;
CREATE POLICY "Privileged can manage favorites" ON public.message_favorites FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ product_info_tabs ============
DROP POLICY IF EXISTS "Managers can manage product tabs" ON public.product_info_tabs;
CREATE POLICY "Privileged can manage product tabs" ON public.product_info_tabs FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ product_info_columns ============
DROP POLICY IF EXISTS "Admins can delete columns" ON public.product_info_columns;
DROP POLICY IF EXISTS "Admins can insert columns" ON public.product_info_columns;
DROP POLICY IF EXISTS "Admins can update columns" ON public.product_info_columns;
DROP POLICY IF EXISTS "Managers can manage product columns" ON public.product_info_columns;
CREATE POLICY "Privileged can manage product columns" ON public.product_info_columns FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ product_info_rows ============
DROP POLICY IF EXISTS "Admins can delete rows" ON public.product_info_rows;
DROP POLICY IF EXISTS "Admins can insert rows" ON public.product_info_rows;
DROP POLICY IF EXISTS "Admins can update rows" ON public.product_info_rows;
DROP POLICY IF EXISTS "Managers can manage product rows" ON public.product_info_rows;
CREATE POLICY "Privileged can manage product rows" ON public.product_info_rows FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ product_info_cells ============
DROP POLICY IF EXISTS "Admins can delete cells" ON public.product_info_cells;
DROP POLICY IF EXISTS "Admins can insert cells" ON public.product_info_cells;
DROP POLICY IF EXISTS "Admins can update cells" ON public.product_info_cells;
DROP POLICY IF EXISTS "Managers can manage product cells" ON public.product_info_cells;
CREATE POLICY "Privileged can manage product cells" ON public.product_info_cells FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ seller_pix ============
DROP POLICY IF EXISTS "Managers can manage seller pix" ON public.seller_pix;
CREATE POLICY "Privileged can manage seller pix" ON public.seller_pix FOR ALL TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- ============ system_settings ============
DROP POLICY IF EXISTS "Managers can manage system settings" ON public.system_settings;
-- system_settings already has open read/update for authenticated, manager policy just adds redundancy

-- ============ product_info_tabs (admin-specific) ============
DROP POLICY IF EXISTS "Admins can delete tabs" ON public.product_info_tabs;
DROP POLICY IF EXISTS "Admins can insert tabs" ON public.product_info_tabs;
DROP POLICY IF EXISTS "Admins can update tabs" ON public.product_info_tabs;
