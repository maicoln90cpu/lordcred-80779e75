## Diagnóstico dos 3 problemas

### Problema 1 — Erro no payload (`v8_sim_owner_or_orphan`)
A imagem `image-452.png` mostra o erro:
```
new row for relation "v8_simulations" violates check constraint "v8_sim_owner_or_orphan"
```
O webhook recebe um evento de consulta cujo `consult_id` não existe na nossa tabela (CPF criado direto na V8, fora do simulador). O código tenta inserir uma linha "órfã", mas **esquece** de marcar `is_orphan: true` no segundo handler (linhas 405-422 de `supabase/functions/v8-webhook/index.ts`). A constraint exige `is_orphan=true OR (batch_id IS NOT NULL AND created_by IS NOT NULL)`, então o INSERT é rejeitado e o evento fica perdido.

A função interna `processV8Payload` (usada pelo replay) já marca corretamente — só o handler principal está com a regressão.

**Correção**: adicionar `is_orphan: true` no INSERT do handler principal, idêntico ao replay.

### Problema 2 — Tela "Nova Simulação" mostra tudo "em análise / 0 tentativas" enquanto V8 ainda não respondeu
Comparando as imagens:
- `image-451.png` (durante o disparo): todos pendentes, 0 tentativas, "Aguardando retorno da V8"
- `image-453.png` (depois): mostra `failed` com motivo correto ("Limite de requisições excedido")

A informação ESTÁ chegando, só que durante o disparo a linha fica em `pending` por N segundos até a edge `simulate_one` retornar. O usuário quer que a UI deixe claro que está **processando** (ainda não tem veredito), e não "em análise" (que parece status final).

**Correção**: 
- Renomear o badge `pending` (sem `last_attempt_at`) para **"processando"** com ícone giratório (não "em análise")
- Manter "em análise" só quando a V8 explicitamente responder `WAITING_*`
- Coluna "Tentativas" mostrar `attempt_count` real após retorno

### Problema 3 — Auto-retry até 15 tentativas para falhas temporárias
Hoje cada CPF roda **1 vez**. Erros `temporary_v8` (rate limit / 5xx) e `analysis_pending` ficam parados esperando o usuário clicar em "Retentar falhados" manualmente.

O usuário quer que o sistema, ao terminar a primeira passada, **reentregue automaticamente** as falhas retentáveis em background, até atingir um limite (proposto: **15 tentativas por CPF**), com backoff entre rodadas para não amplificar o rate limit da V8.

---

## Plano de implementação

### Etapa 1 — Fix do webhook (`v8-webhook/index.ts`)
1. No handler principal (linha ~407), adicionar `is_orphan: true` no objeto INSERT (idêntico ao `processV8Payload`).
2. Centralizar o branch órfão em uma função única para eliminar a duplicação que causou a regressão.
3. Quando o INSERT órfão falhar por outro motivo, gravar `process_error` no `v8_webhook_logs` para visibilidade no painel de Diagnóstico.

### Etapa 2 — UX da Nova Simulação (`V8NovaSimulacaoTab.tsx`)
1. Em `getSimulationStatusLabel`:
   - `status === 'pending'` **sem** `last_attempt_at` → **"processando"** (azul, com `Loader2` girando)
   - `status === 'pending'` **com** `last_attempt_at` E `webhook_status` em WAITING_* → **"em análise"** (cinza)
   - `status === 'pending'` **com** `last_attempt_at` mas sem webhook → **"aguardando V8"** (cinza claro)
2. Texto da coluna "Observação" em modo `processando` muda para: *"Disparando consulta na V8…"* (deixa claro que ainda nem chamamos).
3. Coluna "Tentativas" passa a renderizar em negrito quando ≥ 2.

### Etapa 3 — Auto-retry com limite de 15 tentativas
Adicionar constante `MAX_AUTO_RETRY_ATTEMPTS = 15` (centralizada num único arquivo importado pelo front).

Fluxo no `handleStart` (e reaproveitado em `handleRetryFailed`):
1. Após a primeira passada (todos os CPFs disparados uma vez), entrar em loop:
   ```
   while (existem failed retentáveis com attempt_count < 15):
     aguardar backoff (10s, 20s, 40s, máx 120s)
     re-disparar apenas os retentáveis
   ```
2. Critérios para "retentável" continuam os mesmos (já implementados em `isRetriableErrorKind`):
   - kind ∈ `{temporary_v8, analysis_pending}`
   - `attempt_count < 15`
3. Não retentar `active_consult`, `existing_proposal`, `invalid_data` — esses precisam de ação humana.
4. Toast de progresso a cada rodada: *"Rodada 3/15 · 4 CPFs ainda instáveis"*.
5. Botão **"Parar auto-retry"** durante o loop (substitui temporariamente o "Iniciar Simulação").

### Etapa 4 — Cobertura de testes (Vitest)
1. Em `v8WebhookGuard.test.ts`: adicionar caso "INSERT órfão DEVE marcar is_orphan=true" como teste de regressão (puro, valida a função extraída).
2. Em `v8ErrorClassification.test.ts`: confirmar que `attempt_count >= 15` desliga retentativa (novo helper `shouldAutoRetry(kind, attemptCount)`).

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/v8-webhook/index.ts` | Fix `is_orphan: true`, deduplicar branch órfão |
| `src/components/v8/V8NovaSimulacaoTab.tsx` | UI "processando", loop auto-retry, botão parar |
| `src/lib/v8ErrorClassification.ts` | Constante `MAX_AUTO_RETRY_ATTEMPTS=15`, helper `shouldAutoRetry` |
| `src/lib/__tests__/v8ErrorClassification.test.ts` | Casos de auto-retry com cap 15 |
| `src/lib/__tests__/v8WebhookGuard.test.ts` | Regressão `is_orphan` |

---

## Antes vs Depois

| Item | Antes | Depois |
|---|---|---|
| Webhook órfão | Falha com check constraint, evento perdido | Insere com `is_orphan=true`, log marcado processed |
| Status durante disparo | "em análise" (parece final) | "processando" com spinner, deixa claro que V8 ainda não respondeu |
| Falhas temporárias | 1 tentativa, parado até clique manual | Auto-retry com backoff até 15× |

## Vantagens / Desvantagens
**+** Zero perda de webhooks órfãos · UX honesta · Recovery automático de rate limit
**−** Lote demora mais quando muitos CPFs falham temporariamente (mas dentro do limite de 15× × 120s ≈ 30min worst-case) · Mais carga na V8 em janelas de instabilidade (mitigado pelo backoff exponencial)

## Pendências (futuro, não nesta leva)
- Mover o loop de auto-retry para uma edge function em background (libera o navegador)
- Tornar `MAX_AUTO_RETRY_ATTEMPTS` configurável em `v8_settings`
- Persistir histórico de cada tentativa em `v8_simulation_attempts` para auditoria fina

## Prevenção de regressão
- Teste Vitest cobrindo `is_orphan=true` no insert órfão
- Teste cobrindo cap de 15 tentativas
- Comentário em `v8-webhook` apontando para a função única (evita duplicar branch de novo)

**Aprova para eu implementar?**
