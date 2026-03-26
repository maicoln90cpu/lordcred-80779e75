ALTER TABLE public.client_leads 
  ADD COLUMN IF NOT EXISTS corban_proposta_id text,
  ADD COLUMN IF NOT EXISTS corban_status text;

CREATE INDEX IF NOT EXISTS idx_client_leads_corban_proposta_id 
  ON public.client_leads (corban_proposta_id) 
  WHERE corban_proposta_id IS NOT NULL;