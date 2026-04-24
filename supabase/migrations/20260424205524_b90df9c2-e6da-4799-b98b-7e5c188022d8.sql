-- Etapa 2: destravar webhooks V8 para CPFs órfãos (criados direto na V8)

-- 1. Relaxar NOT NULL para permitir órfãos
ALTER TABLE public.v8_simulations ALTER COLUMN batch_id DROP NOT NULL;
ALTER TABLE public.v8_simulations ALTER COLUMN created_by DROP NOT NULL;

-- 2. Coluna is_orphan
ALTER TABLE public.v8_simulations
  ADD COLUMN IF NOT EXISTS is_orphan boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_v8_simulations_is_orphan ON public.v8_simulations(is_orphan);

-- 3. Constraint de proteção: linhas não-órfãs continuam exigindo batch_id + created_by
-- (impede regressão silenciosa do simulador)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'v8_sim_owner_or_orphan'
  ) THEN
    ALTER TABLE public.v8_simulations
      ADD CONSTRAINT v8_sim_owner_or_orphan
      CHECK (is_orphan = true OR (batch_id IS NOT NULL AND created_by IS NOT NULL));
  END IF;
END $$;

-- 4. RLS: privileged (master/admin/manager) podem ver órfãos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='v8_simulations' AND policyname='Privileged can view orphan simulations'
  ) THEN
    CREATE POLICY "Privileged can view orphan simulations"
      ON public.v8_simulations FOR SELECT
      USING (is_orphan = true AND public.is_privileged(auth.uid()));
  END IF;
END $$;