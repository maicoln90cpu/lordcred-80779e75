
-- RLS policies for support role

CREATE POLICY "Support can manage all leads"
ON public.client_leads FOR ALL TO authenticated
USING (has_role(auth.uid(), 'support'::app_role))
WITH CHECK (has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Support can manage all chips"
ON public.chips FOR ALL TO authenticated
USING (has_role(auth.uid(), 'support'::app_role))
WITH CHECK (has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Support can manage all conversations"
ON public.conversations FOR ALL TO authenticated
USING (has_role(auth.uid(), 'support'::app_role))
WITH CHECK (has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Support can view all messages"
ON public.message_history FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Support can insert messages"
ON public.message_history FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Support can update messages"
ON public.message_history FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'support'::app_role))
WITH CHECK (has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Support can view kanban cards"
ON public.kanban_cards FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Support can view message queue"
ON public.message_queue FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Support can manage warming messages"
ON public.warming_messages FOR ALL TO authenticated
USING (has_role(auth.uid(), 'support'::app_role))
WITH CHECK (has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Support can manage external numbers"
ON public.external_numbers FOR ALL TO authenticated
USING (has_role(auth.uid(), 'support'::app_role))
WITH CHECK (has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Support can view lifecycle logs"
ON public.chip_lifecycle_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Support can manage conversation notes"
ON public.conversation_notes FOR ALL TO authenticated
USING (has_role(auth.uid(), 'support'::app_role))
WITH CHECK (has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Support can manage labels"
ON public.labels FOR ALL TO authenticated
USING (has_role(auth.uid(), 'support'::app_role))
WITH CHECK (has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Support can manage favorites"
ON public.message_favorites FOR ALL TO authenticated
USING (has_role(auth.uid(), 'support'::app_role))
WITH CHECK (has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Support can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Support can update profiles they created"
ON public.profiles FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'support'::app_role) AND created_by = auth.uid())
WITH CHECK (has_role(auth.uid(), 'support'::app_role) AND created_by = auth.uid());

CREATE POLICY "Support can view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Support can manage channels"
ON public.internal_channels FOR ALL TO authenticated
USING (has_role(auth.uid(), 'support'::app_role))
WITH CHECK (has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Support can manage channel members"
ON public.internal_channel_members FOR ALL TO authenticated
USING (has_role(auth.uid(), 'support'::app_role))
WITH CHECK (has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Support can manage internal messages"
ON public.internal_messages FOR ALL TO authenticated
USING (has_role(auth.uid(), 'support'::app_role))
WITH CHECK (has_role(auth.uid(), 'support'::app_role));

CREATE POLICY "Support can manage useful links"
ON public.useful_links FOR ALL TO authenticated
USING (has_role(auth.uid(), 'support'::app_role))
WITH CHECK (has_role(auth.uid(), 'support'::app_role));
