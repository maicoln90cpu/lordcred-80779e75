-- 1. Add snapshot_history column
ALTER TABLE public.corban_propostas_snapshot
ADD COLUMN IF NOT EXISTS snapshot_history jsonb DEFAULT '[]'::jsonb;

-- 2. Create notifications table
CREATE TABLE public.corban_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  proposta_id text,
  tipo text NOT NULL DEFAULT 'status_change',
  mensagem text NOT NULL,
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.corban_notifications ENABLE ROW LEVEL SECURITY;

-- Sellers see their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.corban_notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Sellers can mark as read
CREATE POLICY "Users can update own notifications"
  ON public.corban_notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Privileged can view all
CREATE POLICY "Privileged can view all notifications"
  ON public.corban_notifications FOR SELECT
  TO authenticated
  USING (is_privileged(auth.uid()));

-- Privileged can manage all
CREATE POLICY "Privileged can manage notifications"
  ON public.corban_notifications FOR ALL
  TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- System/triggers can insert
CREATE POLICY "Service can insert notifications"
  ON public.corban_notifications FOR INSERT
  TO public
  WITH CHECK (true);

-- Index for fast lookup
CREATE INDEX idx_corban_notifications_user_unread
  ON public.corban_notifications (user_id, lida)
  WHERE lida = false;

CREATE INDEX idx_corban_notifications_created
  ON public.corban_notifications (created_at DESC);

-- 3. Trigger function for status tracking + notifications
CREATE OR REPLACE FUNCTION public.track_snapshot_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _old_status text;
  _new_status text;
  _history jsonb;
  _seller_user_id uuid;
  _old_label text;
  _new_label text;
BEGIN
  _old_status := COALESCE(OLD.status, '');
  _new_status := COALESCE(NEW.status, '');

  -- Only act if status actually changed
  IF _old_status = _new_status THEN
    RETURN NEW;
  END IF;

  -- Append to snapshot_history
  _history := COALESCE(NEW.snapshot_history, '[]'::jsonb);
  _history := _history || jsonb_build_object(
    'de', _old_status,
    'para', _new_status,
    'em', now()::text
  );
  NEW.snapshot_history := _history;

  -- Resolve status labels from cache
  SELECT asset_label INTO _old_label FROM corban_assets_cache
    WHERE asset_type = 'status' AND asset_id = _old_status LIMIT 1;
  SELECT asset_label INTO _new_label FROM corban_assets_cache
    WHERE asset_type = 'status' AND asset_id = _new_status LIMIT 1;

  _old_label := COALESCE(_old_label, _old_status);
  _new_label := COALESCE(_new_label, _new_status);

  -- Find the mapped user for this seller
  IF NEW.vendedor_nome IS NOT NULL THEN
    SELECT user_id INTO _seller_user_id
    FROM corban_seller_mapping
    WHERE corban_name = NEW.vendedor_nome AND user_id IS NOT NULL
    LIMIT 1;

    IF _seller_user_id IS NOT NULL THEN
      INSERT INTO corban_notifications (user_id, proposta_id, tipo, mensagem)
      VALUES (
        _seller_user_id,
        NEW.proposta_id,
        'status_change',
        'Proposta ' || COALESCE(NEW.proposta_id, '') || ' (' || COALESCE(NEW.nome, 'sem nome') || '): ' || _old_label || ' → ' || _new_label
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Attach trigger
CREATE TRIGGER on_snapshot_status_change
  BEFORE UPDATE ON public.corban_propostas_snapshot
  FOR EACH ROW
  EXECUTE FUNCTION public.track_snapshot_status_change();