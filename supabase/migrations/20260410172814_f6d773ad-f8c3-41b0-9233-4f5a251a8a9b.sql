
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS reuniao_marcada text,
  ADD COLUMN IF NOT EXISTS reuniao text,
  ADD COLUMN IF NOT EXISTS enviou_link boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS aceitou text,
  ADD COLUMN IF NOT EXISTS info_mei text,
  ADD COLUMN IF NOT EXISTS criou_mei text,
  ADD COLUMN IF NOT EXISTS captacao_parceiro text;
