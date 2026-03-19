-- 1. Array de visibilidade para templates
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS visible_to_list uuid[] DEFAULT '{}';
UPDATE message_templates SET visible_to_list = ARRAY[visible_to] WHERE visible_to IS NOT NULL AND (visible_to_list IS NULL OR visible_to_list = '{}');

-- 2. Permissões de config de grupo no chat interno
ALTER TABLE internal_channels ADD COLUMN IF NOT EXISTS config_allowed_users uuid[] DEFAULT '{}';

-- 3. Responsável pelo suporte no chat
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS support_chat_user_id uuid;