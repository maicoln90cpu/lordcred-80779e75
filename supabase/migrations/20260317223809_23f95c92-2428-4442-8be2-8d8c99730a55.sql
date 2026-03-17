
-- Add media columns to message_templates
ALTER TABLE public.message_templates ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE public.message_templates ADD COLUMN IF NOT EXISTS media_type TEXT;
ALTER TABLE public.message_templates ADD COLUMN IF NOT EXISTS media_filename TEXT;

-- Create template-media storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('template-media', 'template-media', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for template-media bucket: authenticated users can upload
CREATE POLICY "Authenticated users can upload template media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'template-media');

-- Anyone can read (public bucket)
CREATE POLICY "Public can read template media"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'template-media');

-- Admins/support/user can delete template media
CREATE POLICY "Managers can delete template media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'template-media' AND (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'support') OR
  public.has_role(auth.uid(), 'user')
));
