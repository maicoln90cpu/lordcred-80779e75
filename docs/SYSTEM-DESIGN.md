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
│  └──────────────────────────────┬───────────────────┘   │
└─────────────────────────────────┼───────────────────────┘
                                  │ HTTP
                                  ▼
                    ┌──────────────────────────┐
                    │      UazAPI v2 Server    │
                    │     (uazapiGO)           │
                    └────────────┬─────────────┘
                                 │ WhatsApp Web Protocol
                                 ▼
                    ┌──────────────────────────┐
                    │    WhatsApp Servers       │
                    └──────────────────────────┘
```

---

## Banco de Dados — Tabelas Principais

### Core

| Tabela | Descrição |
|---|---|
| `chips` | Instâncias WhatsApp (status, fase, tipo, token, phone) |
| `message_queue` | Fila de mensagens pendentes para envio |
| `message_history` | Histórico de todas as mensagens (enviadas e recebidas) |
| `warming_messages` | Templates de aquecimento |
| `message_templates` | Templates de mensagens gerais |
| `system_settings` | Configurações globais (singleton) |

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

### Operacional

| Tabela | Descrição |
|---|---|
| `profiles` | Perfis de usuário (email, nome, is_blocked) |
| `user_roles` | Roles dos usuários (admin, user, seller, support) |
| `audit_logs` | Logs de auditoria |
| `webhook_logs` | Logs de webhooks recebidos |
| `chip_lifecycle_logs` | Eventos de ciclo de vida dos chips |
| `support_tickets` / `ticket_messages` | Tickets de suporte |
| `internal_channels` / `internal_messages` / `internal_channel_members` | Chat interno |
| `useful_links` | Links úteis do sistema |
| `external_numbers` | Números externos para aquecimento |

---

## Edge Functions — Detalhamento

### `warming-engine`
**Trigger**: Chamado periodicamente (cron ou manual)
**Fluxo**:
1. Lê `system_settings` para obter configurações (horário, limites, modo)
2. Busca chips ativos com `warming_phase` adequada
3. Calcula intervalo dinâmico baseado em mensagens restantes / horas restantes
4. Aplica variação aleatória de ±50%
5. Seleciona template da tabela `warming_messages` usando cursor global
6. Insere mensagem na `message_queue`
7. Registra em `audit_logs`

### `queue-processor`
**Trigger**: Chamado periodicamente
**Fluxo**:
1. Lê `system_settings` para `provider_api_url` / `provider_api_key`
2. Busca mensagens pendentes na `message_queue` (status = 'pending', scheduled_at <= now)
3. Para cada mensagem:
   - Busca `instance_token` do chip
   - Envia via UazAPI `POST /send/text` com header `token`
   - Atualiza status para 'sent' ou 'failed'
   - Registra em `message_history`
   - Atualiza `messages_sent_today` no chip

### `evolution-webhook` (nome legado, recebe eventos UazAPI)
**Trigger**: Webhook HTTP da UazAPI
**Fluxo**:
1. Recebe evento da UazAPI (message received, status update, connection change)
2. Identifica chip pela `instance_name`
3. Processa conforme tipo de evento:
   - **Mensagem recebida**: Insere em `message_history`, atualiza `conversations`
   - **Status de conexão**: Atualiza `chips.status`
   - **Mensagem enviada**: Atualiza status em `message_history`
4. Registra em `webhook_logs`

### `uazapi-api`
**Trigger**: Chamado pelo frontend
**Fluxo**: Proxy autenticado para a UazAPI. O frontend envia requests, a edge function adiciona headers de autenticação e encaminha.

### `instance-maintenance`
**Trigger**: Periódico
**Fluxo**: Verifica saúde das instâncias, reconecta se necessário, configura webhooks.

### `chip-health-check`
**Trigger**: Manual (botão no frontend)
**Fluxo**: Verifica status de cada chip via UazAPI `/instance/status`.

### `sync-history`
**Trigger**: Manual ou periódico
**Fluxo**: Sincroniza histórico de mensagens via UazAPI `/message/find`.

### `create-user` / `delete-user` / `update-user-role`
**Trigger**: Admin actions
**Fluxo**: Gerenciamento de usuários via Supabase Admin API.

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

### Conexão de Chip

```
Frontend → uazapi-api → UazAPI /instance/init → retorna token
                       → UazAPI /instance/connect → gera QR
                       → UazAPI /instance/status → lê QR
                       → UazAPI /webhook → configura callback
```

---

## Sistema de Autenticação e Roles

### Fluxo de Auth

```
Login → Supabase Auth → JWT → onAuthStateChange
                                    │
                              checkUserRole()
                                    │
                         user_roles table → role
                         profiles table → is_blocked
```

### RLS (Row Level Security)

- Todas as tabelas possuem RLS habilitado
- Função `has_role(_user_id, _role)` é `SECURITY DEFINER` para evitar recursão
- Policies baseadas em `auth.uid()` e `has_role()`
- Chips: usuários veem apenas seus próprios chips
- Messages: acesso via chip ownership
- Leads: sellers veem apenas leads atribuídos a si

---

## Realtime Subscriptions

| Canal | Tabela | Usado em |
|---|---|---|
| chips | `chips` | Dashboard, Chips.tsx, ChipMonitor |
| messages | `message_history` | ChatWindow |
| conversations | `conversations` | ChatSidebar |
| queue | `message_queue` | QueueContent |
| kanban | `kanban_cards` | KanbanDialog |

---

## Configurações do Sistema (`system_settings`)

Tabela singleton com campos agrupados:

- **Provedor**: `whatsapp_provider`, `provider_api_url`, `provider_api_key`, `uazapi_api_url`, `uazapi_api_key`
- **Horário**: `start_hour`, `end_hour`, `timezone`
- **Aquecimento**: `warming_mode`, `is_warming_active`, fases (`messages_day_*`, `days_phase_*`)
- **Proteção**: `typing_simulation`, `read_delay_seconds`, `random_delay_variation`, `consecutive_message_limit`, `cooldown_after_error`, `weekend_reduction_percent`
- **Processamento**: `batch_size`, `batch_pause_seconds`, `max_messages_per_hour`
- **CRM**: `lead_status_options`, `lead_table_columns`

---

## Convenções de Código

### Frontend
- Componentes em `src/components/` organizados por domínio (`whatsapp/`, `admin/`, `charts/`, `layout/`, `ui/`)
- Páginas em `src/pages/` (admin em `pages/admin/`)
- Hooks customizados em `src/hooks/`
- Contexts em `src/contexts/`
- UI primitivos: shadcn/ui (não customizar diretamente, usar variants)
- Cores: sempre via tokens CSS semânticos (nunca hardcoded)

### Backend (Edge Functions)
- Deno runtime
- CORS headers em todas as respostas
- Autenticação via Supabase service role key
- UazAPI: header `token` (por instância) ou `admintoken` (global)

---

## Ver Também

- [PRD.md](./PRD.md) — Requisitos do produto
- [ROADMAP.md](./ROADMAP.md) — Fases e prioridades
- [INSTRUCOES.md](./INSTRUCOES.md) — Manual de uso
- [UAZAPI.md](./UAZAPI.md) — Referência de endpoints UazAPI
- [uazapidoc.md](./uazapidoc.md) — Documentação OpenAPI completa
- [HISTORICO-EVOLUTION-CLEANUP.md](./HISTORICO-EVOLUTION-CLEANUP.md) — Migração Evolution → UazAPI
