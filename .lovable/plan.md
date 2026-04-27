# Plano — 4 correções no Simulador V8 (continuação Etapa B)

## Diagnóstico (confirmado em código + banco)

Rodei `SELECT` em `v8_simulations` dos últimos 2 dias. Os achados batem com o que você relatou:

| # | Sintoma | Causa raiz |
|---|---|---|
| 1 | "Aguardando retorno da V8" mesmo com erro `active_consult` | A linha está `failed` + `kind=active_consult`, mas a UI **só** troca o texto se `status !== 'pending'`. Quando o webhook V8 chega depois com `WAITING_*` ele **rebaixa** para `pending` (override no `v8-webhook` linhas 105/343) — voltando a mostrar "Aguardando V8". |
| 2a | "A idade excedeu o limite máximo" | Erro **legítimo** da V8 — produto tem teto de idade (CLT Acelera não aceita aposentado/idoso). Não é bug, mas hoje fica camuflado no balão genérico. |
| 2b | "Já existe consulta ativa" | Você já tem botão **"Ver status na V8"** implementado (Etapa anterior), mas só aparece quando `status !== 'pending'`. Se o webhook rebaixa para pending, o botão somem. |
| 3a | Items "success" sem valor liberado/parcela | **BUG GRAVE confirmado no banco**: linhas com `status='success'` têm `released_value=NULL` + `error_message="Limite de requisições excedido"`. O `v8-webhook` recebe um evento posterior com `status=SUCCESS` (ou `CONSENT_APPROVED`) **referente apenas à autorização da consulta**, não à simulação financeira, e sobrescreve `status` sem trazer valores. A simulação de fato falhou (rate limit 429 da V8). |
| 3b | "Tentativas = 1" para todos | A edge faz `attempt_count = max(input, 1)`. O frontend só dispara **1x** por CPF (`workers` em `handleStart`). Não há retry automático — só o `MAX_RETRIES_SIMULATE=15` interno do passo `simulate`, que **não** retenta o `consult` quando ele falha por rate limit. |
| 4a | Frontend não atualiza com dados frescos | Realtime já está ligado (`useV8BatchSimulations` escuta postgres_changes filtrado por `batch_id`). O problema é a regra de exibição: `status==='pending'` → mostra texto fixo. Precisa olhar `last_webhook_at` + `error_message` para decidir. |
| 4b | "Sucesso" sem valor no histórico | Mesmo bug do 3a — webhook sobrescreve status sem checar consistência. |

---

## Correções (ordem de implementação)

### 1. Proteção no `v8-webhook` (CAUSA RAIZ do "success sem valor")

**Arquivo:** `supabase/functions/v8-webhook/index.ts`

Hoje, quando a V8 envia `status=SUCCESS` referente à *autorização da consulta*, o webhook sobrescreve `v8_simulations.status` mesmo se a simulação local já está `failed` por outro motivo (rate limit, idade, etc).

Mudança: o webhook **só promove** uma linha para `success` se ela tiver `released_value IS NOT NULL` E `installment_value IS NOT NULL`. Caso contrário, mantém o status anterior e grava só `webhook_status` + `last_webhook_at` + `raw_response` (auditoria preservada). Aplicar nas duas funções (`processV8Payload` e o handler inline).

Também: nunca **rebaixar** de `failed` → `pending`. Se o status local já é `failed`, manter — só atualizar `webhook_status` para auditoria.

### 2. UI — exibir o erro real mesmo quando status='pending' rebaixado

**Arquivo:** `src/components/v8/V8NovaSimulacaoTab.tsx` (linha 443-444)

Hoje:
```ts
{s.status === 'pending' ? (
  <span>Aguardando retorno da V8 (via webhook)</span>
) : ...
```

Trocar para:
- Se `status==='pending'` **E** `error_message` existe → mostrar o erro (com guidance) em vez de "Aguardando".
- Se `status==='pending'` **E** `last_webhook_at` está vazio E passou >60s do `processed_at` → mostrar "Aguardando V8 há Xs · Webhook não chegou ainda" + botão **"Ver status na V8"**.
- Se `kind==='active_consult'` em qualquer status (não só `failed`) → mostrar mensagem amarela + botão "Ver status na V8".

### 3. Edge — não rebaixar `failed` → `pending` no `actionSimulateOne`

**Arquivo:** `supabase/functions/v8-clt-api/index.ts` (linhas 1236-1254)

Hoje, quando `step==='consult_status'` retorna `analysis_pending`, gravamos `status='pending'` mesmo se a tentativa anterior já foi `failed`. Mudança: ler o status atual antes do update; se já for `failed` e o erro novo for `analysis_pending`, manter `failed` e só anexar info ao `raw_response`.

### 4. Detectar rate limit (HTTP 429) como `temporary_v8` retentável

**Arquivo:** `supabase/functions/v8-clt-api/index.ts` — `detectV8ErrorKind` (linha 166)

Hoje só classifica `>=500` como `temporary_v8`. Adicionar:
- `status === 429` → `temporary_v8` + guidance "V8 com rate limit".
- Texto "limite de requisições excedido" → `temporary_v8`.

E no `v8FetchWithRetry` (linha 88): aceitar 429 também como retentável (hoje só 5xx). Backoff 2s/5s/10s. Isso resolve grande parte das falhas do lote da Etapa B.

### 5. UI — botão "Reprocessar pendentes" no card de progresso

**Arquivo:** `V8NovaSimulacaoTab.tsx`

Botão chama `replay_pending` (já existe na edge `v8-webhook`) que reprocessa os logs não processados dos últimos 7 dias. Útil quando você desconfia que o webhook chegou mas a linha não atualizou. Texto auxiliar: "Use isto se as linhas ficarem em 'aguardando' por mais de 2 minutos".

### 6. Resposta direta para suas 4 perguntas (sem código)

**(1)** Como consultar manualmente sem abrir nova simulação?
→ Use o botão **"Ver status na V8"** que aparece em qualquer linha com `kind=active_consult` (após correção 2). Ele chama `check_consult_status` (já existe), faz `GET /private-consignment/consult?search={cpf}` e mostra status + data. Sem custo extra na V8.

**(2)** Erro "idade excedeu o limite":
→ É regra do produto V8. CLT Acelera não atende cliente acima de uma idade-teto (não documentado publicamente, mas observado em ~70 anos). Solução operacional: tentar outra tabela. Não há fix técnico — é regra de negócio da V8.

**(3)** "Sucesso" sem valor + 1 tentativa:
→ É o bug do webhook (correção 1). Após o fix, esses items aparecerão com o status real `failed` + erro de rate limit. Sobre tentativas: o sistema **não** retenta automaticamente entre lotes — após correção 4, o `consult` será retentado em rate limit. Para retentar manualmente, sugiro adicionar (Etapa futura) um botão "Retentar falhados" no card de progresso.

**(4)** Front esperando mas V8 já respondeu:
→ Após correção 1, o frontend mostra o status real (failed/success com valores) assim que a edge termina. Realtime já dispara o re-render automaticamente — o problema era o webhook **regredir** o status.

---

## Arquivos a alterar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/v8-webhook/index.ts` | Não promover `success` sem valores; nunca rebaixar `failed`→`pending`; aplicar em `processV8Payload` E no handler inline |
| `supabase/functions/v8-clt-api/index.ts` | `detectV8ErrorKind`: 429 → temporary_v8; `v8FetchWithRetry`: retentar 429; switch `simulate_one`: não rebaixar status no caminho `consult_status` |
| `src/components/v8/V8NovaSimulacaoTab.tsx` | Lógica de exibição: respeitar `error_message` mesmo em pending; botão "Ver status na V8" também em pending com active_consult; botão "Reprocessar pendentes" |

---

## Checklist manual após implementação

1. Rodar lote pequeno (5 CPFs) com 1 conhecidamente "active_consult" → linha aparece **amarela** com botão "Ver status na V8" mesmo se webhook chegar depois.
2. Linha que falhou por idade → mostra **"A idade excedeu o limite máximo"** sem ser camuflada por "aguardando".
3. Lote grande (50 CPFs) que estoure rate limit V8 → linhas marcadas como `temporary_v8` com guidance "tente em alguns minutos", **não** mais "success" sem valor.
4. Aguardar 5min após lote → nenhuma linha com `status=success` E `released_value=NULL`.
5. Botão "Reprocessar pendentes" → chama `replay_pending`, reprocessa logs órfãos.

---

## Pendências (não inclusas — sugiro depois)

- **Botão "Retentar falhados"** no card de progresso para re-disparar items com `kind ∈ {temporary_v8, analysis_pending}` (não retentar `active_consult` ou `invalid_data`).
- **Limpeza retroativa**: rodar `UPDATE v8_simulations SET status='failed' WHERE status='success' AND released_value IS NULL` para corrigir o histórico já contaminado pelo bug do webhook (criar migration explícita após sua aprovação).
- **Documentar idade-teto** em `docs/V8-INTEGRATION.md` quando descobrir o valor exato.

---

## Prevenção de regressão

- Teste Vitest puro novo em `supabase/functions/v8-clt-api/payload_test.ts`:
  - `detectV8ErrorKind({status: 429})` → `'temporary_v8'`.
  - `detectV8ErrorKind({rawText: 'Limite de requisições excedido'})` → `'temporary_v8'`.
- Teste Vitest novo `v8WebhookGuard.test.ts` (função pura extraída):
  - Dado linha local com `released_value=null`, payload V8 com `status=SUCCESS` → resultado **não** promove para success.
  - Dado linha local `failed`, payload V8 com `WAITING_CONSULT` → resultado **não** rebaixa para pending.

Aprova para eu implementar?