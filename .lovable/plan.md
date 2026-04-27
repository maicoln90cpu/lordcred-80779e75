# Plano — 5 correções no Simulador V8

## Diagnóstico (o que confirmei lendo o código)

| # | Problema | Causa raiz |
|---|---|---|
| 1 | Tabelas duplicadas no select | A V8 retorna **vários `config_id` (UUIDs) com o mesmo `name`** ("CLT Acelera", "CLT Acelera - Seguro" etc.). O upsert (`onConflict: config_id`) só evita duplicar a mesma UUID — quando a V8 publica configs novas, as antigas continuam no cache para sempre. Já há 4+ linhas hoje. |
| 2 | "Valor liberado/parcela" obrigatório | No frontend (`V8NovaSimulacaoTab` linha 130) e na edge (`actionSimulateOne` linha 649-654) o valor é exigido. Pela doc oficial da V8, o body de `/simulation` aceita **só `consult_id + config_id + number_of_installments + provider`** — `disbursed_amount` e `installment_face_value` são opcionais (a V8 devolve cenários default). |
| 3 | "Aguardando retorno da V8" persiste | No `V8NovaSimulacaoTab` linha 411-412 a UI mostra esse texto sempre que `status === 'pending'`. Quando a V8 já respondeu com erro `active_consult`, a edge **retorna `success: false` mas não atualiza `v8_simulations.status`** — a linha fica `pending` para sempre. (Confirmado: `actionSimulateOne` retorna o erro mas não faz `update` na tabela em caso de falha — só o `simulate_one` no `switch` faz update no caminho de sucesso.) |
| 4 | "Já existe consulta ativa" sem como ver status | A edge tem `list_consults` e `list_operations`, mas não tem uma action **"checar status de 1 CPF específico sem disparar nova consulta"**. Quando a V8 diz "consulta ativa", o operador não tem botão para ver onde está. |
| 5 | Frontend renderiza "aguardando" antes da V8 responder | Mesma causa do #3 — o `pending` da linha não é trocado para `failed` quando a edge retorna erro. O `simulate_one` do switch (linha 1038+) precisa fazer `UPDATE v8_simulations SET status='failed', error_message=..., raw_response=... WHERE id=simulation_id` em **todo** caminho de saída (sucesso e falha). |

---

## Correções (ordem de implementação)

### 1. Limpeza + dedupe das tabelas V8 (Item 1)
**Onde:** `supabase/functions/v8-clt-api/index.ts` → `actionGetConfigs`.

- Antes do upsert, **marcar como inativas todas as configs cujo `config_id` não veio na resposta atual da V8**: `UPDATE v8_configs_cache SET is_active = false WHERE config_id NOT IN (...lista da V8)`.
- O hook `useV8Configs` já filtra `eq('is_active', true)`, então as antigas somem do dropdown automaticamente.
- **Migration de limpeza pontual**: deletar as 4 linhas duplicadas hoje (manter só o `config_id` mais recente por `name`).
- Mudar a label do dropdown para `name + " · " + bank_name` quando houver, para distinguir tabelas com mesmo nome de bancos diferentes.

### 2. Tornar valor opcional (Item 2)
**Onde:** edge `actionSimulateOne` (linhas 649-654) + frontend `V8NovaSimulacaoTab` (linha 130).

- Edge: remover validações de `simulation_mode`/`simulation_value` quando ambos vierem vazios. Ajustar `buildSimulationBodyWithValue` para **omitir** `disbursed_amount`/`installment_face_value` se `simulation_value` não for passado.
- Frontend: adicionar opção "Sem valor (usa default da V8)" no select de tipo de simulação. Quando escolhida, esconde o input de valor e não valida.
- Documentar em `docs/V8-INTEGRATION.md` que o valor é opcional.

### 3. Sempre persistir status final em `v8_simulations` (Itens 3 e 5)
**Onde:** `supabase/functions/v8-clt-api/index.ts` → switch `case "simulate_one"` (linha 1038+).

- Envolver a chamada `actionSimulateOne` para que **independente de sucesso/falha**, faça:
  ```
  UPDATE v8_simulations
  SET status = result.success ? 'success' : 'failed',
      error_message = result.user_message ?? null,
      raw_response = result.raw ?? result,
      processed_at = now(),
      attempt_count = COALESCE(attempt_count,0) + 1,
      last_step = result.step ?? null
  WHERE id = simulation_id
  ```
- Resultado: a linha **nunca mais fica `pending` indefinidamente** quando a V8 já respondeu. O Realtime do `useV8BatchSimulations` atualiza a tela sozinho e o "Aguardando retorno da V8" só aparece se realmente houver webhook pendente.
- No frontend: trocar "Aguardando retorno da V8" por "Aguardando V8 (webhook)" e só mostrar se `status === 'pending' && last_webhook_at IS NULL` por mais de 30s. Senão, mostrar o erro real.

### 4. Botão "Ver status" sem nova simulação (Item 4)
**Onde:** nova action na edge + botão na UI de progresso.

- Nova action `check_consult_status` na edge: aceita `{ cpf }` ou `{ consult_id }`, chama `GET /private-consignment/consult?search={cpf}` e devolve a linha mais recente (status, criado em, motivo).
- Na tabela de progresso do `V8NovaSimulacaoTab`, quando `error_kind === 'active_consult'`, mostrar botão **"Ver status na V8"** que abre dialog com o resultado da action acima — sem disparar nova consulta nem cobrar V8 de novo.
- Na aba "Consultas" já existe a tabela de consultas ativas, então adicionar também um campo de busca por CPF único que dispara essa mesma action.

---

## Arquivos a alterar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/v8-clt-api/index.ts` | actionGetConfigs (dedupe), actionSimulateOne (valor opcional), nova actionCheckConsultStatus, switch `simulate_one` (UPDATE sempre) |
| `supabase/migrations/<novo>.sql` | DELETE das 4 linhas duplicadas em `v8_configs_cache` (mantém o config_id mais recente por name) |
| `src/components/v8/V8NovaSimulacaoTab.tsx` | Opção "sem valor", label "name · bank", botão "Ver status na V8", texto de pending corrigido |
| `src/components/v8/V8ConsultasTab.tsx` | Busca por 1 CPF chamando `check_consult_status` |
| `src/hooks/useV8Operations.ts` | nova função `checkConsultStatus(cpf)` |
| `docs/V8-INTEGRATION.md` | atualizar seção 4.4 e 10 |

---

## Checklist manual após implementação

1. Clicar "Atualizar tabelas V8" 3x → o select continua com **4 entradas distintas** (não cresce).
2. Iniciar simulação **sem preencher valor** → V8 aceita e devolve cenários.
3. Simular um CPF que já tem consulta ativa → linha aparece como **"consulta ativa"** (não fica "aguardando" preso) + botão "Ver status na V8" abre o status real.
4. Simular CPF novo válido → vai para `success` em até 30s.
5. Aba Consultas → buscar por 1 CPF e ver o status sem disparar simulação.

---

## Pendências (não inclusas — sugiro para depois)

- Auto-limpeza periódica de `v8_simulations` órfãs antigas (>90 dias).
- Webhook `private.consignment.consult.updated` já está implementado, mas não há **retry automático** quando o webhook chega antes da edge terminar de gravar o `consult_id`. Pode causar `consult_insert_orphan` desnecessário. Resolver depois.

## Prevenção de regressão

- Teste Vitest puro em `v8-clt-api/payload_test.ts`: dado payload sem `simulation_value`, `buildSimulationBodyWithValue` retorna body **sem** `disbursed_amount`/`installment_face_value`.
- Teste Vitest puro: dado `actionGetConfigs` recebendo lista A→B (B menor), config presente em A mas ausente em B fica `is_active=false`.
