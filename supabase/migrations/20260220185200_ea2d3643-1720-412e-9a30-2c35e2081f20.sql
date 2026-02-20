
-- Create message_favorites table for local favoriting (UazAPI doesn't support this)
CREATE TABLE public.message_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  chip_id UUID NOT NULL REFERENCES public.chips(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  remote_jid TEXT NOT NULL,
  message_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint to prevent duplicates
ALTER TABLE public.message_favorites ADD CONSTRAINT unique_user_message UNIQUE (user_id, message_id);

-- Enable RLS
ALTER TABLE public.message_favorites ENABLE ROW LEVEL SECURITY;

-- Users can view their own favorites
CREATE POLICY "Users can view their own favorites"
ON public.message_favorites FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own favorites
CREATE POLICY "Users can insert their own favorites"
ON public.message_favorites FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own favorites
CREATE POLICY "Users can delete their own favorites"
ON public.message_favorites FOR DELETE
USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_message_favorites_user ON public.message_favorites(user_id);
CREATE INDEX idx_message_favorites_message ON public.message_favorites(message_id);
