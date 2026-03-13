CREATE OR REPLACE FUNCTION public.get_internal_chat_profiles()
RETURNS TABLE(user_id uuid, email text, name text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.user_id, p.email, p.name
  FROM profiles p
  INNER JOIN internal_channel_members icm ON icm.user_id = p.user_id
  INNER JOIN internal_channel_members my_channels ON my_channels.channel_id = icm.channel_id
  WHERE my_channels.user_id = auth.uid()
$$;