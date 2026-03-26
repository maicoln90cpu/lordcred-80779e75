
-- Product Info tables for "Info Produtos" feature

CREATE TABLE public.product_info_tabs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tab_name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.product_info_columns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tab_id UUID NOT NULL REFERENCES public.product_info_tabs(id) ON DELETE CASCADE,
  column_name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.product_info_rows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tab_id UUID NOT NULL REFERENCES public.product_info_tabs(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.product_info_cells (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  row_id UUID NOT NULL REFERENCES public.product_info_rows(id) ON DELETE CASCADE,
  column_id UUID NOT NULL REFERENCES public.product_info_columns(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(row_id, column_id)
);

-- RLS
ALTER TABLE public.product_info_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_info_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_info_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_info_cells ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated
CREATE POLICY "Authenticated can read tabs" ON public.product_info_tabs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read columns" ON public.product_info_columns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read rows" ON public.product_info_rows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read cells" ON public.product_info_cells FOR SELECT TO authenticated USING (true);

-- INSERT/UPDATE/DELETE: admin + master only
CREATE POLICY "Admins can insert tabs" ON public.product_info_tabs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'));
CREATE POLICY "Admins can update tabs" ON public.product_info_tabs FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'));
CREATE POLICY "Admins can delete tabs" ON public.product_info_tabs FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'));

CREATE POLICY "Admins can insert columns" ON public.product_info_columns FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'));
CREATE POLICY "Admins can update columns" ON public.product_info_columns FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'));
CREATE POLICY "Admins can delete columns" ON public.product_info_columns FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'));

CREATE POLICY "Admins can insert rows" ON public.product_info_rows FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'));
CREATE POLICY "Admins can update rows" ON public.product_info_rows FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'));
CREATE POLICY "Admins can delete rows" ON public.product_info_rows FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'));

CREATE POLICY "Admins can insert cells" ON public.product_info_cells FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'));
CREATE POLICY "Admins can update cells" ON public.product_info_cells FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'));
CREATE POLICY "Admins can delete cells" ON public.product_info_cells FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'));

-- Seed: 4 default tabs
INSERT INTO public.product_info_tabs (tab_name, sort_order) VALUES
  ('Infos CLT', 0),
  ('Bancos aceitos CLT', 1),
  ('Infos FGTS', 2),
  ('Bancos aceitos FGTS', 3);

-- Seed: 8 default columns for each tab
DO $$
DECLARE
  tab RECORD;
  col_names TEXT[] := ARRAY['Banco', 'Idade', 'Prazo', 'Valor', 'Atende Estrangeiro', 'Qtt de Contratos', 'Tempo de Admissão', 'Particularidades'];
  i INT;
BEGIN
  FOR tab IN SELECT id FROM public.product_info_tabs ORDER BY sort_order LOOP
    FOR i IN 1..array_length(col_names, 1) LOOP
      INSERT INTO public.product_info_columns (tab_id, column_name, sort_order) VALUES (tab.id, col_names[i], i - 1);
    END LOOP;
  END LOOP;
END $$;
