
-- Add new columns to conversations for local management
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_starred boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_status text DEFAULT NULL;

-- Create conversation_notes table
CREATE TABLE IF NOT EXISTS public.conversation_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chip_id uuid NOT NULL REFERENCES public.chips(id) ON DELETE CASCADE,
  remote_jid text NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.conversation_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their conversation notes"
  ON public.conversation_notes FOR ALL
  USING (chip_id IN (SELECT id FROM chips WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all conversation notes"
  ON public.conversation_notes FOR ALL
  USING (is_admin());
