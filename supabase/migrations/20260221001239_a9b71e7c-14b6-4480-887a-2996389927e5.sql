
-- Clean up duplicate message_ids before creating unique index
DELETE FROM public.message_history
WHERE id NOT IN (
  SELECT DISTINCT ON (chip_id, message_id) id
  FROM public.message_history
  WHERE message_id IS NOT NULL
  ORDER BY chip_id, message_id, created_at DESC
)
AND message_id IS NOT NULL;

-- Now create the unique partial index for deduplication during sync
CREATE UNIQUE INDEX IF NOT EXISTS idx_message_history_chip_msgid 
  ON public.message_history(chip_id, message_id) 
  WHERE message_id IS NOT NULL;
