-- Item 3: Allow 'user' role (Administrador) to view all conversations for Remote Assistance
CREATE POLICY "User role can view all conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'user'::app_role));

-- Item 3: Allow 'user' role to view all message_history for Remote Assistance
CREATE POLICY "User role can view all messages"
ON public.message_history
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'user'::app_role));

-- Item 6: Performance indexes
CREATE INDEX IF NOT EXISTS idx_conversations_chip_last_msg ON public.conversations (chip_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_history_chip_jid_created ON public.message_history (chip_id, remote_jid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_history_chip_created ON public.message_history (chip_id, created_at);
CREATE INDEX IF NOT EXISTS idx_client_leads_assigned_status ON public.client_leads (assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_message_shortcuts_user_chip ON public.message_shortcuts (user_id, chip_id);