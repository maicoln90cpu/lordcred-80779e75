
CREATE OR REPLACE FUNCTION public.get_master_user_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(user_id), ARRAY[]::uuid[]) FROM user_roles WHERE role = 'master'
$$;
