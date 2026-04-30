-- 1) Adicionar colunas de progresso e modo
ALTER TABLE public.v8_contact_pool_imports
  ADD COLUMN IF NOT EXISTS processed_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_percent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'frontend';

-- 2) Aumentar limite do bucket para 100 MB
UPDATE storage.buckets
   SET file_size_limit = 104857600
 WHERE id = 'v8-contact-pool';

-- 3) Habilitar Realtime na tabela de imports (para progress bar live)
ALTER TABLE public.v8_contact_pool_imports REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'v8_contact_pool_imports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.v8_contact_pool_imports;
  END IF;
END $$;