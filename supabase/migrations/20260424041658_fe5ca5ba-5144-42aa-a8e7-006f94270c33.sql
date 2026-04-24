-- =====================================================
-- 1.20: Triggers updated_at automáticos
-- =====================================================
DROP TRIGGER IF EXISTS hr_candidates_updated_at ON public.hr_candidates;
CREATE TRIGGER hr_candidates_updated_at
  BEFORE UPDATE ON public.hr_candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS hr_interviews_updated_at ON public.hr_interviews;
CREATE TRIGGER hr_interviews_updated_at
  BEFORE UPDATE ON public.hr_interviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS hr_partner_leads_updated_at ON public.hr_partner_leads;
CREATE TRIGGER hr_partner_leads_updated_at
  BEFORE UPDATE ON public.hr_partner_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 2.5: DELETE em hr_candidates apenas admin/master (não manager)
-- =====================================================
-- Remove policies antigas que possam permitir manager deletar
DROP POLICY IF EXISTS "Privileged users full access on hr_candidates" ON public.hr_candidates;
DROP POLICY IF EXISTS "HR candidates select" ON public.hr_candidates;
DROP POLICY IF EXISTS "HR candidates insert" ON public.hr_candidates;
DROP POLICY IF EXISTS "HR candidates update" ON public.hr_candidates;
DROP POLICY IF EXISTS "HR candidates delete" ON public.hr_candidates;

-- SELECT/INSERT/UPDATE: privilegiados (master, admin, manager)
CREATE POLICY "HR candidates select"
ON public.hr_candidates FOR SELECT TO authenticated
USING (public.is_privileged(auth.uid()));

CREATE POLICY "HR candidates insert"
ON public.hr_candidates FOR INSERT TO authenticated
WITH CHECK (public.is_privileged(auth.uid()));

CREATE POLICY "HR candidates update"
ON public.hr_candidates FOR UPDATE TO authenticated
USING (public.is_privileged(auth.uid()));

-- DELETE: apenas master + admin (manager NÃO pode)
CREATE POLICY "HR candidates delete admin only"
ON public.hr_candidates FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'master') OR
  public.has_role(auth.uid(), 'admin')
);

-- =====================================================
-- 3.5/3.6: Storage policies hr-photos / hr-resumes
-- =====================================================
-- Limpa policies antigas que possam estar abertas demais
DROP POLICY IF EXISTS "hr-photos public read" ON storage.objects;
DROP POLICY IF EXISTS "hr-photos authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "hr-photos privileged upload" ON storage.objects;
DROP POLICY IF EXISTS "hr-photos privileged update" ON storage.objects;
DROP POLICY IF EXISTS "hr-photos privileged delete" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view hr-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload hr-photos" ON storage.objects;

DROP POLICY IF EXISTS "hr-resumes privileged read" ON storage.objects;
DROP POLICY IF EXISTS "hr-resumes privileged upload" ON storage.objects;
DROP POLICY IF EXISTS "hr-resumes privileged update" ON storage.objects;
DROP POLICY IF EXISTS "hr-resumes privileged delete" ON storage.objects;
DROP POLICY IF EXISTS "hr-resumes authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "hr-resumes authenticated upload" ON storage.objects;

-- hr-photos: leitura pública (bucket é public), escrita apenas privileged
CREATE POLICY "hr-photos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'hr-photos');

CREATE POLICY "hr-photos privileged upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'hr-photos' AND public.is_privileged(auth.uid()));

CREATE POLICY "hr-photos privileged update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'hr-photos' AND public.is_privileged(auth.uid()));

CREATE POLICY "hr-photos privileged delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'hr-photos' AND public.is_privileged(auth.uid()));

-- hr-resumes: bucket privado, leitura/escrita apenas privileged (URL assinada cobre o cliente)
CREATE POLICY "hr-resumes privileged read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'hr-resumes' AND public.is_privileged(auth.uid()));

CREATE POLICY "hr-resumes privileged upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'hr-resumes' AND public.is_privileged(auth.uid()));

CREATE POLICY "hr-resumes privileged update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'hr-resumes' AND public.is_privileged(auth.uid()));

CREATE POLICY "hr-resumes privileged delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'hr-resumes' AND public.is_privileged(auth.uid()));