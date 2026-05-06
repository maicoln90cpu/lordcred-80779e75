# Diagnóstico + Plano de Correção

## 1) Por que voltaram lotes "a", "b", "c" com CLT Acelera 24x?

**Causa real (confirmada no banco):**
- Os rascunhos "a", "b", "c" estão **salvos no `localStorage`** desde os testes anteriores (nomes personalizados — não auto-gerados).
- A função `ensureBatchName()` só regenera nome quando ele é **vazio ou bate na regex** `Lote DD/MM HH:mm — ...`. Como "a"/"b"/"c" são nomes manuais, foram preservados.
- A migração one-shot `v8:drafts-defaults-migrated-v1` rodou **uma única vez** semanas atrás. Como o flag já está em `localStorage`, novas correções de default (parcelas=48, configId vazio) **não rodaram nesta sessão**. Por isso `parcelas=24` e `configId=CLT Acelera/Seguro` permaneceram do estado antigo.
- Lote "a" (id `85486078…`) saiu como **CLT Acelera - Seguro** porque o rascunho 1 estava com esse `configId` salvo. Os outros ("b","c") estavam com **CLT Acelera** comum.

**Correção:**
- Bumpar a migration flag para `v8:drafts-defaults-migrated-v2` (força re-aplicação dos defaults atuais).
- No `ensureBatchName()`, **sempre prefixar a data/hora** quando o nome for ≤ 3 caracteres OU sem dígitos (heurística de "rascunho temporário"). Resultado: "a" vira "Lote 06/05 22:31 — a".

## 2) Por que os 3 lotes em sequência ficam "aguardando V8" sem processar?

**Causa real (confirmada no banco):**
Os 3 lotes ativos (`a`, `b`, `c` de 22:32–22:33) estão **com `is_paused=true`** desde 01:34 — pausados pelo próprio usuário (`paused_by=69c1cf93…`). 
- `v8-retry-cron` filtra `eq('v8_batches.is_paused', false)` → **nunca retentaria.** ✓ correto
- `v8-active-consult-poller` mesma coisa.
- `v8-scheduled-launcher` idem.

Por isso os CPFs ficam congelados em "aguardando V8" eternamente. **Não é bug do retry — é o lote pausado.**

**Correção:**
- Adicionar **banner vermelho destacado no topo de `BatchProgressTable`** quando `is_paused=true`: "⏸ Lote pausado às HH:mm — nenhum retry rodará. Clique em ▶ Retomar para reativar."
- Adicionar coluna **"Pausado"** no `BatchHistoryPanel` (badge âmbar) para visibilidade.
- Auto-despausar quando `recalculate_all_stuck_v8_batches` é chamado manualmente? **Não** — pausa é intencional. Mas adicionar botão "Retomar todos pausados" no card `V8HealthOrphansCard`.

## 3) Mapa completo de botões manuais no V8 + automatização

| Botão | Local | Já automático? | Plano |
|---|---|---|---|
| **Iniciar Simulação** | Nova Sim → Criar lote | ❌ manual (intencional, é o gatilho) | Manter manual |
| **Adicionar à fila** | Nova Sim → Criar lote | ✅ launcher promove queued→scheduled a cada 1min | OK |
| **▶ Executar todos** (rascunhos) | Nova Sim → tabs rascunhos | ❌ manual | Manter (decisão humana) |
| **Simular selecionados** | Nova Sim → BatchProgressTable | ✅ Auto-melhor faz isso quando `autoBest=true` | Já automático |
| **Reprocessar webhooks pendentes** | Nova Sim → BatchActionsBar | ✅ pg_cron diário `v8-webhook-replay-pending-daily` (06:00) | **Mudar para a cada 30 min** quando há lotes ativos com pending |
| **Encontrar proposta viável** (🔍) | Operações → linha | ✅ `v8-auto-best-worker` (1×/min) processa em background | Já automático |
| **Registrar webhooks na V8** | Webhooks tab | ❌ manual | **Adicionar verificação automática** ao iniciar lote: se webhook_url da V8 ≠ esperada, mostrar toast crítico |
| **Recalcular lotes agora** | Config → V8HealthOrphansCard | ✅ pg_cron `v8-recalculate-stuck-batches-every-5min` + `v8-watchdog-stuck-sims-every-10min` | Já automático — botão é só conveniência |
| **Atualizar tabelas V8** | Nova Sim → Avançadas | ❌ manual | Manter (cache 24h é suficiente) |
| **▶ Retomar lote** (despausar) | (a criar) | ❌ não existe UI | **Criar botão** "Retomar" no header do progress quando paused |

**Resumo do que ficará automático após este plano:**
1. Replay de webhooks pendentes: de 1×/dia para a cada 5 min quando houver `v8_webhook_logs.processed=false`.
2. Verificação do webhook_url V8: ao iniciar lote (toast se URL divergir).

## 4) Por que os números (X) no histórico de lotes demoram para aparecer?

**Causa real:**
- `BatchHistoryPanel` consulta `v8_batches.success_count/failure_count`.
- Esses contadores são atualizados pelo trigger `v8_simulations_after_status_change` que chama `v8_recalc_batch_counters` (full recount).
- Para 18 CPFs, o trigger roda 18× recontando tudo → custa ~200–500ms cada.
- A **realtime do `BatchHistoryPanel`** está escutando `v8_batches`, mas há **debounce + paginação** que pode demorar 2–5s.

**Correção:**
- Trocar a função `v8_recalc_batch_counters` (usada em loop) por **incrementos atômicos** `v8_increment_batch_success/failure` — já existem mas não são usadas no trigger de status change.
- Reduzir o debounce do realtime no `BatchHistoryPanel` de 1000ms para 300ms.

## 5) Por que o auto-retry diz "ativo" mas nunca faz a 2ª tentativa?

**Causa real (combinação de fatores):**
1. **Lotes pausados** (problema #2) → retry cron pula tudo. As 3 linhas de "b" e "a-seguro" mostram `attempt_count=1` e `error_kind=analysis_pending` — entrariam no retry, mas estão presas pela pausa.
2. **Lote "a" (não pausado)** mostra `attempt_count=2` em 2 das 3 linhas — está retentando normalmente. A 3ª linha já virou `success`. Ou seja, **funciona quando não está pausado**.
3. **Texto "(de até 3)" vs `max_auto_retry_attempts=5`** — `BatchProgressTable.tsx:301` mostra `maxAutoRetry` que vem de `v8_settings.max_auto_retry_attempts=5`, mas a captura mostra "de até 3". Isso é porque `retry_max_backoff_seconds=30s` + tempo curto desde criação = poucas tentativas tiveram chance. Texto está correto, só passou pouco tempo.

**Correção:**
- Banner pause (item 2) já resolve a percepção.
- Tooltip do contador: "Próxima tentativa em X segundos" calculado de `last_attempt_at + retry_min_backoff_seconds`.

---

## Resumo das mudanças (técnicas)

### Frontend (`src/`)
1. `src/components/v8/V8NovaSimulacaoTab.tsx`
   - Bump migration flag `v8:drafts-defaults-migrated-v2` → re-aplica defaults sensatos em rascunhos sem lote ativo.
   - `ensureBatchName()`: regenera nome quando ≤3 chars OU sem `Lote dd/mm`.
2. `src/components/v8/nova-simulacao/BatchProgressTable.tsx`
   - Banner vermelho "⏸ Lote pausado" no topo + botão **▶ Retomar lote**.
   - Tooltip "Próxima tentativa em Xs" no contador de tentativas.
3. `src/components/v8/nova-simulacao/BatchHistoryPanel.tsx`
   - Coluna/badge "Pausado".
   - Reduzir debounce realtime para 300ms.
4. `src/components/v8/V8HealthOrphansCard.tsx`
   - Adicionar stat "Lotes pausados" + botão "Retomar todos pausados sem atividade há +1h".

### Backend (Edge Functions / DB)
5. **Nova edge function** `v8-webhook-replay-frequent` (a cada 5 min via pg_cron) — só dispara se há `v8_webhook_logs.processed=false` recentes.
6. **Migration**: trocar trigger `v8_simulations_after_status_change` para usar `v8_increment_batch_success/failure` (incremento atômico) em vez de `v8_recalc_batch_counters` (full recount). Manter recalc só no watchdog.
7. **Migration**: cron job `v8-resume-stale-paused-batches-daily` — sugere (NÃO força) retomada de lotes pausados há +24h via toast (apenas log; despausar é decisão humana).

### Sem mudança
- `v8-retry-cron` está correto (pula pausados — comportamento desejado).
- `v8-auto-best-worker` está correto.
- `recalculate_all_stuck_v8_batches` está correto.

## Prevenção de regressão
- Teste vitest para `ensureBatchName()`: garante que "a", "ab", " " sempre regeneram com data/hora.
- Teste vitest para `BatchProgressTable`: snapshot do banner quando `is_paused=true`.

## Pendências (futuro, não agora)
- Migrar todo trigger de contagem para deltas atômicos (já parcial).
- UI de "histórico de pausas" por lote.

**Aprova para eu implementar?**