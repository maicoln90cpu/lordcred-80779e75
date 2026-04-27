-- Add attachment fields to support_tickets
ALTER TABLE public.support_tickets 
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_name text;

-- Create storage bucket for ticket attachments (public for simple URL access; access still gated by ticket-row RLS visibility in UI)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-attachments', 'ticket-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
DROP POLICY IF EXISTS "Authenticated users can upload ticket attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload ticket attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ticket-attachments');

DROP POLICY IF EXISTS "Anyone can read ticket attachments" ON storage.objects;
CREATE POLICY "Anyone can read ticket attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'ticket-attachments');

DROP POLICY IF EXISTS "Owners and privileged can delete ticket attachments" ON storage.objects;
CREATE POLICY "Owners and privileged can delete ticket attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ticket-attachments' AND (owner = auth.uid() OR public.is_privileged(auth.uid())));