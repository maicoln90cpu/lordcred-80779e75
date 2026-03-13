
-- Useful links table
CREATE TABLE public.useful_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  url text NOT NULL,
  sort_order integer DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.useful_links ENABLE ROW LEVEL SECURITY;

-- All authenticated can read
CREATE POLICY "Authenticated can read useful links"
ON public.useful_links FOR SELECT TO authenticated USING (true);

-- Admins and user role can manage
CREATE POLICY "Admins can manage useful links"
ON public.useful_links FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'user')
);

-- Allow user role to manage kanban columns
CREATE POLICY "User role can manage kanban columns"
ON public.kanban_columns FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'user')
)
WITH CHECK (
  public.has_role(auth.uid(), 'user')
);
