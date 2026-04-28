
# Plano final — V8 funcionar de verdade

## Como vai funcionar (linguagem leiga)

**Hoje (quebrado)**: lote dispara consulta + simulate juntos → V8 bloqueia por excesso → 0 sucessos reais.

**Depois**:
1. **Lote dispara só consulta de margem** (1 req/CPF) — rápido e barato.
2. Webhook V8 chega com `availableMarginValue` + `simulationLimit` (faixa de valor e parcelas).
3. Sistema preenche tabela mostrando **o MÁXIMO da faixa** (igual sistema antigo do print): "até R$ 43.966 em até 46x".
4. **Toggle no frontend** — checkbox "Simular automaticamente após consulta":
   - **Desligado (default)**: você marca os CPFs aprovados e clica "Simular selecionados" → roda `/simulate` só nos bons.
   - **Ligado**: assim que cada webhook de margem chega, sistema enfileira `/simulate` no fundo (1 a cada 1.2s, sem bloquear).

## Etapa 1 — Tabelas mostrando R$ 0,00 (BAIXO risco, 5 min)

- `v8-clt-api`: enrichment sobe de 60 → 200 itens, concorrência 6 → 8.
- Cache de detail em `v8_operations_local` (30 min) — não paga V8 de novo na 2ª busca.
- Frontend: tooltip "Aguardando detalhe da V8" quando o detail vier vazio.

## Etapa 2 — Reescrita do fluxo de simulação (MÉDIO risco)

### Backend
- **Nova ação `simulate_consult_only`** em `v8-clt-api`: faz só `/consult` + `/authorize`, marca `pending`, salva `consult_id`. Sem polling, sem `/simulate`.
- **`v8-webhook` reforçado**: quando vier SUCCESS, extrai `simulationLimit.{valueMax, installmentsMax}` e popula:
  - `released_value` = `valueMax`
  - `installments` = `installmentsMax`
  - `installment_value` = calculado (estimado pela V8)
  - `total_value` = `valueMax * installmentsMax / installmentsMax` (ou estimativa)
  - `margem_valor` = `availableMarginValue`
- **Nova ação `simulate_selected`**: recebe array de simulation_ids, dispara `/simulate` em fila throttled (1 a cada 1.2s) e atualiza com valores finais reais.
- **Cron `v8-orphan-reconciler`** (a cada 2 min): cruza órfãos (CPF preenchido pela V8) com pending por CPF — recupera os 11.435 órfãos atuais.
- **Migration**: adiciona colunas `simulation_strategy` (`webhook_only` / `legacy_sync`), `auto_simulate_after_consult` (default `false`), `simulate_status` (`not_started` / `queued` / `done`).

### Frontend (`V8NovaSimulacaoTab`)
- Throttle de disparo: 1 CPF a cada 1.2s (200 CPFs = ~4 min de disparo, ~6 min total).
- Checkbox "Simular automaticamente após consulta" (default desligado).
- Coluna nova "Margem disponível" + coluna "Faixa estimada" (até R$ X em até Yx).
- Botão "Simular selecionados" (em massa) — habilitado quando há linhas com margem retornada.
- Botão "Simular linha" individual.
- Badge `simulate_status` (Aguardando, Na fila, Simulado).

### v8_settings novas chaves
- `simulation_strategy` = `webhook_only` (default — pode voltar ao `legacy_sync` se algo der ruim)
- `consult_throttle_ms` = `1200`
- `simulate_throttle_ms` = `1200`
- `webhook_wait_timeout_min` = `5` (depois disso, marca como timeout)

## Detalhes técnicos

```text
LOTE (etapa 2)
  for cada CPF:
    POST /consult + /authorize  (1 req cada, retry só em 429/5xx)
    INSERT v8_simulations status='pending', simulate_status='not_started'
    sleep 1200ms

WEBHOOK V8 chega (~10-20s depois)
  match por consult_id
  status='success'
  released_value = simulationLimit.valueMax
  installments = simulationLimit.installmentsMax
  margem_valor = availableMarginValue
  simulate_status = 'not_started'

  IF auto_simulate_after_consult:
    enfileira para /simulate (throttled)

OPERADOR vê tabela cheia, marca os bons → "Simular selecionados"
  for cada selected:
    POST /simulate (config_id, parcelas, consult_id já existente)
    UPDATE released_value/installment_value/total_value com valores REAIS
    simulate_status = 'done'
    sleep 1200ms
```

## Arquivos afetados

**Etapa 1**:
- `supabase/functions/v8-clt-api/index.ts` (enrichment)

**Etapa 2**:
- Migration: `v8_simulations.simulate_status`, `v8_settings` novas chaves
- `supabase/functions/v8-clt-api/index.ts` (novas ações)
- `supabase/functions/v8-webhook/index.ts` (extrair simulationLimit)
- Nova edge `v8-orphan-reconciler` + pg_cron 2min
- `src/components/v8/V8NovaSimulacaoTab.tsx` (throttle, toggle, botão "Simular selecionados")
- `src/components/v8/V8HistoricoTab.tsx` (coluna simulate_status, botão "Simular linha")

## Confirmação

Aprova rodar **Etapa 1 + Etapa 2 no mesmo turno**? Ou prefere Etapa 1 primeiro e depois Etapa 2?
