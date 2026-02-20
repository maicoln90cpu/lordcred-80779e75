ALTER TABLE public.message_history DROP CONSTRAINT IF EXISTS message_history_direction_check;
ALTER TABLE public.message_history ADD CONSTRAINT message_history_direction_check 
  CHECK (direction = ANY (ARRAY['sent', 'received', 'outgoing', 'incoming']));