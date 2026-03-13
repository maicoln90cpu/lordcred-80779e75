
-- 1. Create SECURITY DEFINER function to check channel membership without RLS recursion
CREATE OR REPLACE FUNCTION public.is_channel_member(_user_id uuid, _channel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM internal_channel_members
    WHERE user_id = _user_id AND channel_id = _channel_id
  )
$$;

-- 2. Drop recursive policies
DROP POLICY IF EXISTS "Members can view channel members" ON internal_channel_members;
DROP POLICY IF EXISTS "Members can view their channels" ON internal_channels;
DROP POLICY IF EXISTS "Members can view channel messages" ON internal_messages;
DROP POLICY IF EXISTS "Members can send messages" ON internal_messages;

-- 3. Recreate policies using the SECURITY DEFINER function
CREATE POLICY "Members can view channel members"
ON internal_channel_members FOR SELECT TO authenticated
USING (is_channel_member(auth.uid(), channel_id));

CREATE POLICY "Members can view their channels"
ON internal_channels FOR SELECT TO authenticated
USING (is_channel_member(auth.uid(), id));

CREATE POLICY "Members can view channel messages"
ON internal_messages FOR SELECT TO authenticated
USING (is_channel_member(auth.uid(), channel_id));

CREATE POLICY "Members can send messages"
ON internal_messages FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND is_channel_member(auth.uid(), channel_id));
