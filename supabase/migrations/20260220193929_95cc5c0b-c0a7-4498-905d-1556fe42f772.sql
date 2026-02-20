
-- Clean up duplicate conversations: keep only the most recent per (chip_id, remote_jid)
DELETE FROM conversations 
WHERE id NOT IN (
  SELECT DISTINCT ON (chip_id, remote_jid) id 
  FROM conversations 
  ORDER BY chip_id, remote_jid, last_message_at DESC NULLS LAST
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE conversations 
ADD CONSTRAINT conversations_chip_remote_unique 
UNIQUE (chip_id, remote_jid);
