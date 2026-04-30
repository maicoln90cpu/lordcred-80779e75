
-- ============================================================
-- ETAPA 3/6 (Parte A) — Endurecer 10 RLS policies permissivas
-- Buckets ficam para parte B (precisa decisão sobre mídia pública)
-- ============================================================

-- 1) system_settings: só privilegiados podem alterar (era qualquer authenticated)
DROP POLICY IF EXISTS "Authenticated users can update system settings" ON public.system_settings;
CREATE POLICY "Privileged can update system settings"
  ON public.system_settings FOR UPDATE
  TO authenticated
  USING (is_privileged(auth.uid()))
  WITH CHECK (is_privileged(auth.uid()));

-- 2) audit_logs: remove duplicata, restringe INSERT
DROP POLICY IF EXISTS "Service can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs"  ON public.audit_logs;
CREATE POLICY "Authenticated can insert audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated, service_role
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'service_role');

-- 3) chip_lifecycle_logs: idem
DROP POLICY IF EXISTS "Service can insert lifecycle logs" ON public.chip_lifecycle_logs;
CREATE POLICY "Authenticated can insert lifecycle logs"
  ON public.chip_lifecycle_logs FOR INSERT
  TO authenticated, service_role
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'service_role');

-- 4) webhook_logs: só serviço interno (vem de edge functions)
DROP POLICY IF EXISTS "Service can insert webhook logs" ON public.webhook_logs;
CREATE POLICY "Service role can insert webhook logs"
  ON public.webhook_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 5) whatsapp_cost_log: só serviço interno
DROP POLICY IF EXISTS "System can insert cost logs" ON public.whatsapp_cost_log;
CREATE POLICY "Service role can insert cost logs"
  ON public.whatsapp_cost_log FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 6) corban_assets_cache: só serviço interno (cron popula)
DROP POLICY IF EXISTS "Service can insert corban assets" ON public.corban_assets_cache;
DROP POLICY IF EXISTS "Service can update corban assets" ON public.corban_assets_cache;
CREATE POLICY "Service role can insert corban assets"
  ON public.corban_assets_cache FOR INSERT
  TO service_role
  WITH CHECK (true);
CREATE POLICY "Service role can update corban assets"
  ON public.corban_assets_cache FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 7) corban_notifications: trigger SECURITY DEFINER cria; e edge function pode inserir
-- Mantém INSERT por authenticated (pra não quebrar trigger encadeada de UPDATE em snapshots)
DROP POLICY IF EXISTS "Service can insert notifications" ON public.corban_notifications;
CREATE POLICY "Authenticated can insert corban notifications"
  ON public.corban_notifications FOR INSERT
  TO authenticated, service_role
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'service_role');

-- 8) corban_propostas_snapshot: ALL → quebrar em INSERT/UPDATE/DELETE separados,
-- todos restritos a service_role (vem do cron edge corban-snapshot-cron)
DROP POLICY IF EXISTS "Service can upsert snapshots" ON public.corban_propostas_snapshot;
CREATE POLICY "Service role can insert snapshots"
  ON public.corban_propostas_snapshot FOR INSERT
  TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update snapshots"
  ON public.corban_propostas_snapshot FOR UPDATE
  TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role can delete snapshots"
  ON public.corban_propostas_snapshot FOR DELETE
  TO service_role USING (true);
