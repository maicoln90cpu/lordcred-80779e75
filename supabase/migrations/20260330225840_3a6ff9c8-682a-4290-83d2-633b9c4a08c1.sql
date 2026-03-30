
-- RLS policies for manager role on all key tables

CREATE POLICY "Managers can manage all chips" ON public.chips FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage all leads" ON public.client_leads FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage all conversations" ON public.conversations FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can view all messages" ON public.message_history FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can insert messages" ON public.message_history FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can update messages" ON public.message_history FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage message queue" ON public.message_queue FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage all profiles" ON public.profiles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can view user roles" ON public.user_roles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage conversation notes" ON public.conversation_notes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage kanban cards" ON public.kanban_cards FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage kanban columns" ON public.kanban_columns FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage all shortcuts" ON public.message_shortcuts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage templates" ON public.message_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage labels" ON public.labels FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can view audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage commission sales" ON public.commission_sales FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage clt rates" ON public.commission_rates_clt FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage fgts rates" ON public.commission_rates_fgts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage commission settings" ON public.commission_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage tickets" ON public.support_tickets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage ticket messages" ON public.ticket_messages FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage channels" ON public.internal_channels FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage channel members" ON public.internal_channel_members FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage internal messages" ON public.internal_messages FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage external numbers" ON public.external_numbers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can view webhook logs" ON public.webhook_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can view lifecycle logs" ON public.chip_lifecycle_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage corban assets" ON public.corban_assets_cache FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage corban config" ON public.corban_feature_config FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage useful links" ON public.useful_links FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage favorites" ON public.message_favorites FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage product tabs" ON public.product_info_tabs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage product columns" ON public.product_info_columns FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage product rows" ON public.product_info_rows FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage product cells" ON public.product_info_cells FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage seller pix" ON public.seller_pix FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage system settings" ON public.system_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

-- Update get_non_seller_user_ids to include manager
CREATE OR REPLACE FUNCTION public.get_non_seller_user_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin', 'support', 'master', 'manager');
$function$;

-- Update update_channel_info to allow manager
CREATE OR REPLACE FUNCTION public.update_channel_info(_channel_id uuid, _name text DEFAULT NULL, _description text DEFAULT NULL, _avatar_url text DEFAULT NULL, _admin_only boolean DEFAULT NULL, _config_allowed uuid[] DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (
    has_role(auth.uid(), 'master') OR 
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager') OR 
    has_role(auth.uid(), 'support') OR
    EXISTS (
      SELECT 1 FROM internal_channels 
      WHERE id = _channel_id 
      AND config_allowed_users @> ARRAY[auth.uid()]
    )
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE internal_channels SET
    name = COALESCE(_name, name),
    description = COALESCE(_description, description),
    avatar_url = COALESCE(_avatar_url, avatar_url),
    admin_only_messages = COALESCE(_admin_only, admin_only_messages),
    config_allowed_users = COALESCE(_config_allowed, config_allowed_users),
    updated_at = now()
  WHERE id = _channel_id;
END;
$function$;
