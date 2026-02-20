-- Create external_numbers table for warming to external phones
CREATE TABLE public.external_numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.external_numbers ENABLE ROW LEVEL SECURITY;

-- Only admins can manage external numbers
CREATE POLICY "Admins can manage external numbers"
ON public.external_numbers
FOR ALL
USING (is_admin());

-- Authenticated users can read external numbers
CREATE POLICY "Authenticated users can read external numbers"
ON public.external_numbers
FOR SELECT
USING (true);