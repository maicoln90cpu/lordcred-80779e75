
-- ============================================================
-- ETAPA 5: Foreign Keys faltantes
-- ============================================================
-- Usar NOT VALID + VALIDATE separado seria opção, mas como já checamos
-- 0 órfãos nessas colunas, criamos direto.

ALTER TABLE public.commission_sales
  ADD CONSTRAINT commission_sales_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.commission_sales_v2
  ADD CONSTRAINT commission_sales_v2_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.seller_pix
  ADD CONSTRAINT seller_pix_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.seller_pix_v2
  ADD CONSTRAINT seller_pix_v2_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.v8_simulations
  ADD CONSTRAINT v8_simulations_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.v8_batches
  ADD CONSTRAINT v8_batches_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.corban_notifications
  ADD CONSTRAINT corban_notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.message_favorites
  ADD CONSTRAINT message_favorites_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.client_leads
  ADD CONSTRAINT client_leads_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================
-- CHECK constraints
-- ============================================================

ALTER TABLE public.commission_sales
  ADD CONSTRAINT commission_sales_released_value_nonneg CHECK (released_value >= 0),
  ADD CONSTRAINT commission_sales_commission_value_nonneg CHECK (commission_value >= 0),
  ADD CONSTRAINT commission_sales_term_positive CHECK (term IS NULL OR term > 0);

ALTER TABLE public.commission_sales_v2
  ADD CONSTRAINT commission_sales_v2_released_value_nonneg CHECK (released_value >= 0),
  ADD CONSTRAINT commission_sales_v2_commission_value_nonneg CHECK (commission_value >= 0),
  ADD CONSTRAINT commission_sales_v2_term_positive CHECK (term IS NULL OR term > 0);

ALTER TABLE public.client_leads
  ADD CONSTRAINT client_leads_valor_lib_nonneg CHECK (valor_lib IS NULL OR valor_lib >= 0);
