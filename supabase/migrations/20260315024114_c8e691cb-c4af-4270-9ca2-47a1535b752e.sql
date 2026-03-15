CREATE POLICY "Support can manage kanban columns"
ON public.kanban_columns
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'support'::app_role))
WITH CHECK (has_role(auth.uid(), 'support'::app_role));