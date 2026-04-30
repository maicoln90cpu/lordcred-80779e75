
-- ============================================================
-- ETAPA 1/6 — ÍNDICES: remover mortos + criar compostos úteis
-- Reversível. Sem alteração de dados nem de RLS.
-- ============================================================

-- 1) Remover índices nunca usados (idx_scan = 0 há semanas)
DROP INDEX IF EXISTS public.idx_audit_logs_category;
DROP INDEX IF EXISTS public.idx_v8_simulations_created_by;
DROP INDEX IF EXISTS public.idx_v8_simulations_simulate_status;
DROP INDEX IF EXISTS public.idx_corban_snapshot_banco;
DROP INDEX IF EXISTS public.idx_v8_attempts_batch;
DROP INDEX IF EXISTS public.idx_v8_attempts_created;
DROP INDEX IF EXISTS public.idx_corban_notifications_user_unread;
DROP INDEX IF EXISTS public.idx_clt_v1_lookup;
DROP INDEX IF EXISTS public.idx_clt_v2_lookup;
DROP INDEX IF EXISTS public.idx_v8_webhook_logs_cpf;
DROP INDEX IF EXISTS public.idx_profiles_name_trgm;
DROP INDEX IF EXISTS public.hr_partner_leads_full_name_trgm;
DROP INDEX IF EXISTS public.hr_candidates_full_name_trgm;
DROP INDEX IF EXISTS public.hr_candidates_kanban_status_idx;
DROP INDEX IF EXISTS public.idx_mh_quoted_message_id;
DROP INDEX IF EXISTS public.idx_cr_rules_clt_lookup;
DROP INDEX IF EXISTS public.v8_ops_local_borrower_cpf_idx;

-- 2) Criar índices compostos para os hot paths
-- Observação: dentro de migration não dá pra usar CONCURRENTLY (transação).
-- As tabelas são pequenas o suficiente para CREATE INDEX normal (audit_logs 209k já testado).

-- audit_logs: filtros principais
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
  ON public.audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created
  ON public.audit_logs (action, created_at DESC);

-- v8_simulations: recálculo por batch + filtros de status
CREATE INDEX IF NOT EXISTS idx_v8_simulations_batch_status
  ON public.v8_simulations (batch_id, status);

-- v8_webhook_logs: ordenação na aba Webhooks
CREATE INDEX IF NOT EXISTS idx_v8_webhook_logs_received
  ON public.v8_webhook_logs (received_at DESC);

-- v8_simulation_attempts: histórico por simulação
CREATE INDEX IF NOT EXISTS idx_v8_attempts_sim_created
  ON public.v8_simulation_attempts (simulation_id, created_at DESC);

-- client_leads: tela de vendedor (assigned_to + status)
CREATE INDEX IF NOT EXISTS idx_client_leads_assigned_status
  ON public.client_leads (assigned_to, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_leads_batch_name
  ON public.client_leads (batch_name) WHERE batch_name IS NOT NULL;

-- message_history: chat por chip
CREATE INDEX IF NOT EXISTS idx_message_history_chip_created
  ON public.message_history (chip_id, created_at DESC);

-- conversations: lista ordenada por última mensagem
CREATE INDEX IF NOT EXISTS idx_conversations_chip_lastmsg
  ON public.conversations (chip_id, last_message_at DESC NULLS LAST);

-- corban_propostas_snapshot: mapping de vendedor
CREATE INDEX IF NOT EXISTS idx_corban_snapshot_vendedor
  ON public.corban_propostas_snapshot (vendedor_nome) WHERE vendedor_nome IS NOT NULL;

-- corban_notifications: bell icon (não lidas por usuário)
CREATE INDEX IF NOT EXISTS idx_corban_notif_user_lida
  ON public.corban_notifications (user_id, lida, created_at DESC);

-- internal_messages: chat interno por canal
CREATE INDEX IF NOT EXISTS idx_internal_messages_channel_created
  ON public.internal_messages (channel_id, created_at DESC);
