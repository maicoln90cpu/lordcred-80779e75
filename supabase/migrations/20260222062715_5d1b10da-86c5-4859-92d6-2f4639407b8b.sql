CREATE POLICY "Users can update their own messages"
  ON public.message_history
  FOR UPDATE
  USING (chip_id IN (SELECT id FROM chips WHERE user_id = auth.uid()))
  WITH CHECK (chip_id IN (SELECT id FROM chips WHERE user_id = auth.uid()));