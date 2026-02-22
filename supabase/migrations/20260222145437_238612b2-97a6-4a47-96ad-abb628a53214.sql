UPDATE conversations c SET
  last_message_text = sub.message_content,
  last_message_at = sub.created_at,
  updated_at = now()
FROM (
  SELECT DISTINCT ON (chip_id, remote_jid)
    chip_id, remote_jid, message_content, created_at
  FROM message_history
  WHERE message_content IS NOT NULL
    AND message_content != ''
    AND message_content != 'EMPTY'
    AND remote_jid IS NOT NULL
  ORDER BY chip_id, remote_jid, created_at DESC
) sub
WHERE c.chip_id = sub.chip_id
  AND c.remote_jid = sub.remote_jid
  AND (c.last_message_text IS NULL OR c.last_message_text = '');