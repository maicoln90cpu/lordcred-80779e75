# Plano — 2 correções na aba Nova Simulação

## Problema 1 — Motivo ainda diz "clique em Simular selecionados" depois do Auto-melhor

### Causa
A edge `v8-clt-api` (action `simulate_only_for_consult`) grava `simulate_status = "done"` em sucesso. Mas o front (`BatchProgressTable.tsx:376` e `useV8BatchOperations.ts:243`) compara contra `"success"`. Então:

- Edge grava `"done"` → front lê como ≠ `"success"` e ≠ `"failed"` → cai no `else` final (linha 408) e mostra **"Margem aprovada — clique em Simular selecionados…"**, mesmo o lote já tendo rodado.
- O Auto-melhor (`src/lib/v8AutoBest.ts`) **não grava** `simulate_status='success'` no caminho de sucesso (só grava `'failed'` quando esgota). O sucesso depende inteiramente do que a edge gravou — que é `"done"`, valor que o resto do app não reconhece.

Existem 3 valores soltos hoje: `"success"` (esperado), `"done"` (gravado pela edge), `"not_started" | "failed"`. Inconsistência clara.

### Correção
1. **`supabase/functions/v8-clt-api/index.ts` (linha 3305)**: trocar `"done"` por `"success"` — alinha com o resto do código (`v8BatchExport.ts`, `BatchProgressTable.tsx`, `V8NovaSimulacaoTab.tsx`, `useV8BatchOperations.ts` que filtra candidatos por `!== 'done'` mas exibe por `=== 'success'`).
2. **`src/lib/v8AutoBest.ts`**: no retorno `success`, gravar explicitamente `simulate_status='success'` + `simulate_attempted_at` antes do return — defesa em profundidade caso a edge falhe em atualizar.
3. **`src/hooks/useV8BatchOperations.ts:243`**: mudar filtro de `!== 'done'` para `!== 'success'` (mantém comportamento, alinha com novo padrão).
4. **Migração SQL one-shot**: `UPDATE v8_simulations SET simulate_status='success' WHERE simulate_status='done'` para corrigir linhas históricas (lotes já rodados continuam com motivo errado até o backfill).

Resultado: linhas que tiveram proposta calculada passam a mostrar **"Proposta calculada"** em verde.

## Problema 2 — THAYNA com `active_consult` parou em 1 tentativa

### Causa
`src/lib/v8ErrorClassification.ts:92` — `RETRIABLE_ERROR_KINDS` inclui apenas `temporary_v8` e `analysis_pending`. O kind `active_consult` está **explicitamente excluído** (comentário linhas 87-88: "o cliente já tem consulta ativa, retentar gera mais erro").

Mas no print da THAYNA o erro real foi **"Falha ao disparar a consulta para a V8 (timeout/erro de rede)"** — ou seja, `dispatch_failed` no front (`useV8BatchOperations.ts:183`), que **não é retentável** pelo cron nem pelo Auto-retry. E mesmo que a V8 tenha retornado depois `active_consult`, o classificador também não retenta.

Resultado: linha trava em 1 tentativa final, mesmo com slot de retry disponível (max=15).

### Correção
1. **`src/lib/v8ErrorClassification.ts`**: adicionar `dispatch_failed` ao enum `V8ErrorKind` e ao `RETRIABLE_ERROR_KINDS` — falha de rede/timeout no dispatch é tipicamente transitória e merece backoff.
2. **`active_consult` continua não-retentável** (correto — abriria nova consulta paralela na V8). Em vez disso, **melhorar a UI**: na coluna Tentativas, mostrar `1` sem o sufixo `(final)` para `active_consult`, e adicionar tooltip explicando "Não retenta: cliente já tem consulta ativa na V8 — aguarde o resultado da consulta original ou cancele-a no painel V8."
3. **`supabase/functions/v8-clt-api/index.ts` (`detectV8ErrorKind`)**: espelhar a mesma adição de `dispatch_failed` (regra "se mudar aqui, mude lá" do header do arquivo).
4. **Backfill opcional**: linhas atuais com `error_kind='dispatch_failed'` e `attempt_count < max` ficam elegíveis automaticamente para o próximo cron (`v8-retry-cron` lê o classificador).

## Arquivos tocados
- `supabase/functions/v8-clt-api/index.ts` (2 trocas: `"done"`→`"success"` + `detectV8ErrorKind`)
- `src/lib/v8AutoBest.ts` (gravação explícita de sucesso)
- `src/lib/v8ErrorClassification.ts` (novo kind retentável)
- `src/hooks/useV8BatchOperations.ts` (filtro `!== 'success'`)
- `src/components/v8/nova-simulacao/BatchProgressTable.tsx` (tooltip `active_consult`)
- Nova migração: backfill `simulate_status`

## Testes
- `src/lib/__tests__/v8ErrorClassification.test.ts` — adicionar caso `dispatch_failed` retentável.
- Manual: rodar lote, clicar Simular selecionados, verificar coluna Motivo virar "Proposta calculada".
