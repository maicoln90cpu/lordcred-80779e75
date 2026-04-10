
-- Create storage bucket for contract templates
INSERT INTO storage.buckets (id, name, public)
VALUES ('contract-templates', 'contract-templates', false);

-- RLS policies for contract-templates bucket
CREATE POLICY "Privileged can upload contract templates"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'contract-templates' AND is_privileged(auth.uid()));

CREATE POLICY "Privileged can read contract templates"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'contract-templates' AND is_privileged(auth.uid()));

CREATE POLICY "Privileged can update contract templates"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'contract-templates' AND is_privileged(auth.uid()));

CREATE POLICY "Privileged can delete contract templates"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'contract-templates' AND is_privileged(auth.uid()));

-- Service role access for edge functions
CREATE POLICY "Service can read contract templates"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'contract-templates');
