ALTER TABLE public.chips DROP CONSTRAINT chips_slot_number_check;
ALTER TABLE public.chips ADD CONSTRAINT chips_slot_number_check CHECK (slot_number >= 1 AND slot_number <= 105);