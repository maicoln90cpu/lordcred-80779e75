
-- 1) Add seller_leads_columns to system_settings
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS seller_leads_columns jsonb DEFAULT NULL;

-- 2) Create SECURITY DEFINER function for sellers to create direct channels
CREATE OR REPLACE FUNCTION public.create_direct_channel(
  _target_user_id uuid,
  _channel_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _channel_id uuid;
  _existing_channel_id uuid;
  _caller_id uuid;
BEGIN
  _caller_id := auth.uid();
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if a direct channel already exists between these two users
  SELECT ic.id INTO _existing_channel_id
  FROM internal_channels ic
  WHERE ic.is_group = false
    AND EXISTS (
      SELECT 1 FROM internal_channel_members m1
      WHERE m1.channel_id = ic.id AND m1.user_id = _caller_id
    )
    AND EXISTS (
      SELECT 1 FROM internal_channel_members m2
      WHERE m2.channel_id = ic.id AND m2.user_id = _target_user_id
    );

  IF _existing_channel_id IS NOT NULL THEN
    RETURN _existing_channel_id;
  END IF;

  -- Create the channel
  INSERT INTO internal_channels (name, is_group, created_by)
  VALUES (_channel_name, false, _caller_id)
  RETURNING id INTO _channel_id;

  -- Add both members
  INSERT INTO internal_channel_members (channel_id, user_id)
  VALUES (_channel_id, _caller_id), (_channel_id, _target_user_id);

  RETURN _channel_id;
END;
$$;
