## Plano — Fix CONSENT_APPROVED + Cancelar lote

Escopo enxuto: 2 frentes só. Rotação de logins V8 fica adiada (próximo plano).

---

### Frente 1 — `active_consult` deixa de ser "falha" e auto-promove quando antiga concluir

**Diagnóstico (linguagem leiga):**

Os CPFs do print **não estão falhando**. Acontece o seguinte:

1. Você dispara consulta para o CPF X.
2. A V8 responde 4xx **"Já existe uma consulta ativa para este CPF"** — porque outra plataforma (ou nós antes) já abriu uma consulta para ele e ela ainda está rodando lá.
3. Hoje o código classifica isso como `error_kind='active_consult'` e **marca a linha como `failed`** (vermelho "falha").
4. Em paralelo, o `v8-active-consult-poller` (cron 1min) busca o status da consulta antiga e grava em `raw_response.v8_status_snapshot` — daí aparece "Status da consulta antiga: CONSENT_APPROVED" no painel.
5. Quando a V8 conclui a consulta antiga, o webhook `consult.updated` chega com `SUCCESS` + `availableMarginValue` + `simulationLimit`. **MAS** o webhook hoje só promove para success se `released_value` e `installment_value` já estavam preenchidos — e nessas linhas órfãs de `active_consult` não estavam. Resultado: webhook chega, atualiza `webhook_status='SUCCESS'` e `margem_valor`, mas **mantém status=failed**. Operador continua vendo vermelho.

**Correções:**

#### 1.1 Novo status visual `waiting_external` (amarelo)

Em `supabase/functions/v8-clt-api/index.ts` (~linha 1592, função `simulate_one`):
- Quando detectar `kind === 'active_consult'`, em vez de inserir com `status='failed'`, inserir com `status='pending'` + `error_kind='active_consult'` + `webhook_status='WAITING_EXTERNAL'`.

Em `src/components/v8/V8ConsultasTab.tsx`, `V8NovaSimulacaoTab.tsx`, `V8HistoricoTab.tsx` (todas as renderizações de status):
- Quando `error_kind='active_consult'` e ainda não promoveu, mostrar badge **amarelo** "aguardando consulta antiga" em vez de "falha".

#### 1.2 Webhook auto-promove `active_consult` usando `simulationLimit`

Em `v8-webhook/index.ts` (linhas 91-152 do `processV8Payload` E o bloco gêmeo no handler principal ~linha 415):
- Quando `internalStatus === 'success'` E `currentRow.error_kind === 'active_consult'` (ou `currentRow.status !== 'success'` mas extras tem `simValueMax`+`simInstallmentsMax`):
  - Promover usando o `simulationLimit` (mesma lógica do `webhook_only`):
    - `released_value = simValueMax`
    - `installments = simInstallmentsMax`
    - `installment_value = simValueMax / simInstallmentsMax`
    - `total_value = simValueMax`
    - `status = 'success'`
    - `error_kind = null`
    - `simulate_status = 'not_started'` (operador pode rodar `/simulate` real depois)
- Quando `internalStatus === 'failed'` E `currentRow.error_kind === 'active_consult'`:
  - Promover para `status='failed'` com `error_message = 'Consulta antiga rejeitada na V8'`.

#### 1.3 Poller também pode promover

Em `supabase/functions/v8-active-consult-poller/index.ts`:
- Quando o snapshot capturado for `SUCCESS` ou `REJECTED`, fazer a mesma promoção que o webhook faria (caso o webhook não chegue).

**Resultado prático:** o operador cola CPFs, vê linhas amarelas "aguardando consulta antiga" — sem precisar fazer nada — e elas **viram verdes automaticamente** assim que a V8 concluir, com margem disponível e parcela estimada já preenchidas.

---

### Frente 2 — Botão "Cancelar lote em andamento"

**Hoje:** se você cola 500 CPFs por engano, o cron continua tentando indefinidamente até esgotar `max_auto_retry_attempts` (15 tentativas/linha). Sem botão de parar.

**Mudança:**

#### 2.1 Schema (migration)

```sql
-- v8_batches.status já existe? Verificar enum/text. Adicionar valor 'canceled' se for enum.
ALTER TABLE v8_batches ADD COLUMN IF NOT EXISTS canceled_at timestamptz;
ALTER TABLE v8_batches ADD COLUMN IF NOT EXISTS canceled_by uuid REFERENCES auth.users(id);
```

#### 2.2 Edge function — nova action `cancel_batch`

Em `v8-clt-api/index.ts`:
- `actionCancelBatch(batchId)`:
  - Verifica que o usuário é dono do lote OU `is_privileged()`.
  - `UPDATE v8_batches SET status='canceled', canceled_at=now(), canceled_by=auth.uid() WHERE id=batchId`.
  - `UPDATE v8_simulations SET status='failed', error_message='Lote cancelado pelo operador', error_kind='canceled' WHERE batch_id=batchId AND status='pending'` (só pending — preserva sucessos já obtidos).
  - Audit log.

#### 2.3 Cron ignora cancelados

Em `v8-retry-cron/index.ts`:
- Filtro `WHERE batch.status != 'canceled'` na query de elegíveis.

Em `v8-active-consult-poller/index.ts`:
- Mesmo filtro.

#### 2.4 UI

Em `V8NovaSimulacaoTab.tsx` (header do bloco "Progresso do Lote") e `V8HistoricoTab.tsx` (cabeçalho de cada lote):
- Botão **"Cancelar lote"** (vermelho outline) visível apenas se `batch.status='processing'` ou existe alguma simulação `pending`.
- Confirmação modal ("Tem certeza? Linhas pendentes serão marcadas como canceladas. Linhas já com sucesso/falha permanecem.").
- Após cancelar, recarregar lista.

---

## Detalhes técnicos

| Arquivo | Mudança |
|---|---|
| `supabase/functions/v8-clt-api/index.ts` | (a) `simulate_one`: `active_consult` insere `status=pending` em vez de `failed`. (b) Nova `actionCancelBatch`. |
| `supabase/functions/v8-webhook/index.ts` | Auto-promoção quando `currentRow.error_kind='active_consult'` E webhook traz SUCCESS com `simulationLimit`. Mesma lógica em ambos os blocos (`processV8Payload` linha ~91 e handler inline ~415). |
| `supabase/functions/v8-active-consult-poller/index.ts` | Auto-promoção espelhando o webhook. Filtro `batch.status != 'canceled'`. |
| `supabase/functions/v8-retry-cron/index.ts` | Filtro `batch.status != 'canceled'`. |
| `src/components/v8/V8ConsultasTab.tsx`, `V8NovaSimulacaoTab.tsx`, `V8HistoricoTab.tsx` | Badge amarelo "aguardando consulta antiga" para `error_kind='active_consult' AND status='pending'`. Botão Cancelar lote. |
| `src/lib/v8ErrorPresentation.ts` | Texto "aguardando consulta antiga concluir na V8" (em vez de "falha"). |
| Migration | `canceled_at`, `canceled_by` em `v8_batches`. |
| Testes | `v8-webhook/payloadSchema_test.ts` ou novo `v8AutoPromote_test.ts`: dado `active_consult` + webhook SUCCESS com simulationLimit, deve promover. |

---

## Antes vs Depois

| Item | Antes | Depois |
|---|---|---|
| CPF com "consulta antiga" | Vermelho "falha" — operador acha que deu errado | Amarelo "aguardando consulta antiga" — operador entende que vai resolver sozinho |
| Quando antiga conclui SUCCESS | Linha continua "failed" mesmo com webhook chegando | Linha vira automaticamente "success" com margem + parcela estimada do simulationLimit |
| Quando antiga conclui REJECTED | Linha continua "failed" (texto antigo) | Linha vira "failed" com motivo claro "Consulta antiga rejeitada" |
| Lote disparado por engano (500 CPFs errados) | Cron tenta 15x cada linha por horas — sem botão de parar | Botão "Cancelar lote" vermelho. Pendentes viram canceladas, sucessos preservados |

## Vantagens / Desvantagens

**Vantagens:** elimina a confusão "está tudo falhando!" (são 90% só aguardando), recupera dados gratuitos da V8 (consulta antiga já paga, vamos aproveitar), dá controle ao operador (cancelar).

**Desvantagens:** linhas amarelas "aguardando" podem ficar dias parecendo abertas se a consulta antiga foi feita por outra plataforma e ela nunca dispara webhook pra gente — o poller precisa estar saudável (já está). Vale revisitar se virar problema.

## Checklist manual de validação

1. Disparar lote com CPFs sabidamente com consulta antiga → confirmar que aparecem **amarelo "aguardando consulta antiga"** (não vermelho).
2. Aguardar webhook V8 chegar → linha vira **verde "sucesso"** com margem e parcela preenchidas, sem clique manual.
3. Disparar lote com 50 CPFs → clicar **Cancelar lote** → confirmar que pendentes viram canceladas e sucessos permanecem.
4. Tentar cancelar lote já completo → botão não aparece.
5. Cron continua processando outros lotes normalmente (não afetou).
6. Modal "Ver detalhes" mostra `webhook_status` correto e snapshot.

## Pendências (futuro)

- **Rotação de múltiplos logins V8** (próximo plano — você precisa me dizer quantas contas extras tem).
- Tela "Aproveitar consulta existente" se quiser disparar manualmente o `/simulate` para uma linha amarela mesmo antes da consulta antiga concluir (hoje só rodaria depois).
- Métrica no painel "X lotes cancelados nos últimos 7 dias".

## Prevenção de regressão

- Teste vitest: `active_consult` insertion vai pra `pending` (não `failed`).
- Teste edge function: webhook SUCCESS sobre linha `error_kind='active_consult'` promove para success com valores do simulationLimit.
- Comentário no `v8-webhook` destacando que `active_consult` é caso especial de promoção via `simulationLimit`.
- Audit log em todo cancelamento de lote (rastreabilidade).
