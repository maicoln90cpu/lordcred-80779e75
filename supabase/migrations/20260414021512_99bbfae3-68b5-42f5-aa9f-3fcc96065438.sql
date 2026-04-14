-- Add shared chip fields
ALTER TABLE public.chips
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shared_user_ids UUID[] DEFAULT '{}';

-- Add conversation assignment
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add audit field to message_history
ALTER TABLE public.message_history
  ADD COLUMN IF NOT EXISTS sent_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for fast lookups on shared chips
CREATE INDEX IF NOT EXISTS idx_chips_shared ON public.chips (is_shared) WHERE is_shared = true;

-- Index for conversation assignment
CREATE INDEX IF NOT EXISTS idx_conversations_assigned ON public.conversations (assigned_user_id) WHERE assigned_user_id IS NOT NULL;

-- Index for audit queries
CREATE INDEX IF NOT EXISTS idx_message_history_sent_by ON public.message_history (sent_by_user_id) WHERE sent_by_user_id IS NOT NULL;