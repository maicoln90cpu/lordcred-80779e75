# Matriz de Permissões — LordCred

**Atualizado**: 2026-05-05 (Etapa D — auditoria 38×rotas)

## Resumo da auditoria

- **38 features** cadastradas em `master_feature_toggles` e `FEATURE_ROUTE_MAP`.
- **0 rotas órfãs** (toda chave do toggle aponta para uma rota real).
- **0 features sem toggle** (toda rota mapeada tem entry no toggle).
- **Master/Admin/Manager** (`is_privileged()`) sempre veem tudo, exceto `permissions` que é exclusivo do admin/master.
- **Scopes**: `none` / `menu_only` / `full`. Server-side enforcement via RLS + `has_full_feature_access()` aplicado nas tabelas sensíveis (audit_logs, support_tickets, broadcast_campaigns, broadcast_recipients, bank_credentials, commission_sales_v2).

## Legenda

| Código | Significado |
|---|---|
| ✅ full | Acesso total (vê tudo) |
| 👁 menu_only | Vê o menu mas só dados próprios (filtro server-side) |
| ❌ | Sem acesso |
| 🔒 priv | Apenas privileged (master/admin/manager) por padrão |

## Matriz completa (38 features)

| Feature | Rota | Master | Admin | Manager | Support | Seller |
|---|---|---|---|---|---|---|
| dashboard | `/dashboard` | ✅ | ✅ | ✅ | ✅ | ❌ |
| chips | `/chips` | ✅ | ✅ | ✅ | ✅ | ❌ |
| chip_monitor | `/admin/chip-monitor` | ✅ | ✅ | ✅ | ✅ | ❌ |
| settings_warming | `/settingsaquecimento` | ✅ | ✅ | ✅ | ✅ | ❌ |
| warming_reports | `/admin/warming-reports` | ✅ | ✅ | ✅ | ✅ | ❌ |
| users | `/admin/users` | ✅ | ✅ | ✅ | ✅ | ❌ |
| leads | `/admin/leads` | ✅ | ✅ | ✅ | ✅ | ❌ |
| performance | `/admin/performance` | ✅ | ✅ | ✅ | ❌ | ❌ |
| kanban | `/admin/kanban` | ✅ | ✅ | ✅ | ❌ | ❌ |
| product_info | `/admin/product-info` | ✅ | ✅ | ✅ | ✅ | ❌ |
| commissions | `/admin/commissions` | 🔒 | 🔒 | 🔒 | ❌ | ❌ |
| commission_reports | `/admin/commission-reports` | 🔒 | 🔒 | 🔒 | ❌ | ❌ |
| commissions_v2 | `/admin/commissions-v2` | ✅ | ✅ | ✅ | ❌ | ❌ |
| queue | `/admin/queue` | ✅ | ✅ | ✅ | ✅ | ❌ |
| webhooks | `/admin/webhooks` | ✅ | ✅ | ✅ | ✅ | ❌ |
| templates | `/admin/templates` | ✅ | ✅ | ✅ | ✅ | ✅ |
| quick_replies | `/admin/quick-replies` | ✅ | ✅ | ✅ | ✅ | ✅ |
| tickets | `/admin/tickets` | ✅ | ✅ | ✅ | ✅ | ✅ |
| internal_chat | `/chat` | ✅ | ✅ | ✅ | ✅ | ✅ |
| links | `/admin/links` | ✅ | ✅ | ✅ | ✅ | ❌ |
| remote_assistance | `/admin/remote` | ✅ | ✅ | ✅ | ❌ | ❌ |
| audit_logs | `/admin/audit-logs` | ✅ | ✅ | ✅ | ✅ | ❌ |
| permissions | `/admin/permissions` | 🔒 | 🔒 | ❌ | ❌ | ❌ |
| corban_dashboard | `/admin/corban` | ✅ | ✅ | ✅ | ✅ | ❌ |
| corban_propostas | `/admin/corban/propostas` | ✅ | ✅ | ✅ | ✅ | ❌ |
| corban_fgts | `/admin/corban/fgts` | ✅ | ✅ | ✅ | ✅ | ❌ |
| corban_assets | `/admin/corban/assets` | ✅ | ✅ | ✅ | ✅ | ❌ |
| corban_config | `/admin/corban/config` | ✅ | ✅ | ✅ | ✅ | ❌ |
| seller_propostas | `/corban/propostas` | ✅ | ✅ | ✅ | ✅ | ✅ |
| seller_fgts | `/corban/fgts` | ✅ | ✅ | ✅ | ✅ | ✅ |
| whatsapp | `/whatsapp` | ✅ | ✅ | ✅ | ✅ | ✅ |
| bank_credentials | `/admin/bancos` | ✅ | ✅ | ✅ | ✅ | ❌ |
| partners | `/admin/parceiros` | 🔒 | 🔒 | 🔒 | ❌ | ❌ |
| contract_template | `/admin/parceiros/template` | 🔒 | 🔒 | 🔒 | ❌ | ❌ |
| broadcasts | `/admin/broadcasts` | ✅ | ✅ | ✅ | ❌ | ❌ |
| hr | `/admin/hr` | 🔒 | 🔒 | 🔒 | ❌ | ❌ |
| v8_simulador | `/admin/v8-simulador` | ✅ | ✅ | ✅ | ✅ | ✅ |
| integrations | `/admin/integrations` | ✅ | ✅ | ❌ | ❌ | ❌ |

## RLS server-side (defesa em camadas)

Tabelas com filtro automático por scope (menu_only só vê próprios registros):

| Tabela | Coluna de dono | Função |
|---|---|---|
| `audit_logs` | `user_id` | `has_full_feature_access(uid, 'audit_logs')` |
| `support_tickets` | `created_by` | `has_full_feature_access(uid, 'tickets')` |
| `broadcast_campaigns` | `created_by` | `has_full_feature_access(uid, 'broadcasts')` |
| `broadcast_recipients` | (segue campanha) | apenas scope full |
| `bank_credentials` | (sem dono) | apenas scope full |
| `commission_sales_v2` | `seller_id` | `has_full_feature_access(uid, 'commissions_v2')` |

## Como ajustar permissões

1. Acesse `/admin/permissions` como admin/master.
2. Use o seletor 3-estados por linha (None / Só menu / Acesso total).
3. O master toggle ("Ativo no sistema") só é editável pelo master.
4. Card vermelho no topo aponta inconsistências entre código e banco.

## Pendências futuras

- Aplicar RLS server-side de scope para `client_leads`, `v8_batches`, `corban_propostas_snapshot` quando houver pedido explícito.
- Painel de auditoria mostrando histórico de mudanças em `feature_permissions` (já existe trigger, falta UI dedicada).
