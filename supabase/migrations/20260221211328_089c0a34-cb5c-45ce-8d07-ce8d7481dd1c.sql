
-- Add last_sync_cursor to chips for staged sync
ALTER TABLE public.chips ADD COLUMN IF NOT EXISTS last_sync_cursor integer DEFAULT 0;

-- Delete duplicate @lid conversations where a @s.whatsapp.net version exists
DELETE FROM public.conversations c1
WHERE c1.remote_jid LIKE '%@lid'
  AND EXISTS (
    SELECT 1 FROM public.conversations c2
    WHERE c2.chip_id = c1.chip_id
      AND c2.remote_jid LIKE '%@s.whatsapp.net'
      AND c2.remote_jid != c1.remote_jid
      AND c2.contact_phone = c1.contact_phone
      AND c1.contact_phone IS NOT NULL
      AND c1.contact_phone != ''
  );

-- For remaining @lid conversations that have a phone field, update remote_jid to phone@s.whatsapp.net
UPDATE public.conversations
SET remote_jid = contact_phone || '@s.whatsapp.net'
WHERE remote_jid LIKE '%@lid'
  AND contact_phone IS NOT NULL
  AND contact_phone != ''
  AND contact_phone ~ '^\d+$';
