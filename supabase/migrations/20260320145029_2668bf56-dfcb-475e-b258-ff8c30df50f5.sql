
-- Add last_read_at to track when user last read a channel
ALTER TABLE internal_channel_members ADD COLUMN IF NOT EXISTS last_read_at timestamptz DEFAULT now();

-- RPC to get unread counts per channel for the current user
CREATE OR REPLACE FUNCTION public.get_internal_unread_counts()
RETURNS TABLE(channel_id uuid, unread_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    icm.channel_id,
    COUNT(im.id) AS unread_count
  FROM internal_channel_members icm
  LEFT JOIN internal_messages im 
    ON im.channel_id = icm.channel_id 
    AND im.created_at > icm.last_read_at
    AND im.user_id != auth.uid()
  WHERE icm.user_id = auth.uid()
  GROUP BY icm.channel_id
  HAVING COUNT(im.id) > 0;
$$;

-- RPC to mark a channel as read (update last_read_at)
CREATE OR REPLACE FUNCTION public.mark_channel_read(_channel_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE internal_channel_members
  SET last_read_at = now()
  WHERE user_id = auth.uid() AND channel_id = _channel_id;
END;
$$;
