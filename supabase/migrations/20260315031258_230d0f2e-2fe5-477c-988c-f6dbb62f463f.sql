-- Allow support role full CRUD on kanban_cards
CREATE POLICY "Support can manage all kanban cards"
ON public.kanban_cards
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'support'::app_role))
WITH CHECK (has_role(auth.uid(), 'support'::app_role));