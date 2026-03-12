
-- Create client_leads table
CREATE TABLE public.client_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  assigned_to uuid NOT NULL,
  batch_name text,
  data_ref text,
  banco_simulado text,
  nome text NOT NULL,
  telefone text,
  cpf text,
  valor_lib numeric,
  prazo integer,
  vlr_parcela numeric,
  status text DEFAULT 'pendente',
  aprovado text,
  reprovado text,
  data_nasc text,
  banco_codigo text,
  banco_nome text,
  agencia text,
  conta text,
  nome_mae text,
  notes text,
  contacted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_leads ENABLE ROW LEVEL SECURITY;

-- Admin can manage all leads
CREATE POLICY "Admins can manage all leads"
  ON public.client_leads FOR ALL
  TO public
  USING (is_admin())
  WITH CHECK (is_admin());

-- Users (admins/non-sellers) can manage leads they created
CREATE POLICY "Users can manage leads they created"
  ON public.client_leads FOR ALL
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Sellers can view leads assigned to them
CREATE POLICY "Sellers can view assigned leads"
  ON public.client_leads FOR SELECT
  TO authenticated
  USING (assigned_to = auth.uid());

-- Sellers can update leads assigned to them (status, notes, contacted_at)
CREATE POLICY "Sellers can update assigned leads"
  ON public.client_leads FOR UPDATE
  TO authenticated
  USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());
