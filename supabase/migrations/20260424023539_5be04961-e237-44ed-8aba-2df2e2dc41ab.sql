-- Correção 1: CHECK order_num > 0 em hr_questions
ALTER TABLE public.hr_questions
  ADD CONSTRAINT hr_questions_order_num_positive CHECK (order_num > 0);

-- Correção 5: Coluna phone em profiles (para notificação ao entrevistador)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;