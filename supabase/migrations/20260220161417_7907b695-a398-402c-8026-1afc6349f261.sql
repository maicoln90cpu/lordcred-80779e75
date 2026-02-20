-- Drop existing foreign keys and recreate with CASCADE
ALTER TABLE public.chip_lifecycle_logs 
  DROP CONSTRAINT IF EXISTS chip_lifecycle_logs_chip_id_fkey,
  ADD CONSTRAINT chip_lifecycle_logs_chip_id_fkey 
    FOREIGN KEY (chip_id) REFERENCES public.chips(id) ON DELETE CASCADE;

ALTER TABLE public.conversations 
  DROP CONSTRAINT IF EXISTS conversations_chip_id_fkey,
  ADD CONSTRAINT conversations_chip_id_fkey 
    FOREIGN KEY (chip_id) REFERENCES public.chips(id) ON DELETE CASCADE;

ALTER TABLE public.message_history 
  DROP CONSTRAINT IF EXISTS message_history_chip_id_fkey,
  ADD CONSTRAINT message_history_chip_id_fkey 
    FOREIGN KEY (chip_id) REFERENCES public.chips(id) ON DELETE CASCADE;

ALTER TABLE public.message_queue 
  DROP CONSTRAINT IF EXISTS message_queue_chip_id_fkey,
  ADD CONSTRAINT message_queue_chip_id_fkey 
    FOREIGN KEY (chip_id) REFERENCES public.chips(id) ON DELETE CASCADE;