
-- Add internal chat tables to supabase_realtime publication
-- This is required for Realtime postgres_changes to work

DO $$
BEGIN
  -- Add internal_messages if not already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'internal_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_messages;
  END IF;

  -- Add internal_channels if not already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'internal_channels'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_channels;
  END IF;

  -- Add internal_channel_members if not already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'internal_channel_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_channel_members;
  END IF;
END $$;

-- Ensure REPLICA IDENTITY FULL for proper realtime payload
ALTER TABLE public.internal_messages REPLICA IDENTITY FULL;
ALTER TABLE public.internal_channels REPLICA IDENTITY FULL;
