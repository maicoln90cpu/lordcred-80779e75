ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS endereco_pj_rua text,
  ADD COLUMN IF NOT EXISTS endereco_pj_numero text,
  ADD COLUMN IF NOT EXISTS endereco_pj_bairro text,
  ADD COLUMN IF NOT EXISTS endereco_pj_municipio text,
  ADD COLUMN IF NOT EXISTS endereco_pj_uf text,
  ADD COLUMN IF NOT EXISTS endereco_pj_cep text;