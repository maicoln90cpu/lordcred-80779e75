-- Cache de media_id da Meta para acelerar encaminhamentos e contornar a expiração
-- de 30 dias dos media_id na Cloud API. TTL de 25 dias para sempre revalidar antes
-- da expiração oficial.
CREATE TABLE IF NOT EXISTS public.meta_media_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_message_id text NOT NULL,
  source_chip_id uuid REFERENCES public.chips(id) ON DELETE CASCADE,
  target_chip_id uuid NOT NULL REFERENCES public.chips(id) ON DELETE CASCADE,
  media_id text NOT NULL,
  media_type text,
  mime_type text,
  size_bytes integer,
  origin text NOT NULL DEFAULT 'reuse', -- 'reuse' (mesmo chip) | 'reupload' (download+upload)
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '25 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS meta_media_cache_lookup
  ON public.meta_media_cache (source_message_id, target_chip_id);

CREATE INDEX IF NOT EXISTS meta_media_cache_expires_at
  ON public.meta_media_cache (expires_at);

ALTER TABLE public.meta_media_cache ENABLE ROW LEVEL SECURITY;

-- Apenas service role acessa (edge functions). Nenhuma policy = bloqueado para usuários autenticados.
-- Privileged users podem ler para auditoria.
CREATE POLICY "Privileged users can view cache"
  ON public.meta_media_cache FOR SELECT
  USING (public.is_privileged());

-- Limpeza automática de entradas expiradas (chamada por pg_cron já existente ou manual)
CREATE OR REPLACE FUNCTION public.cleanup_meta_media_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.meta_media_cache WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;