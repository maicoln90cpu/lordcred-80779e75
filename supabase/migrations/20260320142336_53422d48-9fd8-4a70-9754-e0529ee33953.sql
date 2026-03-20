
CREATE OR REPLACE FUNCTION public.get_non_seller_user_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin', 'support', 'master');
$$;
