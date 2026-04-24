-- Garantir unicidade de seller_id em seller_pix e seller_pix_v2 (necessário para onConflict no upsert automático)
-- Remove duplicatas mantendo o mais recente, depois adiciona constraint
DELETE FROM public.seller_pix a USING public.seller_pix b
WHERE a.seller_id = b.seller_id AND a.created_at < b.created_at;

DELETE FROM public.seller_pix_v2 a USING public.seller_pix_v2 b
WHERE a.seller_id = b.seller_id AND a.created_at < b.created_at;

ALTER TABLE public.seller_pix
  ADD CONSTRAINT seller_pix_seller_id_unique UNIQUE (seller_id);

ALTER TABLE public.seller_pix_v2
  ADD CONSTRAINT seller_pix_v2_seller_id_unique UNIQUE (seller_id);