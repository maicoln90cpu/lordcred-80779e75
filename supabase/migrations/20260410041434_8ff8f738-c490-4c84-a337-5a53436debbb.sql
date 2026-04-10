-- Retroactive fix: mark messages as 'read' based on existing Read/Played receipts in webhook_logs
WITH read_receipts AS (
  SELECT 
    w.payload->'event'->'MessageIDs' as message_ids_json,
    c.id as chip_id
  FROM webhook_logs w
  JOIN chips c ON c.instance_name = w.payload->>'instanceName'
  WHERE w.event_type = 'messages_update'
    AND (w.payload->>'state' IN ('Read', 'Played') 
         OR w.payload->'event'->>'Type' IN ('Read', 'Played'))
    AND w.payload->'event'->'MessageIDs' IS NOT NULL
),
expanded AS (
  SELECT chip_id, jsonb_array_elements_text(message_ids_json) as msg_id
  FROM read_receipts
  WHERE jsonb_typeof(message_ids_json) = 'array'
)
UPDATE message_history mh
SET status = 'read'
FROM expanded e
WHERE mh.chip_id = e.chip_id
  AND mh.message_id = e.msg_id
  AND mh.status != 'read';