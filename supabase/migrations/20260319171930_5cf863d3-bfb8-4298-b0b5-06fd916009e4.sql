-- Drop existing function to change return type
DROP FUNCTION IF EXISTS public.get_all_chat_profiles();

-- Recreate with avatar_url
CREATE OR REPLACE FUNCTION public.get_all_chat_profiles()
RETURNS TABLE(user_id uuid, email text, name text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT p.user_id, p.email, p.name, p.avatar_url
  FROM profiles p
  INNER JOIN user_roles ur ON ur.user_id = p.user_id
  WHERE p.is_blocked = false
$$;

-- Fix null statuses in existing leads
UPDATE client_leads SET status = 'pendente' WHERE status IS NULL;