
-- Migrate shortcuts data to templates
INSERT INTO message_templates (trigger_word, content, title, category, media_url, media_type, media_filename, created_by, is_active)
SELECT 
  s.trigger_word,
  CASE WHEN s.response_text = '' OR s.response_text IS NULL THEN '(mídia)' ELSE s.response_text END,
  'Atalho: ' || s.trigger_word,
  'atalho',
  s.media_url,
  s.media_type,
  s.media_filename,
  s.user_id,
  s.is_active
FROM message_shortcuts s
WHERE NOT EXISTS (
  SELECT 1 FROM message_templates mt WHERE mt.trigger_word = s.trigger_word AND mt.created_by = s.user_id
);
