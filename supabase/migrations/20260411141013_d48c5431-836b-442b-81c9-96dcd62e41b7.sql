-- Add updated_at column
ALTER TABLE public.corban_propostas_snapshot
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add unique constraint on proposta_id for upsert deduplication
-- First remove duplicates keeping the latest one
DELETE FROM public.corban_propostas_snapshot a
USING public.corban_propostas_snapshot b
WHERE a.proposta_id IS NOT NULL
  AND a.proposta_id = b.proposta_id
  AND a.snapshot_date < b.snapshot_date;

ALTER TABLE public.corban_propostas_snapshot
ADD CONSTRAINT corban_propostas_snapshot_proposta_id_key UNIQUE (proposta_id);

-- Drop the cleanup function (data is now permanent)
DROP FUNCTION IF EXISTS public.cleanup_old_corban_snapshots();

-- Add UPDATE policy for privileged users
CREATE POLICY "Privileged can update snapshots"
ON public.corban_propostas_snapshot
FOR UPDATE
TO authenticated
USING (is_privileged(auth.uid()))
WITH CHECK (is_privileged(auth.uid()));

-- Add service-level INSERT and UPDATE for the cron edge function
CREATE POLICY "Service can upsert snapshots"
ON public.corban_propostas_snapshot
FOR ALL
TO public
USING (true)
WITH CHECK (true);