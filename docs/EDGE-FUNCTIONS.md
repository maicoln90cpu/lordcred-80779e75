# LordCred — Edge Functions Catalog

> 18 Edge Functions (Deno runtime). Todas com `verify_jwt = false` no config.toml.
> Autenticação validada internamente via Supabase service role key ou JWT manual.

---

## Aquecimento

### `warming-engine`
- **Trigger**: Periódico (cron ou manual)
- **Fluxo**: Lê settings → busca chips ativos → calcula intervalo dinâmico → aplica variação ±50% → seleciona template → insere em `message_queue`
- **Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### `queue-processor`
- **Trigger**: Periódico
- **Fluxo**: Lê `message_queue` (status=pending, scheduled_at<=now) → busca `instance_token` → envia via UazAPI `/send/text` → atualiza status → registra em `message_history`
- **Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

---

## WhatsApp — UazAPI

### `evolution-webhook`
- **Trigger**: Webhook HTTP da UazAPI (nome legado, NÃO renomear)
- **Fluxo**: Recebe evento → identifica chip por `instance_name` → processa (mensagem recebida → `message_history` + `conversations`, status conexão → `chips.status`)
- **Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### `uazapi-api`
- **Trigger**: Frontend
- **Fluxo**: Proxy autenticado para UazAPI (adiciona headers de auth)
- **Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### `instance-maintenance`
- **Trigger**: Periódico
- **Fluxo**: Verifica saúde das instâncias, reconecta se necessário
- **Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### `chip-health-check`
- **Trigger**: Manual
- **Fluxo**: Verifica status de cada chip via UazAPI `/instance/status`
- **Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### `sync-history`
- **Trigger**: Manual ou periódico
- **Fluxo**: Sincroniza histórico de mensagens via UazAPI `/message/find`
- **Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

---

## WhatsApp — Meta Business API

### `whatsapp-gateway`
- **Trigger**: Frontend
- **Fluxo**: Proxy para Meta WhatsApp Business API. Envia mensagens via chips com provider=meta.
- **Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### `meta-webhook`
- **Trigger**: Webhook HTTP da Meta
- **Fluxo**: Recebe eventos do WhatsApp Business → processa mensagens recebidas → `message_history` + `conversations`
- **Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `META_VERIFY_TOKEN`

---

## Gestão de Usuários

### `create-user`
- **Trigger**: Admin actions (frontend)
- **Fluxo**: Cria usuário via Supabase Admin API → insere profile + role
- **Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### `delete-user`
- **Trigger**: Admin actions
- **Fluxo**: Deleta usuário via Supabase Admin API (cascade)
- **Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### `update-user-role`
- **Trigger**: Admin actions
- **Fluxo**: Atualiza role na tabela `user_roles`
- **Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

---

## Corban — NewCorban

### `corban-api`
- **Trigger**: Frontend
- **Fluxo**: Proxy autenticado para NewCorban API. Suporta: getPropostas, createProposta, getAssets, listQueueFGTS, insertQueueFGTS. Normalização profunda de respostas aninhadas.
- **Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CORBAN_API_URL`, `CORBAN_USERNAME`, `CORBAN_PASSWORD`, `CORBAN_EMPRESA`

### `corban-status-sync`
- **Trigger**: pg_cron (periódico)
- **Fluxo**: Busca propostas Corban → atualiza `corban_status` nos `client_leads` correspondentes
- **Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CORBAN_*`

### `corban-snapshot-cron`
- **Trigger**: pg_cron (periódico)
- **Fluxo**: Busca todas as propostas → salva/atualiza em `corban_propostas_snapshot` com histórico de mudanças de status
- **Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CORBAN_*`

---

## Contratos — ClickSign

### `clicksign-api`
- **Trigger**: Frontend
- **Fluxo**: Proxy para ClickSign API. Cria documento, adiciona signatário, envia para assinatura.
- **Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLICKSIGN_API_KEY`

### `clicksign-webhook`
- **Trigger**: Webhook HTTP da ClickSign
- **Fluxo**: Recebe eventos de assinatura → atualiza status do contrato
- **Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

---

## Broadcasts

### `broadcast-sender`
- **Trigger**: Periódico (cron) ou manual
- **Fluxo**: Busca campanhas running/scheduled → verifica `scheduled_date` → para cada destinatário pendente: envia via UazAPI (`/send/text`, `/send/image` ou `/send/document` conforme `media_type`) → atualiza status → aplica rate limiting entre mensagens
- **Secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

---

## Configuração (`supabase/config.toml`)

Todas as funções usam `verify_jwt = false` — a validação é feita internamente via service role key ou JWT manual do Supabase client.

---

## Ver Também

- [SYSTEM-DESIGN.md](./SYSTEM-DESIGN.md) — Arquitetura
- [SECURITY.md](./SECURITY.md) — Auth e segurança
- [UAZAPI.md](./UAZAPI.md) — Endpoints UazAPI
- [corban.md](./corban.md) — Integração NewCorban
