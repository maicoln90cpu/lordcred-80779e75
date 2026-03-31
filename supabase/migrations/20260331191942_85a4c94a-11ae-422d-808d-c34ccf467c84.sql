-- Tabela cr_relatorio: dados manuais de vendas (colunas A-N da planilha RELATORIO NEW CORBAN)
-- Colunas P-X são calculadas no frontend e NÃO armazenadas aqui
CREATE TABLE public.cr_relatorio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_pago timestamptz,
  num_contrato text,
  produto text,
  banco text,
  prazo integer,
  tabela text,
  valor_liberado numeric DEFAULT 0,
  seguro text DEFAULT 'Não',
  cpf text,
  nome text,
  data_nascimento text,
  telefone text,
  vendedor text,
  id_contrato text,
  batch_id uuid REFERENCES public.import_batches(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.cr_relatorio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Privileged access cr_relatorio" ON public.cr_relatorio
  FOR ALL TO public USING (is_privileged());
