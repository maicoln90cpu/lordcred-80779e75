
-- Add round-robin columns to chips
ALTER TABLE public.chips
  ADD COLUMN IF NOT EXISTS round_robin_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS round_robin_timeout_minutes integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS round_robin_last_index integer NOT NULL DEFAULT 0;

-- Add assigned_at to conversations for timeout tracking
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

-- Update assigned_at automatically when assigned_user_id changes
CREATE OR REPLACE FUNCTION public.update_assigned_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_user_id IS DISTINCT FROM OLD.assigned_user_id THEN
    IF NEW.assigned_user_id IS NOT NULL THEN
      NEW.assigned_at = now();
    ELSE
      NEW.assigned_at = NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_assigned_at ON public.conversations;
CREATE TRIGGER trg_update_assigned_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_assigned_at();

-- Round-robin assignment function
CREATE OR REPLACE FUNCTION public.round_robin_assign_conversations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chip_rec RECORD;
  conv_rec RECORD;
  user_ids text[];
  user_count int;
  next_idx int;
  target_user uuid;
BEGIN
  -- Process each shared chip with round-robin enabled
  FOR chip_rec IN
    SELECT id, shared_user_ids, round_robin_last_index, round_robin_timeout_minutes
    FROM chips
    WHERE is_shared = true
      AND round_robin_enabled = true
      AND shared_user_ids IS NOT NULL
      AND array_length(shared_user_ids, 1) > 0
  LOOP
    user_ids := chip_rec.shared_user_ids;
    user_count := array_length(user_ids, 1);
    next_idx := chip_rec.round_robin_last_index;

    -- 1) Assign unassigned conversations (new messages)
    FOR conv_rec IN
      SELECT id FROM conversations
      WHERE chip_id = chip_rec.id
        AND closed_at IS NULL
        AND assigned_user_id IS NULL
        AND last_message_at > (now() - interval '24 hours')
      ORDER BY last_message_at ASC
    LOOP
      next_idx := (next_idx % user_count) + 1;
      target_user := user_ids[next_idx]::uuid;

      UPDATE conversations
      SET assigned_user_id = target_user
      WHERE id = conv_rec.id;

      -- Audit log
      INSERT INTO conversation_audit_log (conversation_id, user_id, action, message_preview)
      VALUES (conv_rec.id, target_user, 'auto_assign', 'Round-robin: atribuição automática');
    END LOOP;

    -- 2) Reassign timed-out conversations (seller didn't respond)
    FOR conv_rec IN
      SELECT c.id, c.assigned_user_id FROM conversations c
      WHERE c.chip_id = chip_rec.id
        AND c.closed_at IS NULL
        AND c.assigned_user_id IS NOT NULL
        AND c.assigned_at IS NOT NULL
        AND c.assigned_at < (now() - (chip_rec.round_robin_timeout_minutes || ' minutes')::interval)
        -- Only reassign if there's no outgoing message after assignment
        AND NOT EXISTS (
          SELECT 1 FROM message_history mh
          WHERE mh.chip_id = chip_rec.id
            AND mh.remote_jid = c.remote_jid
            AND mh.direction = 'outgoing'
            AND mh.created_at > c.assigned_at
        )
      ORDER BY c.assigned_at ASC
    LOOP
      next_idx := (next_idx % user_count) + 1;
      target_user := user_ids[next_idx]::uuid;

      -- Skip if same user
      IF target_user = conv_rec.assigned_user_id::text::uuid THEN
        next_idx := (next_idx % user_count) + 1;
        target_user := user_ids[next_idx]::uuid;
      END IF;

      UPDATE conversations
      SET assigned_user_id = target_user
      WHERE id = conv_rec.id;

      INSERT INTO conversation_audit_log (conversation_id, user_id, action, message_preview, details)
      VALUES (conv_rec.id, target_user, 'auto_reassign',
        'Round-robin: reatribuído por timeout',
        jsonb_build_object('previous_user', conv_rec.assigned_user_id, 'timeout_minutes', chip_rec.round_robin_timeout_minutes));
    END LOOP;

    -- Update last index
    UPDATE chips SET round_robin_last_index = next_idx WHERE id = chip_rec.id;
  END LOOP;
END;
$$;
