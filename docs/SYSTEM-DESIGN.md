# LordCred — System Design Document

## Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (SPA)                       │
│         React + Vite + TypeScript + Tailwind            │
│              shadcn/ui + Supabase Client                │
└──────────────┬──────────────────────┬───────────────────┘
               │ Auth / DB / Realtime │ Edge Functions
               ▼                     ▼
┌──────────────────────────────────────────────────────────┐
│                      Supabase                            │
│  ┌──────────┐  ┌─────────┐  ┌────────────┐  ┌────────┐ │
│  │PostgreSQL│  │  Auth   │  │  Realtime  │  │Storage │ │
│  │  + RLS   │  │         │  │(WebSocket) │  │        │ │
│  └──────────┘  └─────────┘  └────────────┘  └────────┘ │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Edge Functions (Deno)               │   │
│  │  warming-engine │ queue-processor │ uazapi-api   │   │
│  │  evolution-webhook │ instance-maintenance        │   │
│  │  chip-health-check │ sync-history                │   │
│  │  create-user │ delete-user │ update-user-role    │   │
│  │  corban-api │ corban-status-sync                 │   │
│  └──────────────────────────┬───────────────────────┘   │
└─────────────────────────────┼───────────────────────────┘
               │ HTTP                │ HTTP
               ▼                     ▼
┌──────────────────────┐  ┌──────────────────────┐
│  UazAPI v2 Server    │  │  NewCorban API       │
│  (uazapiGO)          │  │  (propostas/FGTS)    │
└──────────┬───────────┘  └──────────────────────┘
           │ WhatsApp Web Protocol
           ▼
┌──────────────────────────┐
│    WhatsApp Servers       │
└──────────────────────────┘
```

---

## Sistema de Roles e RLS

### 5 Roles

| Role | Frontend | is_privileged() |
|---|---|---|
| `master` | Master | ✅ |
| `admin` | Administrador | ✅ |
| `manager` | Gerente | ✅ |
| `support` | Suporte | ❌ |
| `seller` | Vendedor | ❌ |

### Funções SECURITY DEFINER

```sql
-- Retorna true para master, admin, manager
CREATE FUNCTION is_privileged(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id AND role IN ('master', 'admin', 'manager')
  )
$$;

-- Check role específico (evita recursão RLS)
CREATE FUNCTION has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role
  )
$$;
```

### RLS Pattern

Todas as tabelas usam `is_privileged()` para acesso administrativo, `has_role(auth.uid(), 'support')` para suporte, e `user_id = auth.uid()` ou ownership para acesso individual.

---

## Banco de Dados — Tabelas

### Core

| Tabela | Descrição |
|---|---|
| `chips` | Instâncias WhatsApp (status, fase, tipo, token, phone) |
| `message_queue` | Fila de mensagens pendentes para envio |
| `message_history` | Histórico de todas as mensagens (enviadas e recebidas) |
| `message_templates` | Templates de mensagens gerais |
| `message_shortcuts` | Respostas rápidas (trigger word → resposta) |
| `system_settings` | Configurações globais (singleton) |
| `external_numbers` | Números externos para aquecimento |

### CRM

| Tabela | Descrição |
|---|---|
| `conversations` | Conversas WhatsApp (por chip + remote_jid) |
| `conversation_notes` | Notas por conversa |
| `message_favorites` | Mensagens favoritadas |
| `labels` | Etiquetas de conversa |
| `client_leads` | Leads de vendas |
| `kanban_columns` | Colunas do Kanban |
| `kanban_cards` | Cards do Kanban (1:1 com conversations) |

### Relatório de Comissões

| Tabela | Descrição |
|---|---|
| `cr_geral` | Dados de produção (Geral) — importado via paste |
| `cr_repasse` | Dados de repasse — importado via paste |
| `cr_seguros` | Dados de seguros — importado via paste |
| `cr_relatorio` | Dados de vendas (Relatório) — fonte primária para cálculos |
| `cr_rules_clt` | Regras de comissão CLT (banco, tabela_chave, prazo, seguro, taxa) |
| `cr_rules_fgts` | Regras de comissão FGTS (banco, tabela_chave, valor, seguro, taxa) |
| `cr_historico_gestao` | Fechamentos históricos (totais por período) |
| `cr_historico_detalhado` | Contratos individuais de cada fechamento |
| `import_batches` | Controle de lotes de importação (module, file_name, row_count) |

### Comissões Parceiros

| Tabela | Descrição |
|---|---|
| `commission_sales` | Vendas registradas para comissão |
| `commission_settings` | Configurações de comissão (bônus, semana) |
| `commission_rates_clt` | Taxas CLT por banco (legado, substituído por cr_rules_clt) |
| `commission_rates_fgts` | Taxas FGTS por banco (legado, substituído por cr_rules_fgts) |

### Corban

| Tabela | Descrição |
|---|---|
| `corban_assets_cache` | Cache de assets NewCorban (bancos, convênios, tabelas) |
| `corban_feature_config` | Configuração de visibilidade de funcionalidades por papel |

### Operacional

| Tabela | Descrição |
|---|---|
| `profiles` | Perfis de usuário (email, nome, is_blocked, created_by) |
| `user_roles` | Roles dos usuários (master, admin, manager, support, seller) |
| `feature_permissions` | Permissões granulares por cargo e por usuário |
| `audit_logs` | Logs de auditoria |
| `chip_lifecycle_logs` | Eventos de ciclo de vida dos chips |
| `support_tickets` | Tickets de suporte |
| `internal_channels` | Canais de chat interno |
| `internal_messages` | Mensagens do chat interno |
| `internal_channel_members` | Membros dos canais internos |
| `seller_pix` | Chaves PIX dos vendedores |

---

## Edge Functions — Detalhamento

### `warming-engine`
**Trigger**: Periódico (cron ou manual)
**Fluxo**: Lê settings → busca chips ativos → calcula intervalo dinâmico → aplica variação ±50% → seleciona template → insere em `message_queue`

### `queue-processor`
**Trigger**: Periódico
**Fluxo**: Lê `message_queue` (status=pending, scheduled_at<=now) → busca `instance_token` → envia via UazAPI `/send/text` → atualiza status → registra em `message_history`

### `evolution-webhook` (nome legado, recebe eventos UazAPI)
**Trigger**: Webhook HTTP da UazAPI
**Fluxo**: Recebe evento → identifica chip por `instance_name` → processa (mensagem recebida → `message_history` + `conversations`, status conexão → `chips.status`)

### `uazapi-api`
**Trigger**: Frontend
**Fluxo**: Proxy autenticado para UazAPI (adiciona headers de auth)

### `instance-maintenance`
**Trigger**: Periódico
**Fluxo**: Verifica saúde das instâncias, reconecta se necessário

### `chip-health-check`
**Trigger**: Manual
**Fluxo**: Verifica status de cada chip via UazAPI `/instance/status`

### `sync-history`
**Trigger**: Manual ou periódico
**Fluxo**: Sincroniza histórico de mensagens via UazAPI `/message/find`

### `create-user` / `delete-user` / `update-user-role`
**Trigger**: Admin actions
**Fluxo**: Gerenciamento de usuários via Supabase Admin API

### `corban-api`
**Trigger**: Frontend
**Fluxo**: Proxy autenticado para NewCorban API. Suporta: getPropostas, createProposta, getAssets, getFGTS. Normalização profunda de respostas aninhadas.

### `corban-status-sync`
**Trigger**: pg_cron (periódico)
**Fluxo**: Busca propostas Corban → atualiza `corban_status` nos `client_leads` correspondentes

---

## Fluxos de Dados

### Aquecimento (Warming)

```
warming-engine → message_queue → queue-processor → UazAPI /send/text → WhatsApp
                                                                         │
                                                                    webhook
                                                                         │
                                                           evolution-webhook → message_history
```

### Chat em Tempo Real

```
Frontend (ChatInput) → uazapi-api → UazAPI /send/text → WhatsApp
                                                           │
                                                      webhook
                                                           │
                                              evolution-webhook → message_history
                                                                → conversations
                                                                        │
                                                                   Realtime
                                                                        │
                                                              Frontend (ChatWindow)
```

### Cálculo de Comissão (Commission Reports)

```
Paste Import → cr_relatorio (fonte primária)
             → cr_geral / cr_repasse / cr_seguros (cross-reference)

Cálculo Esperada:
  cr_relatorio.produto = "FGTS"?
    → extractTableKeyFGTS(banco, tabela) → findFGTSRate(banco, key, valor, seguro, data)
  cr_relatorio.produto = "Crédito do Trabalhador"?
    → extractTableKeyCLT(banco, tabela) → findCLTRate(banco, key, prazo, seguro, data)
  → Soma SUMIFS-style (wildcard * + chave específica)

Comissão Recebida:
  Cross-reference por num_contrato/cod_contrato entre cr_relatorio ↔ cr_geral/cr_repasse
  + cr_seguros por batch_id do mesmo período

Resumo:
  Filtra cr_relatorio por data_pago (toSaoPauloDate, range inclusivo)
  Agrupa por banco → totais
```

### Conexão de Chip

```
Frontend → uazapi-api → UazAPI /instance/init → retorna token
                       → UazAPI /instance/connect → gera QR
                       → UazAPI /instance/status → lê QR
                       → UazAPI /webhook → configura callback
```

---

## Realtime Subscriptions

| Canal | Tabela | Usado em |
|---|---|---|
| chips | `chips` | Dashboard, Chips.tsx, ChipMonitor |
| messages | `message_history` | ChatWindow |
| conversations | `conversations` | ChatSidebar |
| queue | `message_queue` | QueueContent |
| kanban | `kanban_cards` | KanbanDialog |
| feature-permissions | `feature_permissions` | useFeaturePermissions |

---

## Configurações do Sistema (`system_settings`)

Tabela singleton com campos agrupados:

- **Provedor**: `whatsapp_provider`, `provider_api_url`, `provider_api_key`, `uazapi_api_url`, `uazapi_api_key`
- **Horário**: `start_hour`, `end_hour`, `timezone`
- **Aquecimento**: `warming_mode`, `is_warming_active`, fases (`messages_day_*`, `days_phase_*`)
- **Proteção**: `typing_simulation`, `read_delay_seconds`, `random_delay_variation`, `consecutive_message_limit`, `cooldown_after_error`, `weekend_reduction_percent`
- **Processamento**: `batch_size`, `batch_pause_seconds`, `max_messages_per_hour`
- **CRM**: `lead_status_options`, `lead_table_columns`, `seller_leads_columns`

> Campos `evolution_api_url`/`evolution_api_key` são legados — ignorar, não deletar.

---

## Convenções de Código

### Frontend
- Componentes em `src/components/` organizados por domínio (`whatsapp/`, `admin/`, `charts/`, `commission-reports/`, `layout/`, `ui/`)
- Páginas em `src/pages/` (admin em `pages/admin/`, corban em `pages/corban/`)
- Hooks customizados em `src/hooks/`
- Contexts em `src/contexts/`
- UI primitivos: shadcn/ui (não customizar diretamente, usar variants)
- Cores: sempre via tokens CSS semânticos (nunca hardcoded)
- Timezone: `America/Sao_Paulo` para todos os cálculos de data em comissões

### Backend (Edge Functions)
- Deno runtime
- CORS headers em todas as respostas
- Autenticação via Supabase service role key
- UazAPI: header `token` (por instância) ou `admintoken` (global)
- Nome `evolution-webhook` mantido por compatibilidade (webhooks já configurados)

---

## Ver Também

- [PRD.md](./PRD.md) — Requisitos do produto
- [ROADMAP.md](./ROADMAP.md) — Fases e prioridades
- [INSTRUCOES.md](./INSTRUCOES.md) — Manual de uso
- [COMMISSION-REPORTS.md](./COMMISSION-REPORTS.md) — Auditoria de comissões
- [corban.md](./corban.md) — Integração NewCorban
- [UAZAPI.md](./UAZAPI.md) — Referência de endpoints UazAPI
- [uazapidoc.md](./uazapidoc.md) — Documentação OpenAPI completa
- [HISTORICO-EVOLUTION-CLEANUP.md](./HISTORICO-EVOLUTION-CLEANUP.md) — Migração Evolution → UazAPI
