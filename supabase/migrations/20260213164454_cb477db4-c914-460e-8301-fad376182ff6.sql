
-- Add seller to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'seller';

-- Add created_by column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_by uuid;

-- Add columns to message_history for chat functionality
ALTER TABLE public.message_history 
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_mimetype text,
  ADD COLUMN IF NOT EXISTS media_filename text,
  ADD COLUMN IF NOT EXISTS remote_jid text,
  ADD COLUMN IF NOT EXISTS message_id text,
  ADD COLUMN IF NOT EXISTS sender_name text;

-- Create conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chip_id uuid NOT NULL REFERENCES public.chips(id) ON DELETE CASCADE,
  remote_jid text NOT NULL,
  contact_name text,
  contact_phone text,
  last_message_text text,
  last_message_at timestamptz,
  unread_count integer DEFAULT 0,
  is_group boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(chip_id, remote_jid)
);

-- Enable RLS on conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view conversations of their own chips
CREATE POLICY "Users can view their chip conversations"
  ON public.conversations FOR SELECT
  USING (chip_id IN (SELECT id FROM public.chips WHERE user_id = auth.uid()));

-- RLS: Users can manage conversations of their own chips
CREATE POLICY "Users can manage their chip conversations"
  ON public.conversations FOR ALL
  USING (chip_id IN (SELECT id FROM public.chips WHERE user_id = auth.uid()));

-- RLS: Admins can view all conversations
CREATE POLICY "Admins can view all conversations"
  ON public.conversations FOR SELECT
  USING (public.is_admin());

-- RLS: Admins can manage all conversations
CREATE POLICY "Admins can manage all conversations"
  ON public.conversations FOR ALL
  USING (public.is_admin());

-- Enable realtime for conversations
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- Trigger for updated_at
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
