# LordCred — Backup da Memória do Projeto (memocopy)

> Snapshot da `mem://index.md` em 2026-04-23.
> Este arquivo serve como **backup recuperável** caso a memória seja acidentalmente alterada ou perdida.
> Para a versão viva, consulte sempre `mem://index.md`.

---

## Core (sempre aplicado)

1. **PROTOCOLO DE RESPOSTA OBRIGATÓRIO (Regra de Ouro)**: para toda implementação, informar (1) antes vs depois, (2) melhorias, (3) vantagens/desvantagens, (4) checklist manual de validação, (5) pendências (agora ou futuro), (6) prevenção de regressão. Sugerir melhorias futuras apenas do que foi implementado.
2. **Linguagem leiga + etapas seguras**. Perfil do dono não é dev — explicar como manual de operação.
3. **Nunca implementar sem plano aprovado** quando o pedido for amplo/ambíguo.
4. **Roles**: hierarquia master > admin > manager > support > seller. `is_privileged()` libera os 3 primeiros. Master é oculto da UI.
5. **Timezone**: `America/Sao_Paulo` explícito em cálculos de data; sufixo `-03:00` em inputs.
6. **Read-only**: `src/integrations/supabase/types.ts` NUNCA é editado.
7. **Componentes < 300 linhas** — extrair hooks e sub-componentes acima disso.
8. **Cores**: sempre via tokens HSL semânticos (`--background`, `--primary`, etc.). Nunca hardcoded.
9. **WhatsApp**: UazAPI primário, Meta secundário, **Evolution NUNCA**.
10. **Edge function `evolution-webhook`** — NÃO renomear (nome legado por compatibilidade).
11. **Pagination**: `.range()` em loop para bypassar limite de 1.000 do Supabase em relatórios.
12. **Radix Select**: valor vazio é `__all__`.
13. **SECURITY DEFINER** em funções que acessam roles, para evitar recursão RLS.
14. **Edge functions**: retornam `200 {success:false, fallback:true}` em erros para evitar tela branca.

---

## Memories (referências detalhadas)

### Architecture & Backend
- mem://backend/edge-function-auth-strategy — Internal cron jobs bypass JWT via anon-key
- mem://backend/rls-recursion-security — SECURITY DEFINER for internal chats and profiles
- mem://backend/realtime-database-publication — REPLICA IDENTITY FULL for internal_messages
- mem://backend/database-privileged-access — is_privileged() SQL function for permissions
- mem://architecture/automated-audit-logging — DB triggers for profiles, roles, chips, settings
- mem://architecture/enhanced-audit-logging — JsonTreeView and legacy log extraction
- mem://infrastructure/log-retention-policy — pg_cron cleanup_webhook_logs > 3 days
- mem://architecture/supabase-pagination-standard — Batch-fetch pattern for large datasets
- mem://infrastructure/egress-optimization — Realtime filtered by chip_id, 30s polling
- mem://architecture/component-modularization-pattern — Code splitting, hooks orchestration
- mem://architecture/performance-code-splitting-strategy — React.lazy and Suspense for routes
- mem://project/documentation-structure — Core manuals and ADR directory mapping
- mem://features/automated-testing-vitest — Tests for documents, imports, and commission logic

### WhatsApp & UazAPI Gateway
- mem://architecture/whatsapp-unified-gateway — Router for UazAPI and Meta Graph API
- mem://integrations/meta-whatsapp-cloud-api — Template messaging, costs, and webhooks
- mem://architecture/database-first-whatsapp-history — UNIQUE CONSTRAINT (chip_id, message_id)
- mem://architecture/whatsapp-jid-resolution-logic — Resolves @lid vs @s.whatsapp.net mismatches
- mem://architecture/whatsapp-sync-history-reconstruction — Passive updates, protects webhook fields
- mem://features/whatsapp-last-message-persistence — Trigger-driven last_message_text updates
- mem://features/whatsapp-contact-identification-system — Custom Name > Saved Name > wa_name
- mem://architecture/whatsapp-unread-count-architecture — SUM query, webhook increment/decrement
- mem://integrations/uazapi/message-status-hierarchy — Prevent status downgrades
- mem://integrations/uazapi/webhook-handler — Extracts MessageIDs, Read/Played statuses
- mem://features/whatsapp-media-performance-optimization — Map cache, lazy load, 4x concurrency
- mem://features/whatsapp-quoted-messages-support — quoted_message_id and click-to-scroll UI
- mem://integrations/uazapi/resilience-and-error-handling — Safe JSON fallback for 5xx errors
- mem://integrations/uazapi/instance-management — 100 limit, strike cleanup, inactive removal
- mem://integrations/uazapi/media-endpoint-v2 — Maps url, text, docName for broadcast
- mem://infrastructure/chip-health-check-automation — 10min pg_cron check
- mem://features/whatsapp-watchdog-unstable-status — 15 mins inactive = Unstable
- mem://features/whatsapp-warming-rules-automation — Auto-progression phases
- mem://features/whatsapp-shared-service-queue — assigned_user_id and block send logic
- mem://features/chip-management-architecture — Providers, shared_user_ids, dynamic limits
- mem://features/whatsapp-remote-assistance — RLS bypass for Support/Admin viewing
- mem://features/whatsapp-message-templates-visibility-ui — Isolated seller templates
- mem://features/whatsapp-template-sending-behavior — Media templates loaded manually
- mem://features/whatsapp-local-organization-system — Kanban custom_status sync
- mem://features/quick-replies-local-management — Local DB, UUID array visibility
- mem://architecture/ui-realtime-subscription-optimization — Chip filtering, 1s debounce

### Broadcast System
- mem://features/whatsapp-broadcast-capabilities — Variables, media, A/B testing
- mem://features/whatsapp-broadcast-safety-logic — Daily limits, overflow chips for anti-ban
- mem://features/whatsapp-broadcast-blacklist-global — Real-time skip of blocked numbers
- mem://features/whatsapp-broadcast-engagement-tracking — Correlates replies within 7 days

### Integrations (Corban & ClickSign)
- mem://integrations/newcorban-api-infrastructure — Normalization, dynamic FGTS banks
- mem://integrations/newcorban-proposals-api — Frontend normalization
- mem://features/corban-proposal-status-monitoring — snapshot_history JSONB timeline
- mem://features/corban-data-persistence-and-automation — snapshot upsert deduplication
- mem://features/corban-seller-mapping — pg_trgm fuzzy matching
- mem://features/corban-seller-self-service — jsPDF exports, native canvas charts
- mem://features/corban-search-filtering-fallback — Client-side CPF filtering
- mem://integrations/newcorban-fgts-query-constraints — Dynamic login payloads
- mem://features/clicksign-inline-contract-viewer — Blob iframe, Base64 chunking
- mem://features/clicksign-contract-automation — {{CNPJ_CURTO}} parsing, retry
- mem://features/clicksign-contract-templates-management — Multi-template DB

### Features & Settings
- mem://ux/admin-ui-visual-standards — Loader2, 40% opacity icons
- mem://ux/universal-table-sorting-system — useSortState hook
- mem://infrastructure/radix-select-empty-value-constraint — Radix __all__ fallback
- mem://auth/user-account-management-rules — No auto-register, max_chips
- mem://auth/role-hierarchy-standardization — slug priority
- mem://security/master-user-isolation-privacy — Master hidden from lists
- mem://security/feature-permissions-expansion — feature_permissions table
- mem://architecture/admin-integrations-reorganization — Centralized webhooks/Meta
- mem://features/clipboard-import-logic — TSV/CSV parser, sci-notation fix
- mem://features/import-file-storage-archiving — Original XLSX saved to buckets
- mem://constraints/brazilian-timezone-data-grouping — America/Sao_Paulo strict
- mem://features/leads-management-comprehensive — batch_name, JSON notes
- mem://features/lead-assignment-tracking — assigned_at column
- mem://features/commissions-system-comprehensive — Monthly bonuses, C6 logic
- mem://architecture/commission-modules-isolation — Partners (V1+V2) vs Audit
- mem://features/partner-management-crm — ViaCEP, Mod 11, duplicate check
- mem://features/internal-chat-system-architecture — is_channel_member
- mem://agent/collaboration-protocol — Rule of Gold format

---

📅 **Snapshot capturado em:** 2026-04-23
🔄 **Atualizar quando:** memória for reorganizada ou houver risco de perda.
