
-- Create storage bucket for imported spreadsheets
INSERT INTO storage.buckets (id, name, public)
VALUES ('imported-spreadsheets', 'imported-spreadsheets', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: privileged users can read all files
CREATE POLICY "Privileged users can read all spreadsheets"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'imported-spreadsheets'
  AND public.is_privileged(auth.uid())
);

-- RLS: authenticated users can upload to their own folder
CREATE POLICY "Users can upload spreadsheets to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'imported-spreadsheets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: privileged users can delete
CREATE POLICY "Privileged users can delete spreadsheets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'imported-spreadsheets'
  AND public.is_privileged(auth.uid())
);

-- Add file_path column to import_batches
ALTER TABLE public.import_batches
ADD COLUMN IF NOT EXISTS file_path text;
