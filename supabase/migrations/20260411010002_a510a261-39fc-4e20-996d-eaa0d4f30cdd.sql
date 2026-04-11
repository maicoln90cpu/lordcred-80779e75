
-- Table for Corban proposal snapshots
CREATE TABLE public.corban_propostas_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date timestamptz NOT NULL DEFAULT now(),
  proposta_id text,
  cpf text,
  nome text,
  banco text,
  produto text,
  status text,
  valor_liberado numeric,
  valor_parcela numeric,
  prazo text,
  vendedor_nome text,
  data_cadastro text,
  convenio text,
  raw_data jsonb,
  created_by uuid REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_corban_snapshot_date ON public.corban_propostas_snapshot(snapshot_date);
CREATE INDEX idx_corban_snapshot_status ON public.corban_propostas_snapshot(status);
CREATE INDEX idx_corban_snapshot_banco ON public.corban_propostas_snapshot(banco);

-- RLS
ALTER TABLE public.corban_propostas_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view snapshots"
  ON public.corban_propostas_snapshot FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Privileged can insert snapshots"
  ON public.corban_propostas_snapshot FOR INSERT
  TO authenticated
  WITH CHECK (public.is_privileged(auth.uid()));

CREATE POLICY "Privileged can delete snapshots"
  ON public.corban_propostas_snapshot FOR DELETE
  TO authenticated
  USING (public.is_privileged(auth.uid()));

-- Cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_old_corban_snapshots()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.corban_propostas_snapshot
  WHERE snapshot_date < now() - interval '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE LOG 'cleanup_old_corban_snapshots: removed % rows', deleted_count;
END;
$$;
