
-- Item 6: Internal chat group management
ALTER TABLE internal_channels ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE internal_channels ADD COLUMN IF NOT EXISTS admin_only_messages BOOLEAN DEFAULT false;

-- Item 9: Templates per specific user
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS visible_to UUID;

-- Item 10: User avatar
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
