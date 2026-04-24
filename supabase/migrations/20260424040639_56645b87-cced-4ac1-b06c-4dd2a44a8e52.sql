-- Helper RPC: post a system message into a HR notification channel when a candidate submits via public link.
-- Strategy: ensure a single shared group channel "🎯 RH - Notificações" exists with all privileged users as members.
-- The message is authored by the interview's creator (from hr_interview_tokens.created_by) — falls back to first master.

CREATE OR REPLACE FUNCTION public.hr_notify_interview_submitted(
  _candidate_id uuid,
  _stage int,
  _author_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _channel_id uuid;
  _candidate_name text;
  _author uuid;
  _msg text;
BEGIN
  -- Resolve candidate name
  SELECT full_name INTO _candidate_name
  FROM hr_candidates WHERE id = _candidate_id;
  IF _candidate_name IS NULL THEN
    _candidate_name := 'Candidato';
  END IF;

  -- Resolve author: prefer provided, else first master
  _author := _author_id;
  IF _author IS NULL THEN
    SELECT user_id INTO _author FROM user_roles WHERE role = 'master' LIMIT 1;
  END IF;
  IF _author IS NULL THEN
    -- nothing we can do without an author (channel/messages require user_id)
    RETURN;
  END IF;

  -- Find or create the shared HR notifications channel
  SELECT id INTO _channel_id
  FROM internal_channels
  WHERE name = '🎯 RH - Notificações' AND is_group = true
  LIMIT 1;

  IF _channel_id IS NULL THEN
    INSERT INTO internal_channels (name, is_group, created_by, description)
    VALUES ('🎯 RH - Notificações', true, _author, 'Notificações automáticas de entrevistas submetidas via link público')
    RETURNING id INTO _channel_id;
  END IF;

  -- Ensure all privileged users + supports are members (idempotent)
  INSERT INTO internal_channel_members (channel_id, user_id)
  SELECT _channel_id, ur.user_id
  FROM user_roles ur
  WHERE ur.role IN ('master', 'admin', 'manager', 'support')
  ON CONFLICT DO NOTHING;

  -- Compose message
  _msg := '🎯 *Entrevista E' || _stage || ' submetida via link público*' || E'\n' ||
          '👤 Candidato: ' || _candidate_name || E'\n' ||
          '✅ Respostas já estão disponíveis no card do candidato em /admin/hr.';

  -- Post the system message
  INSERT INTO internal_messages (channel_id, user_id, content)
  VALUES (_channel_id, _author, _msg);
END;
$$;

-- Allow the service role / anon (via edge function) to call it
GRANT EXECUTE ON FUNCTION public.hr_notify_interview_submitted(uuid, int, uuid) TO anon, authenticated, service_role;