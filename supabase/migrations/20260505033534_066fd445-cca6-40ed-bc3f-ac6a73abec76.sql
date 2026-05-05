
-- audit_logs
DROP POLICY IF EXISTS "Feature access read audit_logs" ON public.audit_logs;
CREATE POLICY "Feature access read audit_logs" ON public.audit_logs
FOR SELECT TO authenticated
USING (
  public.has_full_feature_access(auth.uid(), 'audit_logs')
  OR (public.has_feature_access(auth.uid(), 'audit_logs') AND user_id = auth.uid())
);

-- support_tickets
DROP POLICY IF EXISTS "Feature access manage support_tickets" ON public.support_tickets;
CREATE POLICY "Feature access read support_tickets" ON public.support_tickets
FOR SELECT TO authenticated
USING (
  public.has_full_feature_access(auth.uid(), 'tickets')
  OR (public.has_feature_access(auth.uid(), 'tickets') AND created_by = auth.uid())
);
CREATE POLICY "Feature access full manage support_tickets" ON public.support_tickets
FOR ALL TO authenticated
USING (public.has_full_feature_access(auth.uid(), 'tickets'))
WITH CHECK (public.has_full_feature_access(auth.uid(), 'tickets'));

-- broadcast_campaigns
DROP POLICY IF EXISTS "Feature access manage broadcast_campaigns" ON public.broadcast_campaigns;
CREATE POLICY "Feature access read broadcast_campaigns" ON public.broadcast_campaigns
FOR SELECT TO authenticated
USING (
  public.has_full_feature_access(auth.uid(), 'broadcasts')
  OR (public.has_feature_access(auth.uid(), 'broadcasts') AND created_by = auth.uid())
);
CREATE POLICY "Feature access full manage broadcast_campaigns" ON public.broadcast_campaigns
FOR ALL TO authenticated
USING (public.has_full_feature_access(auth.uid(), 'broadcasts'))
WITH CHECK (public.has_full_feature_access(auth.uid(), 'broadcasts'));

-- broadcast_recipients (segue campanha; scope total apenas)
DROP POLICY IF EXISTS "Feature access manage broadcast_recipients" ON public.broadcast_recipients;
CREATE POLICY "Feature access full manage broadcast_recipients" ON public.broadcast_recipients
FOR ALL TO authenticated
USING (public.has_full_feature_access(auth.uid(), 'broadcasts'))
WITH CHECK (public.has_full_feature_access(auth.uid(), 'broadcasts'));

-- bank_credentials (não tem coluna de dono → menu_only não vê)
DROP POLICY IF EXISTS "Feature access manage bank credentials" ON public.bank_credentials;
CREATE POLICY "Feature access full manage bank_credentials" ON public.bank_credentials
FOR ALL TO authenticated
USING (public.has_full_feature_access(auth.uid(), 'bank_credentials'))
WITH CHECK (public.has_full_feature_access(auth.uid(), 'bank_credentials'));

-- commission_sales_v2
DROP POLICY IF EXISTS "Feature access read commission_sales_v2" ON public.commission_sales_v2;
CREATE POLICY "Feature access read commission_sales_v2" ON public.commission_sales_v2
FOR SELECT TO authenticated
USING (
  public.has_full_feature_access(auth.uid(), 'commissions_v2')
  OR (public.has_feature_access(auth.uid(), 'commissions_v2') AND seller_id = auth.uid())
);
