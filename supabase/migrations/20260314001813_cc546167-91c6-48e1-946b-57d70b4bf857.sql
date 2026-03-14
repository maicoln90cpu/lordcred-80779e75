
-- 1. Add media columns to internal_messages
ALTER TABLE public.internal_messages
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS media_name text;

-- 2. Create storage bucket for internal chat media
INSERT INTO storage.buckets (id, name, public)
VALUES ('internal-chat-media', 'internal-chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS: authenticated users can upload
CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'internal-chat-media');

-- 4. Storage RLS: anyone can read (public bucket)
CREATE POLICY "Public can read internal chat media"
ON storage.objects FOR SELECT
USING (bucket_id = 'internal-chat-media');

-- 5. Seller RLS: allow sellers to create direct (non-group) channels
CREATE POLICY "Sellers can create direct channels"
ON public.internal_channels FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'seller'::app_role)
  AND is_group = false
  AND created_by = auth.uid()
);

-- 6. Seller RLS: allow sellers to add members to their own direct channels
CREATE POLICY "Sellers can add members to own direct channels"
ON public.internal_channel_members FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'seller'::app_role)
  AND channel_id IN (
    SELECT id FROM internal_channels WHERE created_by = auth.uid() AND is_group = false
  )
);

-- 7. Create a function for all users to list all profiles (for starting direct chats)
CREATE OR REPLACE FUNCTION public.get_all_chat_profiles()
RETURNS TABLE(user_id uuid, email text, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.user_id, p.email, p.name
  FROM profiles p
  INNER JOIN user_roles ur ON ur.user_id = p.user_id
  WHERE p.is_blocked = false
$$;
