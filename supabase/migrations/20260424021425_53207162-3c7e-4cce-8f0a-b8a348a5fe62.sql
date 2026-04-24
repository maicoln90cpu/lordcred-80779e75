-- HR photos: public bucket, authenticated users can upload
CREATE POLICY "HR photos are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'hr-photos');

CREATE POLICY "Authenticated users can upload HR photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'hr-photos');

CREATE POLICY "Authenticated users can update HR photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'hr-photos');

CREATE POLICY "Authenticated users can delete HR photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'hr-photos');

-- HR resumes: private bucket, only authenticated users
CREATE POLICY "Authenticated users can view HR resumes"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'hr-resumes');

CREATE POLICY "Authenticated users can upload HR resumes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'hr-resumes');

CREATE POLICY "Authenticated users can update HR resumes"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'hr-resumes');

CREATE POLICY "Authenticated users can delete HR resumes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'hr-resumes');