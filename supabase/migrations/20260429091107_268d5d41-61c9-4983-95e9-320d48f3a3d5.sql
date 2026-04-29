
-- Bucket privado para arquivar documentos enviados a operações V8 CLT
INSERT INTO storage.buckets (id, name, public)
VALUES ('v8-operation-documents', 'v8-operation-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Apenas privilegiados (master/admin/manager) + support podem ver/escrever
CREATE POLICY "v8_docs_select_privileged"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'v8-operation-documents'
  AND (public.is_privileged() OR public.has_role(auth.uid(), 'support'))
);

CREATE POLICY "v8_docs_insert_privileged"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'v8-operation-documents'
  AND (public.is_privileged() OR public.has_role(auth.uid(), 'support'))
);

CREATE POLICY "v8_docs_delete_privileged"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'v8-operation-documents'
  AND public.is_privileged()
);
