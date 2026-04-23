# LordCred — Knowledge Base (resumo para Knowledge oficial do projeto)

> Resumo compacto (~9.500 chars) para colar no campo Knowledge do Lovable.

---

## Identidade
LordCred = plataforma de aquecimento inteligente de chips WhatsApp + CRM de vendas + Auditoria de Comissões + Integração Corban (NewCorban) + Contratos digitais (ClickSign). Operação 100% Brasil, timezone America/Sao_Paulo.

## Stack
React 18 + Vite 5 + TypeScript 5 + Tailwind CSS v3 + shadcn/ui. Backend Supabase (PostgreSQL, Auth, Edge Functions, Realtime, Storage, RLS). Deploy Lovable Cloud.

## WhatsApp — Provedores
- **UazAPI v2 (uazapiGO)**: primário. Edge functions `uazapi-api` (proxy), `evolution-webhook` (receptor — nome legado, NUNCA renomear), `instance-maintenance`, `chip-health-check`, `sync-history`.
- **Meta WhatsApp Business API**: secundário (chips com `provider=meta`). Edge functions `whatsapp-gateway` (envio) e `meta-webhook` (recepção). Credenciais editáveis via tela (5 campos: app_id, app_secret, waba_id, phone_number_id, verify_token) — leitura prioritária do banco com fallback para `Deno.env`.
- **Evolution API**: REMOVIDO. Nunca implementar.

## Sistema de Roles (5 papéis)
Tabela `user_roles` (NUNCA em profiles ou localStorage). Funções SECURITY DEFINER:
- `is_privileged()` → true para master/admin/manager.
- `has_role(_user_id, _role)` → check específico.

| Role | Privileged | Acesso |
|---|---|---|
| master | ✅ | Total + SQL/Migração/Export. Oculto da UI de listagens. |
| admin | ✅ | Total exceto SQL/Export |
| manager | ✅ | Total exceto Permissões/SQL/Export |
| support | ❌ | Operacional + criar usuários |
| seller | ❌ | Apenas leads próprios + chat interno |

## Módulos de Comissão (3 isolados)

1. **Auditoria** (`/admin/commission-reports`): 11 abas. Tabelas `cr_*`. Cálculo SUMIFS-style (extractTableKey → findRate com wildcard `*` + chave específica). Cross-reference por `num_contrato` entre `cr_relatorio` ↔ `cr_geral/cr_repasse` + `cr_seguros`. Mercantil do Brasil: base = `valor_liberado / 0.7`.

2. **Comissões Parceiros V1** (`/admin/commissions`): produção, intocado. Tabelas `commission_sales`, `commission_rates_fgts` (3 cols), `commission_rates_clt`, `seller_pix`, `commission_settings`, `commission_bonus_tiers`, `commission_annual_rewards`. Trigger `calculate_commission()`.

3. **Comissões Parceiros V2** (`/admin/commissions-v2`): SANDBOX. 7 tabelas espelho `_v2`. Nova estrutura `commission_rates_fgts_v2` com 8 colunas (banco + tabela + prazo min/max + valor min/max + seguro + vigência) — paridade com CLT. 28 taxas pré-populadas (LOTUS, HUB, FACTA, Paraná). Trigger `calculate_commission_v2`. Botões "📋 Copiar V1→V2" e "🗑️ Limpar V2" para teste comparativo.

## Integração Corban (NewCorban)
- Edge functions: `corban-api` (proxy), `corban-status-sync` (pg_cron sincroniza status), `corban-snapshot-cron` (snapshot diário com `snapshot_history` JSONB).
- Mapeamento vendedor LordCred ↔ Corban via `corban_seller_mapping` (pg_trgm fuzzy).
- Visibilidade configurável via `corban_feature_config`.
- Suporta consultas FGTS em lote.

## Contratos Digitais (ClickSign)
- Edge functions: `clicksign-api` (proxy), `clicksign-webhook` (receptor).
- Templates editáveis em `contract_templates`.
- Visualização inline via Blob iframe + Base64 chunking.

## Feature Permissions (granulares)
- Tabela `feature_permissions`: `allowed_roles[]` + `allowed_user_ids[]`.
- Hook `useFeaturePermissions` (cache 5min + realtime).
- Master e admin sempre liberados; manager liberado exceto `permissions`.
- Sem config = aberto a todos.

## Convenções obrigatórias
1. Cores: SEMPRE tokens HSL semânticos. Nunca hardcoded.
2. UI: shadcn/ui com variants.
3. Componentes: < 300 linhas (extrair hooks + sub-componentes).
4. Hooks: prefixo `use`, retornar objeto nomeado.
5. Timezone: `America/Sao_Paulo` em cálculos de comissão (sufixo `-03:00`).
6. `src/integrations/supabase/types.ts` é READ-ONLY.
7. Pagination: `.range()` em loop para passar de 1.000 linhas.
8. Radix Select: valor vazio = `__all__`.
9. Edge functions retornam `200 {success:false, fallback:true}` em erros.
10. Funções que acessam roles → SECURITY DEFINER.

## Edge Functions (18)
warming-engine, queue-processor, evolution-webhook (UazAPI), uazapi-api, whatsapp-gateway (Meta), meta-webhook, instance-maintenance, chip-health-check, sync-history, create-user, delete-user, update-user-role, corban-api, corban-status-sync, corban-snapshot-cron, clicksign-api, clicksign-webhook, broadcast-sender. Catálogo: `docs/EDGE-FUNCTIONS.md`.

## Tabelas (47+, RLS em todas)
**Core**: chips, message_queue, message_history, message_templates, message_shortcuts, system_settings, external_numbers.
**CRM**: conversations, conversation_notes, conversation_audit_log, message_favorites, labels, client_leads, kanban_columns, kanban_cards.
**Auditoria**: cr_geral, cr_repasse, cr_seguros, cr_relatorio, cr_rules_clt, cr_rules_fgts, cr_historico_gestao, cr_historico_detalhado, import_batches.
**Comissões V1**: commission_sales, commission_settings, commission_rates_clt, commission_rates_fgts, commission_bonus_tiers, commission_annual_rewards, seller_pix.
**Comissões V2**: commission_sales_v2, commission_settings_v2, commission_rates_clt_v2, commission_rates_fgts_v2 (8 cols), commission_bonus_tiers_v2, commission_annual_rewards_v2, seller_pix_v2.
**Corban**: corban_assets_cache, corban_feature_config, corban_notifications, corban_propostas_snapshot, corban_seller_mapping.
**Contratos**: contract_templates.
**Operacional**: profiles, user_roles, feature_permissions, audit_logs, chip_lifecycle_logs, support_tickets, internal_channels, internal_messages, internal_channel_members, bank_credentials, broadcast_campaigns, broadcast_recipients, broadcast_blacklist.

## Hooks Modulares (15+)
useChatMessages, useChatActions, useConversations, useInternalChat, useInternalChatUnread, useLeadsData, useKanban, useCorbanFeatures, useFeaturePermissions, useRealtimeSubscription, useRealtimeChips, useRealtimeMessages, useMessageCache, useChipsManager, useDashboardData, useSettingsData.

## Documentação (20 docs)
README.md (raiz), docs/PRD.md, docs/ROADMAP.md, docs/CHANGELOG.md, docs/PENDENCIAS.md, docs/SYSTEM-DESIGN.md, docs/DATABASE-SCHEMA.md, docs/SECURITY.md, docs/CODE-STANDARDS.md, docs/EDGE-FUNCTIONS.md, docs/ONBOARDING.md, docs/ADR.md, docs/INSTRUCOES.md, docs/COMMISSION-REPORTS.md, docs/COMMISSIONS-V2.md, docs/META-WHATSAPP-SETUP.md, docs/KNOWLEDGE.md, docs/memocopy.md, docs/corban.md, docs/UAZAPI.md, docs/HISTORICO-EVOLUTION-CLEANUP.md.

---

## REGRA DE OURO — Protocolo de Resposta Obrigatório

Para TODA implementação que o agente entregar, ele deve incluir SEMPRE no final da resposta:

1. **Antes vs Depois** — o que mudou concretamente.
2. **Melhorias** — o que ficou melhor.
3. **Vantagens e desvantagens** — trade-offs honestos.
4. **Checklist manual** — passo a passo para o usuário validar.
5. **Pendências** — o que ficou para agora ou para o futuro.
6. **Prevenção de regressão** — teste, função, componente ou monitoramento que evita o problema voltar.

Se for reportado um problema, além de corrigir, dizer se vale criar proteção permanente. Se houver próximos passos, explicar como está hoje, como ficará e qual o ganho. Sugerir melhorias futuras apenas do que foi implementado, sem excessos. Linguagem leiga + etapas seguras.

---

📅 Atualizado em: 2026-04-23
