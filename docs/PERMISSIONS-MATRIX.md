# Matriz de Permissões — LordCred

> **Atualizado**: 2026-05-05 (Etapa 4 do plano de sincronização RLS ↔ Toggles ↔ Roles)
> **Objetivo**: documentar quais cargos têm acesso padrão a cada feature, quais tabelas do banco essa feature consome, e onde a regra é aplicada (RLS / hook / gate UI).

---

## 1. Conceitos

| Camada | O que controla | Onde mora |
|---|---|---|
| **Master Toggle** (global) | Visibilidade da feature no menu/rota | `master_feature_toggles.is_enabled` |
| **Role / User Permission** | Quem (cargo ou usuário) pode ver/editar dados | `feature_permissions.allowed_roles[]` + `allowed_user_ids[]` |
| **RLS (banco)** | Bloqueio de leitura/escrita das linhas | Policy SQL com `has_feature_access(uid, key)` |
| **Hook UI** | Decisão no frontend | `useFeatureAccess(featureKey)` → `{ canSee, canEdit }` |
| **Gate UI** | Renderização condicional + mensagem | `<EmptyStateNoAccess />` / `<FeatureGate />` |

Hierarquia de roles: `master > admin > manager > support > seller`.
`is_privileged()` libera `master/admin/manager` automaticamente em quase tudo.

---

## 2. Sensíveis (exigem confirmação para Vendedor)

`bank_credentials` · `commission_reports` · `commissions` · `commissions_v2` · `audit_logs` · `permissions` · `master_admin`

Ao tentar liberar Vendedor em qualquer uma destas no `/admin/permissions`, aparece modal de confirmação dupla.

---

## 3. Matriz de 38 features

Legenda — coluna por cargo:
- ✅ **Padrão** = liberado nativamente (sem precisar marcar toggle).
- ⚙️ **Toggle** = liberado apenas se admin marcar o checkbox em `/admin/permissions`.
- ❌ **Bloqueado** = não acessível mesmo via toggle.
- 🔒 **Sensível** = exige confirmação para liberar a Vendedor.

| # | feature_key | Grupo | Master | Admin | Gerente | Suporte | Vendedor | Tabelas-alvo (RLS) |
|---|---|---|---|---|---|---|---|---|
| 1 | `dashboard` | Geral | ✅ | ✅ | ✅ | ⚙️ | ⚙️ | `chips`, `system_settings` |
| 2 | `chips` | WhatsApp | ✅ | ✅ | ✅ | ⚙️ | ⚙️ (próprios) | `chips`, `chip_lifecycle_logs` |
| 3 | `whatsapp` | WhatsApp | ✅ | ✅ | ✅ | ⚙️ | ⚙️ | `conversations`, `message_history`, `labels` |
| 4 | `chip_monitor` | WhatsApp | ✅ | ✅ | ✅ | ⚙️ | ❌ | `chips`, `webhook_logs` |
| 5 | `queue` | WhatsApp | ✅ | ✅ | ✅ | ⚙️ | ❌ | `message_queue` |
| 6 | `webhooks` | WhatsApp | ✅ | ✅ | ✅ | ⚙️ | ❌ | `webhook_logs` |
| 7 | `templates` | WhatsApp | ✅ | ✅ | ✅ | ⚙️ | ⚙️ (próprios) | `message_templates` |
| 8 | `quick_replies` | WhatsApp | ✅ | ✅ | ✅ | ⚙️ | ⚙️ (próprios) | `message_shortcuts` |
| 9 | `broadcasts` | WhatsApp | ✅ | ✅ | ✅ | ⚙️ | ⚙️ | `broadcast_campaigns`, `broadcast_recipients`, `broadcast_blacklist` |
| 10 | `settings_warming` | WhatsApp | ✅ | ✅ | ✅ | ⚙️ | ❌ | `system_settings`, `chips` |
| 11 | `warming_reports` | WhatsApp | ✅ | ✅ | ✅ | ⚙️ | ❌ | `chips`, `chip_lifecycle_logs` |
| 12 | `integrations` | WhatsApp | ✅ | ✅ | ✅ | ⚙️ | ❌ | `system_settings`, `bank_credentials` (Meta only) |
| 13 | `users` | Admin | ✅ | ✅ | ✅ | ⚙️ | ❌ | `profiles`, `user_roles` |
| 14 | `permissions` 🔒 | Admin | ✅ | ✅ | ❌ | ❌ | ❌ | `feature_permissions`, `master_feature_toggles` |
| 15 | `audit_logs` 🔒 | Admin | ✅ | ✅ | ✅ | ⚙️ | ❌ | `audit_logs`, `webhook_logs` |
| 16 | `master_admin` 🔒 | Admin | ✅ | ❌ | ❌ | ❌ | ❌ | (acesso a SQL/Export) |
| 17 | `bank_credentials` 🔒 | Admin | ✅ | ✅ | ✅ | ⚙️ | 🔒⚙️ | `bank_credentials` |
| 18 | `tickets` | Admin | ✅ | ✅ | ✅ | ⚙️ | ✅ (próprios) | `support_tickets`, `support_messages` |
| 19 | `internal_chat` | Admin | ✅ | ✅ | ✅ | ⚙️ | ⚙️ | `internal_channels`, `internal_messages`, `internal_channel_members` |
| 20 | `links` | Admin | ✅ | ✅ | ✅ | ⚙️ | ⚙️ | `useful_links` |
| 21 | `remote_assistance` | Admin | ✅ | ✅ | ✅ | ⚙️ | ❌ | `chips`, `conversations` (RLS bypass) |
| 22 | `product_info` | Admin | ✅ | ✅ | ✅ | ⚙️ | ⚙️ | `product_info` |
| 23 | `hr` | Admin | ✅ | ✅ | ✅ | ⚙️ | ❌ | `hr_employees`, `hr_kanban_cards`, `hr_kanban_columns` |
| 24 | `leads` | CRM | ✅ | ✅ | ✅ | ⚙️ | ✅ (próprios) | `client_leads`, `kanban_cards` |
| 25 | `kanban` | CRM | ✅ | ✅ | ✅ | ⚙️ | ⚙️ (próprios) | `kanban_columns`, `kanban_cards` |
| 26 | `performance` | CRM | ✅ | ✅ | ✅ | ⚙️ | ❌ | `commission_sales`, `chips` |
| 27 | `partners` | CRM | ✅ | ✅ | ✅ | ⚙️ | ❌ | `partners` |
| 28 | `contract_template` | CRM | ✅ | ✅ | ✅ | ⚙️ | ❌ | `contract_templates` |
| 29 | `commissions` 🔒 | Comissões | ✅ | ✅ | ✅ | ⚙️ | 🔒⚙️ (próprias) | `commission_sales`, `commission_rates_*`, `commission_settings`, `seller_pix`, `commission_bonus_tiers`, `commission_annual_rewards` |
| 30 | `commissions_v2` 🔒 | Comissões | ✅ | ✅ | ✅ | ⚙️ | 🔒⚙️ (próprias) | `commission_sales_v2`, `commission_rates_*_v2`, `commission_settings_v2`, `seller_pix_v2`, `commission_bonus_tiers_v2`, `commission_annual_rewards_v2` |
| 31 | `commission_reports` 🔒 | Comissões | ✅ | ✅ | ✅ | ⚙️ | 🔒⚙️ | `cr_geral`, `cr_repasse`, `cr_seguros`, `cr_relatorio`, `cr_rules_clt`, `cr_rules_fgts`, `cr_historico_gestao`, `cr_historico_detalhado`, `import_batches` |
| 32 | `corban_dashboard` | Corban | ✅ | ✅ | ✅ | ⚙️ | ❌ | `corban_propostas_snapshot`, `corban_assets_cache` |
| 33 | `corban_propostas` | Corban | ✅ | ✅ | ✅ | ⚙️ | ❌ | `corban_propostas_snapshot` |
| 34 | `corban_fgts` | Corban | ✅ | ✅ | ✅ | ⚙️ | ❌ | `corban_assets_cache` (FGTS), `corban_seller_mapping` |
| 35 | `corban_assets` | Corban | ✅ | ✅ | ✅ | ⚙️ | ❌ | `corban_assets_cache` |
| 36 | `corban_config` | Corban | ✅ | ✅ | ✅ | ⚙️ | ❌ | `corban_feature_config`, `corban_seller_mapping` |
| 37 | `seller_propostas` | Corban (vendedor) | ✅ | ✅ | ✅ | ⚙️ | ✅ (próprias) | `corban_propostas_snapshot` (filtrado) |
| 38 | `seller_fgts` | Corban (vendedor) | ✅ | ✅ | ✅ | ⚙️ | ✅ (próprias) | `corban_assets_cache` (FGTS, próprias) |
| + | `v8_simulador` | V8 | ✅ | ✅ | ✅ | ⚙️ | ⚙️ (próprias) | `v8_simulations`, `v8_batches`, `v8_settings`, `v8_simulation_audit`, `v8_consultas`, `v8_propostas`, `v8_webhooks`, `v8_operacoes`, `v8_contact_pool`, `v8_kpis`, `v8_realtime_status` |

> Total: **38 features padrão + v8_simulador** = 39 itens registrados em `feature_permissions` + `master_feature_toggles`.

---

## 4. Como aplicar uma nova feature

1. Adicionar `feature_key` em `MASTER_FEATURE_TOGGLE_KEYS` e `FEATURE_ROUTE_MAP` (`src/lib/featureRouteMap.ts`).
2. Inserir registro em `feature_permissions` (label + group) e `master_feature_toggles` via migration.
3. Criar policy RLS na(s) tabela(s):
   ```sql
   CREATE POLICY "Feature access view <key>"
     ON public.<table> FOR SELECT TO authenticated
     USING (public.has_feature_access(auth.uid(), '<key>'));
   ```
4. Na página, usar:
   ```tsx
   const { canSee, loading } = useFeatureAccess('<key>');
   if (loading) return <Loader />;
   if (!canSee) return <EmptyStateNoAccess feature="..." />;
   ```
5. Se for sensível: adicionar a `SENSITIVE_FEATURES` em `src/pages/admin/Permissions.tsx`.

---

## 5. Verificação rápida (auditoria)

```sql
-- 1. Toggles globais
SELECT feature_key, is_enabled FROM master_feature_toggles ORDER BY feature_group, feature_label;

-- 2. Permissões por role
SELECT feature_key, allowed_roles, array_length(allowed_user_ids,1) AS users
FROM feature_permissions ORDER BY feature_group, feature_label;

-- 3. Testar acesso de um usuário a uma feature
SELECT public.has_feature_access('<uuid_do_usuario>'::uuid, 'v8_simulador');
```

---

## 6. Histórico de mudanças

- **2026-05-05** — Etapa 1 (RLS), Etapa 2 (UI Permissões), Etapa 3 (hook + gate), Etapa 4 (este documento).
- Próximas: Etapa 5 (testes SQL `has_feature_access_test.sql`) · Etapa 6 (Vitest frontend).
