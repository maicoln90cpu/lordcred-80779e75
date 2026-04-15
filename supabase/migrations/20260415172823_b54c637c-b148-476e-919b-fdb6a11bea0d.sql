
CREATE OR REPLACE FUNCTION public.get_visible_profiles()
RETURNS TABLE(user_id uuid, name text, email text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT p.user_id, p.name, p.email, p.avatar_url
  FROM profiles p
  WHERE 
    NOT EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = p.user_id AND ur.role = 'master'
    )
    OR has_role(auth.uid(), 'master')
  ORDER BY p.name;
$$;
