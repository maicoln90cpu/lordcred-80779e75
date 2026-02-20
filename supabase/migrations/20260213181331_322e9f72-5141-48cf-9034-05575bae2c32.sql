
-- Create chip_lifecycle_logs table
CREATE TABLE public.chip_lifecycle_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chip_id UUID REFERENCES public.chips(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chip_lifecycle_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can view all lifecycle logs"
ON public.chip_lifecycle_logs
FOR SELECT
USING (public.is_admin());

CREATE POLICY "Users can view their chip lifecycle logs"
ON public.chip_lifecycle_logs
FOR SELECT
USING (chip_id IN (SELECT id FROM public.chips WHERE user_id = auth.uid()));

CREATE POLICY "Service can insert lifecycle logs"
ON public.chip_lifecycle_logs
FOR INSERT
WITH CHECK (true);

-- Add last_connection_attempt column to chips
ALTER TABLE public.chips ADD COLUMN last_connection_attempt TIMESTAMP WITH TIME ZONE;

-- Enable realtime for lifecycle logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.chip_lifecycle_logs;
