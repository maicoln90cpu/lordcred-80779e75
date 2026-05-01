
-- 1) Trigger para atualizar assigned_at quando assigned_user_id muda
CREATE OR REPLACE FUNCTION public.update_assigned_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_user_id IS DISTINCT FROM OLD.assigned_user_id THEN
    IF NEW.assigned_user_id IS NOT NULL THEN
      NEW.assigned_at := now();
    ELSE
      NEW.assigned_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_assigned_at ON conversations;
CREATE TRIGGER trg_update_assigned_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_assigned_at();

-- 2) Helper: verifica se o user pode ver a conversa de um chip compartilhado
-- Retorna true se: conversa não atribuída (vendedor pode "assumir") OU atribuída a ele
CREATE OR REPLACE FUNCTION public.can_view_shared_conversation(_user_id uuid, _conv_assigned_user_id uuid, _chip_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chips
    WHERE id = _chip_id
      AND is_shared = true
      AND shared_user_ids::text[] @> ARRAY[_user_id::text]
  )
  AND (
    _conv_assigned_user_id IS NULL
    OR _conv_assigned_user_id = _user_id
  )
$$;

-- 3) Drop old shared policies on conversations
DROP POLICY IF EXISTS "Shared users can view shared chip conversations" ON conversations;
DROP POLICY IF EXISTS "Shared users can manage shared chip conversations" ON conversations;

-- 4) New exclusive policies on conversations
CREATE POLICY "Shared users can view assigned conversations"
  ON conversations FOR SELECT TO authenticated
  USING (
    public.can_view_shared_conversation(auth.uid(), assigned_user_id, chip_id)
  );

CREATE POLICY "Shared users can update assigned conversations"
  ON conversations FOR UPDATE TO authenticated
  USING (
    public.can_view_shared_conversation(auth.uid(), assigned_user_id, chip_id)
  )
  WITH CHECK (
    public.can_view_shared_conversation(auth.uid(), assigned_user_id, chip_id)
  );

-- 5) Drop old shared policy on message_history
DROP POLICY IF EXISTS "Shared users can view shared chip messages" ON message_history;

-- 6) New exclusive policy on message_history
CREATE POLICY "Shared users can view assigned conversation messages"
  ON message_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.chip_id = message_history.chip_id
        AND c.remote_jid = message_history.remote_jid
        AND public.can_view_shared_conversation(auth.uid(), c.assigned_user_id, c.chip_id)
    )
  );
