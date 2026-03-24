
CREATE OR REPLACE FUNCTION public.update_channel_info(
  _channel_id uuid,
  _name text DEFAULT NULL,
  _description text DEFAULT NULL,
  _avatar_url text DEFAULT NULL,
  _admin_only boolean DEFAULT NULL,
  _config_allowed uuid[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check permission: master, admin, support, or config_allowed_users
  IF NOT (
    has_role(auth.uid(), 'master') OR 
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'support') OR
    EXISTS (
      SELECT 1 FROM internal_channels 
      WHERE id = _channel_id 
      AND config_allowed_users @> ARRAY[auth.uid()]
    )
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE internal_channels SET
    name = COALESCE(_name, name),
    description = COALESCE(_description, description),
    avatar_url = COALESCE(_avatar_url, avatar_url),
    admin_only_messages = COALESCE(_admin_only, admin_only_messages),
    config_allowed_users = COALESCE(_config_allowed, config_allowed_users),
    updated_at = now()
  WHERE id = _channel_id;
END;
$$;
