
-- Kanban columns (admin-managed, global)
CREATE TABLE public.kanban_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color_hex text DEFAULT '#6b7280',
  sort_order integer NOT NULL DEFAULT 0,
  auto_archive_days integer DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage kanban columns"
  ON public.kanban_columns FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Authenticated users can read kanban columns"
  ON public.kanban_columns FOR SELECT
  TO authenticated
  USING (true);

-- Kanban cards (contact positions on board)
CREATE TABLE public.kanban_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  column_id uuid REFERENCES public.kanban_columns(id) ON DELETE CASCADE NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(conversation_id)
);

ALTER TABLE public.kanban_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all kanban cards"
  ON public.kanban_cards FOR ALL
  USING (public.is_admin());

CREATE POLICY "Users can manage their kanban cards"
  ON public.kanban_cards FOR ALL
  USING (
    conversation_id IN (
      SELECT c.id FROM public.conversations c
      JOIN public.chips ch ON c.chip_id = ch.id
      WHERE ch.user_id = auth.uid()
    )
  );

-- Default columns
INSERT INTO public.kanban_columns (name, color_hex, sort_order) VALUES
  ('Aguardando', '#f59e0b', 0),
  ('Em andamento', '#3b82f6', 1),
  ('Finalizado', '#22c55e', 2),
  ('Urgente', '#ef4444', 3);

-- Migrate existing conversations with custom_status to kanban_cards
INSERT INTO public.kanban_cards (conversation_id, column_id)
SELECT c.id, kc.id
FROM public.conversations c
JOIN public.kanban_columns kc ON kc.name = c.custom_status
WHERE c.custom_status IS NOT NULL
ON CONFLICT (conversation_id) DO NOTHING;

-- Enable realtime for kanban_cards
ALTER PUBLICATION supabase_realtime ADD TABLE public.kanban_cards;
