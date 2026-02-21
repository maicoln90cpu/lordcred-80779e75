-- Drop the partial index that doesn't work with upsert
DROP INDEX IF EXISTS idx_message_history_chip_msgid;

-- Create a real UNIQUE constraint for upsert onConflict
ALTER TABLE public.message_history 
  ADD CONSTRAINT message_history_chip_message_unique 
  UNIQUE (chip_id, message_id);

-- Unarchive all conversations that were erroneously archived
UPDATE public.conversations SET is_archived = false WHERE is_archived = true;