# LordCred — Database Schema

> 40+ tabelas PostgreSQL com RLS habilitado em todas. Organizado por domínio.

---

## Core — Aquecimento e Mensagens

| Tabela | Descrição | Colunas-chave |
|---|---|---|
| `chips` | Instâncias WhatsApp | id, instance_name, instance_token, user_id, status, warming_phase, chip_type, provider, phone_number, is_shared, shared_user_ids, meta_phone_number_id, meta_waba_id |
| `message_queue` | Fila de mensagens pendentes | id, chip_id, recipient_phone, message_content, status, scheduled_at, attempts, priority |
| `message_history` | Histórico de mensagens | id, chip_id, direction, message_content, remote_jid, message_id, media_type, media_url, status, sent_by_user_id, quoted_message_id |
| `message_templates` | Templates de mensagens | id, content, category, is_active |
| `message_shortcuts` | Respostas rápidas (trigger word) | id, trigger_word, response_text, chip_id, user_id, media_type, media_url |
| `external_numbers` | Números externos para aquecimento | id, phone_number, name, is_active |
| `system_settings` | Configurações globais (singleton) | warming_mode, start_hour, end_hour, provider_api_url, etc. |

## CRM — Conversas e Leads

| Tabela | Descrição | Colunas-chave |
|---|---|---|
| `conversations` | Conversas WhatsApp | id, chip_id, remote_jid, contact_name, contact_phone, last_message_at, unread_count, assigned_user_id, label_ids[], is_pinned, is_archived |
| `conversation_notes` | Notas por conversa | id, chip_id, remote_jid, user_id, content |
| `conversation_audit_log` | Auditoria de conversas | id, conversation_id, user_id, action, message_preview, details |
| `message_favorites` | Mensagens favoritadas | id, chip_id, remote_jid, message_id, message_text, user_id |
| `labels` | Etiquetas de conversa | id, chip_id, label_id, name, color_hex |
| `client_leads` | Leads de vendas | id, nome, cpf, telefone, assigned_to, created_by, status, banco_nome, valor_lib, prazo, corban_proposta_id, corban_status, batch_name |
| `kanban_columns` | Colunas do Kanban | id, name, sort_order, color_hex, auto_archive_days |
| `kanban_cards` | Cards do Kanban (1:1 conversations) | id, column_id, conversation_id, sort_order |

## Comissões — Auditoria

| Tabela | Descrição | Colunas-chave |
|---|---|---|
| `cr_relatorio` | Vendas importadas (fonte primária) | id, banco, num_contrato, nome, cpf, valor_liberado, prazo, tabela, seguro, produto, data_pago, vendedor, batch_id |
| `cr_geral` | Produção geral importada | id, banco, cod_contrato, nome_cliente, cpf, prod_liq, cms_rep, prazo, batch_id |
| `cr_repasse` | Dados de repasse importados | id, banco, cod_contrato, nome_cliente, cms_rep, cms_rep_favorecido, favorecido, batch_id |
| `cr_seguros` | Comissões de seguro | id, id_seguro, valor_comissao, tipo_comissao, descricao, batch_id |
| `cr_rules_clt` | Regras de comissão CLT | id, banco, tabela_chave, seguro, prazo_min, prazo_max, taxa, data_vigencia |
| `cr_rules_fgts` | Regras de comissão FGTS | id, banco, tabela_chave, seguro, min_valor, max_valor, taxa, data_vigencia |
| `cr_historico_gestao` | Fechamentos históricos | id, nome, data_inicio, data_fim, qtd_propostas, valor_liberado, comissao_esperada, comissao_recebida, diferenca, created_by |
| `cr_historico_detalhado` | Contratos de cada fechamento | id, gestao_id, banco, num_contrato, nome, valor_liberado, comissao_esperada, comissao_recebida, diferenca |
| `import_batches` | Lotes de importação | id, module, file_name, sheet_name, row_count, imported_by, status |

## Comissões — Parceiros

| Tabela | Descrição | Colunas-chave |
|---|---|---|
| `commission_sales` | Vendas registradas | id, seller_id, bank, product, released_value, sale_date, commission_rate, commission_value, has_insurance, batch_id |
| `commission_settings` | Configurações de comissão | id, bonus_mode, bonus_rate, bonus_fixed_value, monthly_goal_value, week_start_day, payment_day |
| `commission_rates_clt` | Taxas CLT por banco (legado) | id, bank, term_min, term_max, has_insurance, rate, table_key, effective_date |
| `commission_rates_fgts` | Taxas FGTS por banco (legado) | id, bank, rate_no_insurance, rate_with_insurance, effective_date |
| `commission_bonus_tiers` | Tiers de bônus por contratos | id, min_contracts, bonus_value |
| `commission_annual_rewards` | Premiações anuais | id, min_contracts, reward_description, sort_order |
| `seller_pix` | Chaves PIX dos vendedores | id, user_id, pix_key, pix_type |

## Corban — NewCorban

| Tabela | Descrição | Colunas-chave |
|---|---|---|
| `corban_assets_cache` | Cache de assets NewCorban | id, asset_type, asset_id, asset_label, raw_data |
| `corban_feature_config` | Visibilidade de funcionalidades | id, feature_key, feature_label, category, visible_to_sellers, visible_to_support |
| `corban_notifications` | Notificações de propostas | id, user_id, tipo, mensagem, proposta_id, lida |
| `corban_propostas_snapshot` | Snapshot de propostas | id, proposta_id, cpf, nome, banco, status, valor_liberado, vendedor_nome, snapshot_date, snapshot_history |
| `corban_seller_mapping` | Mapeamento vendedor LordCred↔Corban | id, corban_name, user_id, similarity_score |

## Contratos

| Tabela | Descrição | Colunas-chave |
|---|---|---|
| `contract_templates` | Templates de contrato | id, name, content, is_active, is_default, created_by |

## Operacional

| Tabela | Descrição | Colunas-chave |
|---|---|---|
| `profiles` | Perfis de usuário | user_id, email, full_name, is_blocked, created_by |
| `user_roles` | Roles dos usuários | id, user_id, role (app_role enum) |
| `feature_permissions` | Permissões granulares | id, feature_key, feature_label, feature_group, allowed_roles[], allowed_user_ids[] |
| `audit_logs` | Logs de auditoria | id, user_id, user_email, action, target_table, target_id, details |
| `chip_lifecycle_logs` | Eventos de ciclo de vida | id, chip_id, event, details |
| `support_tickets` | Tickets de suporte | id, user_id, subject, description, status, priority |
| `internal_channels` | Canais de chat interno | id, name, is_group, created_by, admin_only_messages |
| `internal_messages` | Mensagens do chat interno | id, channel_id, user_id, content, media_type, media_url |
| `internal_channel_members` | Membros dos canais | id, channel_id, user_id, last_read_at |
| `bank_credentials` | Credenciais bancárias | id, bank_name, username, password, link |

---

## Foreign Keys Principais

```
chips.user_id → (sem FK explícita, mas lógico para profiles.user_id)
message_queue.chip_id → chips.id
message_history.chip_id → chips.id
conversations.chip_id → chips.id
conversation_audit_log.conversation_id → conversations.id
kanban_cards.column_id → kanban_columns.id
kanban_cards.conversation_id → conversations.id (1:1)
cr_geral.batch_id → import_batches.id
cr_repasse.batch_id → import_batches.id
cr_seguros.batch_id → import_batches.id
cr_relatorio.batch_id → import_batches.id
cr_historico_detalhado.gestao_id → cr_historico_gestao.id
commission_sales.batch_id → import_batches.id
corban_seller_mapping.user_id → profiles.user_id
internal_messages.channel_id → internal_channels.id
internal_channel_members.channel_id → internal_channels.id
chip_lifecycle_logs.chip_id → chips.id
message_favorites.chip_id → chips.id
conversation_notes.chip_id → chips.id
```

---

## Funções SQL Importantes

| Função | Tipo | Descrição |
|---|---|---|
| `is_privileged(_user_id)` | SECURITY DEFINER | Retorna true para master, admin, manager |
| `has_role(_user_id, _role)` | SECURITY DEFINER | Verifica role específico (evita recursão RLS) |

---

## Ver Também

- [SYSTEM-DESIGN.md](./SYSTEM-DESIGN.md) — Arquitetura técnica
- [SECURITY.md](./SECURITY.md) — Práticas de segurança e RLS
- [EDGE-FUNCTIONS.md](./EDGE-FUNCTIONS.md) — Funções que acessam o banco

---

## Comissões Parceiros V2 (sandbox — espelho)

| Tabela | Diferença vs V1 |
|---|---|
| `commission_sales_v2` | Trigger `calculate_commission_v2` (FGTS multivariável) |
| `commission_rates_fgts_v2` | **8 colunas**: bank, table_key, term_min, term_max, min_value, max_value, has_insurance, rate, effective_date, obs |
| `commission_rates_clt_v2` | Idêntica ao V1 |
| `seller_pix_v2` | Idêntica ao V1 |
| `commission_settings_v2` | Idêntica ao V1 |
| `commission_bonus_tiers_v2` | Idêntica ao V1 |
| `commission_annual_rewards_v2` | Idêntica ao V1 |

Documentação completa do V2: [COMMISSIONS-V2.md](./COMMISSIONS-V2.md).

---

## Meta WhatsApp — Colunas em `system_settings`

| Coluna | Tipo | Descrição |
|---|---|---|
| `meta_app_id` | text | App ID do Meta for Developers |
| `meta_app_secret` | text | Chave secreta do app |
| `meta_waba_id` | text | WhatsApp Business Account ID |
| `meta_phone_number_id` | text | ID do número de telefone |
| `meta_webhook_verify_token` | text | Token de verificação inventado pelo admin |

Editáveis via tela **Admin → Integrações → Meta WhatsApp**. Edge functions priorizam banco e caem em `Deno.env` se vazio. Detalhes em [META-WHATSAPP-SETUP.md](./META-WHATSAPP-SETUP.md).

📅 Atualizado em: 2026-04-23
