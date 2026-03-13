
-- Internal chat channels (groups / DMs)
CREATE TABLE public.internal_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_group boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Channel members
CREATE TABLE public.internal_channel_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.internal_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Messages in channels
CREATE TABLE public.internal_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.internal_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.internal_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;

-- Channels: members can read channels they belong to
CREATE POLICY "Members can view their channels" ON public.internal_channels
  FOR SELECT TO authenticated
  USING (id IN (SELECT channel_id FROM public.internal_channel_members WHERE user_id = auth.uid()));

-- Admins/users can manage channels
CREATE POLICY "Admins can manage channels" ON public.internal_channels
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'user'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'user'));

-- Channel members: members can see co-members
CREATE POLICY "Members can view channel members" ON public.internal_channel_members
  FOR SELECT TO authenticated
  USING (channel_id IN (SELECT channel_id FROM public.internal_channel_members AS m WHERE m.user_id = auth.uid()));

-- Admins/users can manage members
CREATE POLICY "Admins can manage channel members" ON public.internal_channel_members
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'user'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'user'));

-- Messages: members can read messages in their channels
CREATE POLICY "Members can view channel messages" ON public.internal_messages
  FOR SELECT TO authenticated
  USING (channel_id IN (SELECT channel_id FROM public.internal_channel_members WHERE user_id = auth.uid()));

-- Members can send messages to their channels
CREATE POLICY "Members can send messages" ON public.internal_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    channel_id IN (SELECT channel_id FROM public.internal_channel_members WHERE user_id = auth.uid())
  );

-- Admins can manage all messages
CREATE POLICY "Admins can manage messages" ON public.internal_messages
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'user'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'user'));

-- Index for fast message queries
CREATE INDEX idx_internal_messages_channel_created ON public.internal_messages(channel_id, created_at DESC);
CREATE INDEX idx_internal_channel_members_user ON public.internal_channel_members(user_id);
