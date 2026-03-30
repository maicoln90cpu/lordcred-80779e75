
-- =============================================
-- ETAPA 1: Tabelas para Relatórios Comissões
-- =============================================

-- Tabela compartilhada de lotes de importação
CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL CHECK (module IN ('parceiros', 'relatorios')),
  sheet_name text NOT NULL,
  file_name text NOT NULL,
  row_count integer NOT NULL DEFAULT 0,
  imported_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted'))
);

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Privileged access import_batches" ON public.import_batches FOR ALL USING (is_privileged());

-- Adicionar batch_id em commission_sales (backward compat)
ALTER TABLE public.commission_sales ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.import_batches(id) ON DELETE SET NULL;

-- cr_geral: dados importados do New Corban (produção)
CREATE TABLE public.cr_geral (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES public.import_batches(id) ON DELETE CASCADE,
  data_pgt_cliente timestamptz,
  data_digitacao timestamptz,
  ade text,
  cod_contrato text,
  cpf text,
  idade text,
  nome_cliente text,
  convenio text,
  pmts text,
  prazo integer,
  prod_liq numeric DEFAULT 0,
  pct_cms numeric DEFAULT 0,
  prod_bruta numeric DEFAULT 0,
  pct_cms_bruta numeric DEFAULT 0,
  tipo_operacao text,
  banco text,
  cms_rep numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cr_geral ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Privileged access cr_geral" ON public.cr_geral FOR ALL USING (is_privileged());

-- cr_repasse: dados de repasse
CREATE TABLE public.cr_repasse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES public.import_batches(id) ON DELETE CASCADE,
  data_pgt_cliente timestamptz,
  data_digitacao timestamptz,
  ade text,
  cod_contrato text,
  cpf text,
  idade text,
  nome_cliente text,
  convenio text,
  pmts text,
  prazo integer,
  prod_liq numeric DEFAULT 0,
  pct_cms numeric DEFAULT 0,
  prod_bruta numeric DEFAULT 0,
  pct_cms_bruta numeric DEFAULT 0,
  tipo_operacao text,
  banco text,
  pct_rateio numeric DEFAULT 0,
  pct_rateio_fixo numeric DEFAULT 0,
  cms_rep_favorecido numeric DEFAULT 0,
  favorecido text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cr_repasse ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Privileged access cr_repasse" ON public.cr_repasse FOR ALL USING (is_privileged());

-- cr_seguros: dados de seguros prestamistas
CREATE TABLE public.cr_seguros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES public.import_batches(id) ON DELETE CASCADE,
  id_seguro text,
  data_registro timestamptz,
  descricao text,
  tipo_comissao text,
  valor_comissao numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cr_seguros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Privileged access cr_seguros" ON public.cr_seguros FOR ALL USING (is_privileged());

-- cr_rules_fgts: regras de comissão FGTS dedicadas ao módulo relatórios
CREATE TABLE public.cr_rules_fgts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_vigencia date NOT NULL,
  banco text NOT NULL,
  tabela_chave text NOT NULL DEFAULT '*',
  seguro text NOT NULL DEFAULT 'Ambos' CHECK (seguro IN ('Sim', 'Não', 'Ambos')),
  min_valor numeric NOT NULL DEFAULT 0,
  max_valor numeric NOT NULL DEFAULT 999999999,
  taxa numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cr_rules_fgts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Privileged access cr_rules_fgts" ON public.cr_rules_fgts FOR ALL USING (is_privileged());

-- cr_rules_clt: regras de comissão CLT dedicadas ao módulo relatórios
CREATE TABLE public.cr_rules_clt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_vigencia date NOT NULL,
  banco text NOT NULL,
  tabela_chave text NOT NULL DEFAULT '*',
  seguro text NOT NULL DEFAULT 'Ambos' CHECK (seguro IN ('Sim', 'Não', 'Ambos')),
  prazo_min integer NOT NULL DEFAULT 0,
  prazo_max integer NOT NULL DEFAULT 999,
  taxa numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cr_rules_clt ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Privileged access cr_rules_clt" ON public.cr_rules_clt FOR ALL USING (is_privileged());

-- cr_historico_gestao: snapshots resumidos de fechamentos
CREATE TABLE public.cr_historico_gestao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  data_inicio date,
  data_fim date,
  qtd_propostas integer DEFAULT 0,
  valor_liberado numeric DEFAULT 0,
  comissao_esperada numeric DEFAULT 0,
  comissao_recebida numeric DEFAULT 0,
  diferenca numeric DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cr_historico_gestao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Privileged access cr_historico_gestao" ON public.cr_historico_gestao FOR ALL USING (is_privileged());

-- cr_historico_detalhado: snapshots detalhados (linha a linha)
CREATE TABLE public.cr_historico_detalhado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gestao_id uuid NOT NULL REFERENCES public.cr_historico_gestao(id) ON DELETE CASCADE,
  data_pago timestamptz,
  num_contrato text,
  nome text,
  banco text,
  produto text,
  valor_liberado numeric DEFAULT 0,
  valor_assegurado numeric,
  comissao_esperada numeric DEFAULT 0,
  comissao_recebida numeric DEFAULT 0,
  diferenca numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cr_historico_detalhado ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Privileged access cr_historico_detalhado" ON public.cr_historico_detalhado FOR ALL USING (is_privileged());

-- Adicionar campos de bônus em commission_settings
ALTER TABLE public.commission_settings 
  ADD COLUMN IF NOT EXISTS bonus_threshold numeric,
  ADD COLUMN IF NOT EXISTS bonus_rate numeric NOT NULL DEFAULT 0;

-- Feature permission para o novo módulo
INSERT INTO public.feature_permissions (feature_key, feature_label, feature_group, allowed_roles)
VALUES ('commission_reports', 'Relat. Comissões', 'equipe', ARRAY['support', 'manager'])
ON CONFLICT DO NOTHING;
