-- 1. Adicionar colunas de soft-delete
ALTER TABLE public.import_batches
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID,
  ADD COLUMN IF NOT EXISTS deleted_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_import_batches_deleted_at ON public.import_batches(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_import_batches_module_active ON public.import_batches(module, created_at DESC) WHERE deleted_at IS NULL;

-- 2. Função de soft-delete com auditoria
CREATE OR REPLACE FUNCTION public.soft_delete_import_batch(
  _batch_id UUID,
  _reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _batch RECORD;
  _user_email TEXT;
BEGIN
  IF NOT public.is_privileged() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem excluir lotes';
  END IF;

  SELECT * INTO _batch FROM public.import_batches WHERE id = _batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote não encontrado';
  END IF;

  IF _batch.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Lote já foi excluído em %', _batch.deleted_at;
  END IF;

  UPDATE public.import_batches
  SET deleted_at = NOW(), deleted_by = auth.uid(), deleted_reason = _reason
  WHERE id = _batch_id;

  SELECT email INTO _user_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.audit_logs (user_id, user_email, action, target_table, target_id, details)
  VALUES (
    auth.uid(), _user_email, 'soft_delete_import_batch', 'import_batches', _batch_id,
    jsonb_build_object(
      'module', _batch.module,
      'file_name', _batch.file_name,
      'sheet_name', _batch.sheet_name,
      'row_count', _batch.row_count,
      'reason', _reason
    )
  );

  RETURN jsonb_build_object('success', true, 'batch_id', _batch_id, 'deleted_at', NOW());
END;
$$;

-- 3. Função de restauração
CREATE OR REPLACE FUNCTION public.restore_import_batch(_batch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _batch RECORD;
  _user_email TEXT;
BEGIN
  IF NOT public.is_privileged() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem restaurar lotes';
  END IF;

  SELECT * INTO _batch FROM public.import_batches WHERE id = _batch_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote não encontrado';
  END IF;

  IF _batch.deleted_at IS NULL THEN
    RAISE EXCEPTION 'Lote não está excluído';
  END IF;

  UPDATE public.import_batches
  SET deleted_at = NULL, deleted_by = NULL, deleted_reason = NULL
  WHERE id = _batch_id;

  SELECT email INTO _user_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.audit_logs (user_id, user_email, action, target_table, target_id, details)
  VALUES (
    auth.uid(), _user_email, 'restore_import_batch', 'import_batches', _batch_id,
    jsonb_build_object('module', _batch.module, 'file_name', _batch.file_name, 'row_count', _batch.row_count)
  );

  RETURN jsonb_build_object('success', true, 'batch_id', _batch_id);
END;
$$;

-- 4. Função para limpar lotes soft-deletados há mais de 30 dias (purge)
CREATE OR REPLACE FUNCTION public.purge_old_deleted_batches()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count INTEGER;
BEGIN
  DELETE FROM public.import_batches
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;