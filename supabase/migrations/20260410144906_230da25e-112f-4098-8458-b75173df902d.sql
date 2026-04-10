
-- Tabela para credenciais bancárias
CREATE TABLE public.bank_credentials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_name text NOT NULL,
  username text NOT NULL DEFAULT '',
  password text NOT NULL DEFAULT '',
  link text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.bank_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Privileged can manage bank credentials"
  ON public.bank_credentials
  FOR ALL
  TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- Trigger updated_at
CREATE TRIGGER update_bank_credentials_updated_at
  BEFORE UPDATE ON public.bank_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
