-- Public interview tokens table
CREATE TABLE IF NOT EXISTS public.hr_interview_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  interview_id uuid NOT NULL REFERENCES public.hr_interviews(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.hr_candidates(id) ON DELETE CASCADE,
  stage integer NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  used_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_hr_interview_tokens_token ON public.hr_interview_tokens(token);
CREATE INDEX IF NOT EXISTS idx_hr_interview_tokens_interview ON public.hr_interview_tokens(interview_id);
CREATE INDEX IF NOT EXISTS idx_hr_interview_tokens_candidate ON public.hr_interview_tokens(candidate_id);

ALTER TABLE public.hr_interview_tokens ENABLE ROW LEVEL SECURITY;

-- Only privileged users (master/admin/manager) and support can view tokens
CREATE POLICY "Privileged and support can view tokens"
ON public.hr_interview_tokens
FOR SELECT
TO authenticated
USING (public.is_privileged(auth.uid()) OR public.has_role(auth.uid(), 'support'));

-- Only privileged users and support can create tokens
CREATE POLICY "Privileged and support can create tokens"
ON public.hr_interview_tokens
FOR INSERT
TO authenticated
WITH CHECK (public.is_privileged(auth.uid()) OR public.has_role(auth.uid(), 'support'));

-- Only privileged users and support can update (revoke) tokens
CREATE POLICY "Privileged and support can update tokens"
ON public.hr_interview_tokens
FOR UPDATE
TO authenticated
USING (public.is_privileged(auth.uid()) OR public.has_role(auth.uid(), 'support'));

-- Only privileged users can delete tokens
CREATE POLICY "Privileged can delete tokens"
ON public.hr_interview_tokens
FOR DELETE
TO authenticated
USING (public.is_privileged(auth.uid()));