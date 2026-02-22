
-- Trigger function: auto-update conversations.last_message_text on message_history INSERT
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Skip if message_content is empty or EMPTY
  IF NEW.message_content IS NULL OR NEW.message_content = '' OR NEW.message_content = 'EMPTY' THEN
    RETURN NEW;
  END IF;

  -- Skip if no remote_jid
  IF NEW.remote_jid IS NULL OR NEW.remote_jid = '' THEN
    RETURN NEW;
  END IF;

  -- Update the conversation's last_message_text and last_message_at
  UPDATE conversations
  SET
    last_message_text = NEW.message_content,
    last_message_at = NEW.created_at,
    updated_at = now()
  WHERE chip_id = NEW.chip_id AND remote_jid = NEW.remote_jid;

  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER trg_update_conversation_last_message
  AFTER INSERT ON public.message_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_last_message();

-- Backfill: populate last_message_text for existing conversations
UPDATE conversations c SET
  last_message_text = sub.message_content,
  last_message_at = sub.created_at,
  updated_at = now()
FROM (
  SELECT DISTINCT ON (chip_id, remote_jid)
    chip_id, remote_jid, message_content, created_at
  FROM message_history
  WHERE message_content IS NOT NULL AND message_content != '' AND message_content != 'EMPTY'
    AND remote_jid IS NOT NULL AND remote_jid != ''
  ORDER BY chip_id, remote_jid, created_at DESC
) sub
WHERE c.chip_id = sub.chip_id AND c.remote_jid = sub.remote_jid
  AND (c.last_message_text IS NULL OR c.last_message_text = '');
