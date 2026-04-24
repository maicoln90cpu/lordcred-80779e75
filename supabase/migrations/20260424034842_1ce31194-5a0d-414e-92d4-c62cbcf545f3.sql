-- Add snapshot column to preserve question text at time of answer
ALTER TABLE public.hr_interview_answers 
  ADD COLUMN IF NOT EXISTS question_text_snapshot text;

-- Backfill existing answers with current question text
UPDATE public.hr_interview_answers a
  SET question_text_snapshot = q.text
  FROM public.hr_questions q
  WHERE a.question_id = q.id 
    AND a.question_text_snapshot IS NULL;