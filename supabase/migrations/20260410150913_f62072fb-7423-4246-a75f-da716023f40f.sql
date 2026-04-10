
-- Partners table
CREATE TABLE public.partners (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  -- Pipeline
  data_contato date,
  captacao_tipo text,
  indicado_por text,

  -- Pessoais
  nome text NOT NULL,
  nacionalidade text DEFAULT 'Brasileira',
  estado_civil text,
  cpf text,
  endereco text,
  telefone text,
  email text,
  idade integer,

  -- PJ
  cnpj text,
  razao_social text,
  endereco_pj text,
  pix_pj text,

  -- Status
  pipeline_status text NOT NULL DEFAULT 'contato_inicial',
  contrato_status text DEFAULT 'pendente',
  treinamento_status text DEFAULT 'pendente',

  -- Contrato / ClickSign
  envelope_id text,
  contrato_url text,
  contrato_signed_url text,
  contrato_assinado_em timestamp with time zone,

  -- Config contrato
  dia_pagamento integer DEFAULT 7,
  vigencia_meses integer DEFAULT 12,
  aviso_previo_dias integer DEFAULT 7,

  -- Obs
  obs text
);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Privileged can manage partners"
  ON public.partners FOR ALL
  TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

CREATE TRIGGER update_partners_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Partner history table
CREATE TABLE public.partner_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  action text NOT NULL,
  details jsonb,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Privileged can manage partner history"
  ON public.partner_history FOR ALL
  TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));
