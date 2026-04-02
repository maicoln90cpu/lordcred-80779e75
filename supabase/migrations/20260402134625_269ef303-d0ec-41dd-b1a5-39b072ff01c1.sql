ALTER TABLE public.message_history ADD COLUMN quoted_message_id TEXT;

CREATE INDEX idx_mh_quoted_message_id ON public.message_history(quoted_message_id) WHERE quoted_message_id IS NOT NULL;