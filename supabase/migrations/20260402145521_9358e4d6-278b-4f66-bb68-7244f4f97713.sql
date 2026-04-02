-- Add health_fail_count to chips for 3-strikes tolerance
ALTER TABLE public.chips
ADD COLUMN IF NOT EXISTS health_fail_count integer NOT NULL DEFAULT 0;