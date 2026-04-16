ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS endereco_rep_rua text,
  ADD COLUMN IF NOT EXISTS endereco_rep_numero text,
  ADD COLUMN IF NOT EXISTS endereco_rep_complemento text,
  ADD COLUMN IF NOT EXISTS endereco_rep_bairro text,
  ADD COLUMN IF NOT EXISTS endereco_rep_municipio text,
  ADD COLUMN IF NOT EXISTS endereco_rep_uf text,
  ADD COLUMN IF NOT EXISTS endereco_rep_cep text;