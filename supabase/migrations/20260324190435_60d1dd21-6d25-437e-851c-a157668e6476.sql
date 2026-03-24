
-- RPC: update own profile (name + avatar) safely bypassing RLS
CREATE OR REPLACE FUNCTION update_own_profile(
  _name text DEFAULT NULL,
  _avatar_url text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE profiles SET
    name = COALESCE(_name, name),
    avatar_url = COALESCE(_avatar_url, avatar_url),
    updated_at = now()
  WHERE user_id = auth.uid();
END;
$$;

-- Fix: admin policy to cover both master and admin roles
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
CREATE POLICY "Admins can manage all profiles" ON profiles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master') OR has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'master') OR has_role(auth.uid(), 'admin'));
