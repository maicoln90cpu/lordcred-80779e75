
-- Tabela de equipes
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Associação N:N entre usuários e equipes
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Teams policies
CREATE POLICY "Authenticated read teams" ON public.teams
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Privileged insert teams" ON public.teams
  FOR INSERT TO authenticated WITH CHECK (is_privileged(auth.uid()));

CREATE POLICY "Privileged update teams" ON public.teams
  FOR UPDATE TO authenticated USING (is_privileged(auth.uid()));

CREATE POLICY "Privileged delete teams" ON public.teams
  FOR DELETE TO authenticated USING (is_privileged(auth.uid()));

-- Team members policies
CREATE POLICY "Authenticated read team_members" ON public.team_members
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Privileged insert team_members" ON public.team_members
  FOR INSERT TO authenticated WITH CHECK (is_privileged(auth.uid()));

CREATE POLICY "Privileged update team_members" ON public.team_members
  FOR UPDATE TO authenticated USING (is_privileged(auth.uid()));

CREATE POLICY "Privileged delete team_members" ON public.team_members
  FOR DELETE TO authenticated USING (is_privileged(auth.uid()));

-- Trigger updated_at
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
