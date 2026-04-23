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
│  │              Edge Functions (18)                 │   │
│  │  warming-engine │ queue-processor │ uazapi-api   │   │
│  │  evolution-webhook │ instance-maintenance        │   │
│  │  chip-health-check │ sync-history │ broadcast-sender │
│  │  create-user │ delete-user │ update-user-role    │   │
│  │  corban-api │ corban-status-sync                 │   │
│  │  corban-snapshot-cron │ whatsapp-gateway         │   │
│  │  meta-webhook │ clicksign-api │ clicksign-webhook│   │
│  └──────────────────────────┬───────────────────────┘   │
└─────────────────────────────┼───────────────────────────┘
          │ HTTP              │ HTTP              │ HTTP
          ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────┐
│ UazAPI v2 Server │ │ NewCorban API    │ │ ClickSign    │
│ (uazapiGO)       │ │ (propostas/FGTS) │ │ (contratos)  │
└────────┬─────────┘ └──────────────────┘ └──────────────┘
         │ WhatsApp Web Protocol
         ▼
┌──────────────────────────┐
│    WhatsApp Servers       │
└──────────────────────────┘
```

---

## Sistema de Roles e RLS

> Ver detalhes completos em [SECURITY.md](./SECURITY.md)

### 5 Roles

| Role | Frontend | is_privileged() |
|---|---|---|
| `master` | Master | ✅ |
| `admin` | Administrador | ✅ |
| `manager` | Gerente | ✅ |
| `support` | Suporte | ❌ |
| `seller` | Vendedor | ❌ |

---

## Banco de Dados

> Schema completo em [DATABASE-SCHEMA.md](./DATABASE-SCHEMA.md)

O banco possui **40+ tabelas** organizadas em 6 domínios: Core, CRM, Comissões, Corban, Contratos e Operacional.

---

## Edge Functions

> Catálogo completo em [EDGE-FUNCTIONS.md](./EDGE-FUNCTIONS.md)

17 edge functions Deno com CORS headers, autenticação via Supabase service role key.

---

## Hooks Modulares (15)

| Hook | Responsabilidade |
|---|---|
| `useChatMessages` | Mensagens do chat (fetch, paginação, busca, real-time) |
| `useChatActions` | Ações de chat (envio texto/mídia, marcar lido, status) |
| `useConversations` | Lista de conversas (fetch, filtros, seleção) |
| `useInternalChat` | Chat interno (canais, mensagens, membros) |
| `useInternalChatUnread` | Contagem de não-lidos no chat interno |
| `useLeadsData` | Dados de leads (fetch, sellers, constantes) |
| `useKanban` | Kanban (colunas, cards, drag & drop) |
| `useCorbanFeatures` | Visibilidade de features Corban |
| `useFeaturePermissions` | Permissões granulares (cache 5min + realtime) |
| `useRealtimeSubscription` | Hook genérico para Supabase Realtime (debounce) |
| `useRealtimeChips` | Realtime para chips |
| `useRealtimeMessages` | Realtime para mensagens |
| `useMessageCache` | Cache de mensagens |
| `use-mobile` | Detecção de dispositivo móvel |
| `use-toast` | Notificações toast |

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

### Cálculo de Comissão

> Detalhes em [COMMISSION-REPORTS.md](./COMMISSION-REPORTS.md)

```
Paste Import → cr_relatorio (fonte primária)
             → cr_geral / cr_repasse / cr_seguros (cross-reference)

Comissão Esperada = extractTableKey* → findRate* (SUMIFS-style)
Comissão Recebida = cross-reference por num_contrato/cod_contrato
```

### Conexão de Chip (UazAPI)

```
Frontend → uazapi-api → UazAPI /instance/init → retorna token
                       → UazAPI /instance/connect → gera QR
                       → UazAPI /instance/status → lê QR
                       → UazAPI /webhook → configura callback
```

### Contratos Digitais (ClickSign)

```
Frontend → clicksign-api → ClickSign API → cria documento + signatário
                                                    │
                                              assinatura
                                                    │
                                          clicksign-webhook → atualiza status
```

---

## Realtime Subscriptions

| Canal | Tabela | Usado em |
|---|---|---|
| chips | `chips` | Dashboard, Chips.tsx, ChipMonitor |
| messages | `message_history` | ChatWindow (useChatMessages) |
| conversations | `conversations` | ChatSidebar (useConversations) |
| queue | `message_queue` | QueueContent |
| kanban | `kanban_cards` | KanbanDialog (useKanban) |
| feature-permissions | `feature_permissions` | useFeaturePermissions |
| internal-messages | `internal_messages` | useInternalChat |

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

## Ver Também

- [PRD.md](./PRD.md) — Requisitos do produto
- [ROADMAP.md](./ROADMAP.md) — Fases e prioridades
- [DATABASE-SCHEMA.md](./DATABASE-SCHEMA.md) — Schema completo do banco
- [SECURITY.md](./SECURITY.md) — Práticas de segurança
- [EDGE-FUNCTIONS.md](./EDGE-FUNCTIONS.md) — Catálogo de edge functions
- [CODE-STANDARDS.md](./CODE-STANDARDS.md) — Padrões de código
- [INSTRUCOES.md](./INSTRUCOES.md) — Manual de uso
- [COMMISSION-REPORTS.md](./COMMISSION-REPORTS.md) — Auditoria de comissões
- [corban.md](./corban.md) — Integração NewCorban
- [UAZAPI.md](./UAZAPI.md) — Referência UazAPI

---

## Comissões Parceiros — V1 vs V2 (isolamento)

```
┌─────────────────────────────┐         ┌─────────────────────────────┐
│ V1 (produção, intocado)     │         │ V2 (sandbox)                │
│  /admin/commissions         │         │  /admin/commissions-v2      │
│  commission_sales           │ ──────▶ │  commission_sales_v2        │
│  commission_rates_fgts      │ (3 cols)│  commission_rates_fgts_v2   │ (8 cols)
│  commission_rates_clt       │ ──────▶ │  commission_rates_clt_v2    │
│  seller_pix                 │ ──────▶ │  seller_pix_v2              │
│  commission_settings        │ ──────▶ │  commission_settings_v2     │
│  commission_bonus_tiers     │ ──────▶ │  commission_bonus_tiers_v2  │
│  commission_annual_rewards  │ ──────▶ │  commission_annual_rewards_v2│
│  trigger calculate_commission│         │  trigger calculate_commission_v2 │
└─────────────────────────────┘         └─────────────────────────────┘
       Lookup FGTS antigo                  Lookup FGTS multivariável
       (3 colunas)                         (banco+tabela+prazo+valor+seguro)
```

Botões no V2 (`BaseTab`): **📋 Copiar V1→V2** (insert em batches, trigger recalcula) e **🗑️ Limpar V2** (delete sales).

Detalhes em [COMMISSIONS-V2.md](./COMMISSIONS-V2.md).

---

## Meta WhatsApp — Credenciais editáveis

Padrão "config via banco com fallback secret":

```
┌──────────────────────────┐
│ Tela: Admin → Integrações│
│ → Meta WhatsApp           │
│ (5 campos editáveis)      │
└────────────┬──────────────┘
             ▼
┌──────────────────────────┐
│ system_settings (DB)      │
│ meta_app_id               │
│ meta_app_secret           │
│ meta_waba_id              │
│ meta_phone_number_id      │
│ meta_webhook_verify_token │
└────────────┬──────────────┘
             ▼
┌──────────────────────────┐
│ Edge Function lê:         │
│  1º banco                 │
│  2º Deno.env (fallback)   │
└──────────────────────────┘
```

Permite trocar credenciais sem redeploy. Detalhes em [META-WHATSAPP-SETUP.md](./META-WHATSAPP-SETUP.md).

📅 Atualizado em: 2026-04-23
