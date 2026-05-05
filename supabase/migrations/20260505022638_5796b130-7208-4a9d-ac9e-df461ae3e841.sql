CREATE OR REPLACE FUNCTION public.has_feature_access(_user_id uuid, _feature_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_privileged(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.feature_permissions fp
      LEFT JOIN public.master_feature_toggles mt ON mt.feature_key = fp.feature_key
      JOIN public.user_roles ur ON ur.user_id = _user_id
      WHERE fp.feature_key = _feature_key
        AND COALESCE(mt.is_enabled, true) = true
        AND (
          ur.role::text = ANY(COALESCE(fp.allowed_roles, ARRAY[]::text[]))
          OR _user_id = ANY(COALESCE(fp.allowed_user_ids, ARRAY[]::uuid[]))
        )
    );
$$;

DROP POLICY IF EXISTS "Feature access manage bank credentials" ON public.bank_credentials;
CREATE POLICY "Feature access manage bank credentials"
  ON public.bank_credentials FOR ALL TO authenticated
  USING (public.has_feature_access(auth.uid(), 'bank_credentials'))
  WITH CHECK (public.has_feature_access(auth.uid(), 'bank_credentials'));

DROP POLICY IF EXISTS "Feature access manage partners" ON public.partners;
CREATE POLICY "Feature access manage partners"
  ON public.partners FOR ALL TO authenticated
  USING (public.has_feature_access(auth.uid(), 'partners'))
  WITH CHECK (public.has_feature_access(auth.uid(), 'partners'));

DROP POLICY IF EXISTS "Feature access read cr_geral" ON public.cr_geral;
CREATE POLICY "Feature access read cr_geral" ON public.cr_geral FOR SELECT TO authenticated
  USING (public.has_feature_access(auth.uid(), 'commission_reports'));

DROP POLICY IF EXISTS "Feature access read cr_relatorio" ON public.cr_relatorio;
CREATE POLICY "Feature access read cr_relatorio" ON public.cr_relatorio FOR SELECT TO authenticated
  USING (public.has_feature_access(auth.uid(), 'commission_reports'));

DROP POLICY IF EXISTS "Feature access read cr_repasse" ON public.cr_repasse;
CREATE POLICY "Feature access read cr_repasse" ON public.cr_repasse FOR SELECT TO authenticated
  USING (public.has_feature_access(auth.uid(), 'commission_reports'));

DROP POLICY IF EXISTS "Feature access read cr_seguros" ON public.cr_seguros;
CREATE POLICY "Feature access read cr_seguros" ON public.cr_seguros FOR SELECT TO authenticated
  USING (public.has_feature_access(auth.uid(), 'commission_reports'));

DROP POLICY IF EXISTS "Feature access read cr_rules_clt" ON public.cr_rules_clt;
CREATE POLICY "Feature access read cr_rules_clt" ON public.cr_rules_clt FOR SELECT TO authenticated
  USING (public.has_feature_access(auth.uid(), 'commission_reports'));

DROP POLICY IF EXISTS "Feature access read cr_rules_fgts" ON public.cr_rules_fgts;
CREATE POLICY "Feature access read cr_rules_fgts" ON public.cr_rules_fgts FOR SELECT TO authenticated
  USING (public.has_feature_access(auth.uid(), 'commission_reports'));

DROP POLICY IF EXISTS "Feature access read commission_sales" ON public.commission_sales;
CREATE POLICY "Feature access read commission_sales" ON public.commission_sales FOR SELECT TO authenticated
  USING (public.has_feature_access(auth.uid(), 'commissions'));

DROP POLICY IF EXISTS "Feature access manage hr_candidates" ON public.hr_candidates;
CREATE POLICY "Feature access manage hr_candidates" ON public.hr_candidates FOR ALL TO authenticated
  USING (public.has_feature_access(auth.uid(), 'hr'))
  WITH CHECK (public.has_feature_access(auth.uid(), 'hr'));

DROP POLICY IF EXISTS "Feature access manage hr_employees" ON public.hr_employees;
CREATE POLICY "Feature access manage hr_employees" ON public.hr_employees FOR ALL TO authenticated
  USING (public.has_feature_access(auth.uid(), 'hr'))
  WITH CHECK (public.has_feature_access(auth.uid(), 'hr'));

DROP POLICY IF EXISTS "Feature access manage hr_calendar_events" ON public.hr_calendar_events;
CREATE POLICY "Feature access manage hr_calendar_events" ON public.hr_calendar_events FOR ALL TO authenticated
  USING (public.has_feature_access(auth.uid(), 'hr'))
  WITH CHECK (public.has_feature_access(auth.uid(), 'hr'));

DROP POLICY IF EXISTS "Feature access manage hr_kanban_columns" ON public.hr_kanban_columns;
CREATE POLICY "Feature access manage hr_kanban_columns" ON public.hr_kanban_columns FOR ALL TO authenticated
  USING (public.has_feature_access(auth.uid(), 'hr'))
  WITH CHECK (public.has_feature_access(auth.uid(), 'hr'));