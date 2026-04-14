
-- Create broadcast-media storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('broadcast-media', 'broadcast-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow privileged users to upload
CREATE POLICY "Privileged can upload broadcast media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'broadcast-media'
  AND is_privileged(auth.uid())
);

-- Allow privileged users to update
CREATE POLICY "Privileged can update broadcast media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'broadcast-media'
  AND is_privileged(auth.uid())
)
WITH CHECK (
  bucket_id = 'broadcast-media'
  AND is_privileged(auth.uid())
);

-- Allow privileged users to delete
CREATE POLICY "Privileged can delete broadcast media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'broadcast-media'
  AND is_privileged(auth.uid())
);

-- Public read access (needed for WhatsApp API to fetch media)
CREATE POLICY "Public can read broadcast media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'broadcast-media');
