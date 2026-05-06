# Etapa 7 — Consolidação de qualidade V8

Cinco frentes independentes que podem ser entregues em uma única passada. Cada item é pequeno e seguro.

---

## 1) Paridade real entre `v8-retry-cron` e o teste Vitest

**Problema atual:** o teste `v8ForceDispatch.test.ts` re-implementa a regra à mão, em vez de importar a regra do cron. Se o cron mudar, o teste continua passando — falsa sensação de proteção.

**Solução:**
- Criar módulo compartilhado `supabase/functions/_shared/v8RetryEligibility.ts` exportando `isRetryEligible(sim, now, cfg)` e a constante `RETRIABLE_KINDS`.
- Substituir o filtro inline em `supabase/functions/v8-retry-cron/index.ts` (linhas ~120-138) por uma chamada à nova função.
- Criar `src/lib/__tests__/v8RetryEligibility.parity.test.ts` que **importa diretamente** o mesmo módulo (TS puro, compatível Deno + Node) e cobre os 8 cenários de transição.
- Manter o teste antigo `v8ForceDispatch.test.ts` como teste "high-level" mas adaptado para usar o módulo real.

**Arquivos:** 1 novo shared, 1 edição no cron, 1 novo teste, 1 ajuste no teste existente.

---

## 2) Testes RTL para o bloco "Composição financeira"

**Cobertura:**
- Renderiza com 3 valores presentes (10.847 / 745,84 / 36) → mostra "Total a pagar", "Juros totais", "Markup", "CET" formatados em BRL `R$`.
- Não renderiza quando `released_value` ausente.
- Formatação BRL: separador de milhar `.`, decimal `,`.
- Texto leigo final: "O cliente recebe ... e devolve ..." aparece.

**Arquivo:** `src/components/v8/__tests__/FinancialCompositionBlock.test.tsx`.

**Refator pequeno:** extrair o bloco IIFE de `V8StatusOnV8Dialog.tsx` para um componente puro `FinancialCompositionBlock.tsx` (recebe `released`, `installment`, `installments` por prop). Facilita o teste e mantém o diálogo abaixo do limite de 300 linhas.

---

## 3) Portar `computeFinancialBreakdown` para o servidor + persistir CET

**DB (migração):**
- Adicionar colunas em `v8_simulations`:
  - `total_paid numeric`
  - `total_interest numeric`
  - `markup_pct numeric`
  - `cet_monthly_pct numeric`
  - `cet_annual_pct numeric`
- Função `v8_compute_financial_breakdown(_released, _installment, _installments)` em PL/pgSQL retornando RECORD com os 5 campos (bisseção 80 iterações, igual ao TS).
- Trigger `BEFORE INSERT OR UPDATE ON v8_simulations` que, quando os 3 inputs estiverem presentes e os 5 outputs estiverem NULL, calcula e preenche.
- Backfill: `UPDATE v8_simulations SET ... WHERE released_value IS NOT NULL AND cet_monthly_pct IS NULL`.

**Frontend:** quando as colunas vierem populadas do banco, o `FinancialCompositionBlock` usa direto; senão, faz fallback para `computeFinancialBreakdown` local. Sem regressão.

**Relatórios/ClickSign:** as novas colunas ficam disponíveis para qualquer template `{{CET_MENSAL}}`, `{{TOTAL_PAGO}}`, etc. (pode ser plugado depois sem nova migração).

---

## 4) CI Vitest bloqueando merge

**Arquivo novo:** `.github/workflows/vitest.yml`

```yaml
name: Vitest
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install --frozen-lockfile
      - run: bunx vitest run --reporter=default
```

- Roda **toda** a suíte (não só os 2 arquivos novos) — a memória já lista vários `commission*`, `v8*`, `userTeams*`. Cobertura geral aumenta de graça.
- Falha do job bloqueia merge se a regra de proteção da branch `main` exigir status check (orientar o usuário no checklist).
- Adicionar badge no `README.md` (linha única).

---

## 5) Varredura das pendências das últimas 24h

Itens listados nas etapas 1-6 que ficaram explicitamente como "futuro" e fazem sentido agora:

| # | Origem | Pendência | Recomendação |
|---|--------|-----------|--------------|
| A | Etapa 1 (retry rápido) | Tornar `retry_min_backoff_seconds` configurável via slider na aba Configurações | **Incluir agora** — UI já existe (`V8RetrySettingsCard`), só faltam 4 linhas. |
| B | Etapa 2 (Histórico UI) | Polling adaptativo cair para 10s quando `simulations.length > 0` | **Incluir agora** — micro-edit no `HistoryBatchDetail.tsx`. Reduz egress. |
| C | Etapa 3 (Auto-best) | Toast "Auto-best concluído" com som opcional (já existe `sound_on_complete`) | **Incluir agora** — wiring de 1 useEffect. |
| D | Etapa 4 (force_dispatch) | Telemetria: contar quantas sims foram salvas pelo force_dispatch nas últimas 24h em `V8KpisBar` | **Adiar** — exige nova RPC e card; fora do escopo desta etapa. |
| E | Etapa 5 (reconciliação) | Agendar `v8_force_full_reconciliation` em pg_cron a cada 30 min | **Incluir agora** — 1 INSERT em `cron.schedule`. |
| F | Etapa 6 (composição) | Já coberto pelos itens 2 e 3 acima. | — |

Itens A, B, C, E entram. D fica documentado em `docs/PENDENCIAS.md`.

---

## Detalhes técnicos (resumo de arquivos)

```text
NOVOS
  supabase/functions/_shared/v8RetryEligibility.ts
  src/lib/__tests__/v8RetryEligibility.parity.test.ts
  src/components/v8/FinancialCompositionBlock.tsx
  src/components/v8/__tests__/FinancialCompositionBlock.test.tsx
  .github/workflows/vitest.yml
  supabase/migrations/<ts>_v8_persist_cet.sql
  supabase/migrations/<ts>_v8_cron_full_reconciliation.sql

EDITADOS
  supabase/functions/v8-retry-cron/index.ts            (usa shared)
  src/lib/__tests__/v8ForceDispatch.test.ts            (usa shared)
  src/components/v8/V8StatusOnV8Dialog.tsx             (usa novo bloco)
  src/components/v8/V8RetrySettingsCard.tsx            (slider backoff)
  src/components/v8/nova-simulacao/HistoryBatchDetail.tsx  (polling 10s)
  src/components/v8/nova-simulacao/BatchActionsBar.tsx  (toast+som auto-best)
  README.md                                             (badge CI)
  docs/PENDENCIAS.md                                    (item D)
```

## Ordem de execução

1. Shared eligibility + paridade (1)
2. Migração CET + trigger + backfill (3)
3. RTL + extração do bloco (2)
4. Pendências A/B/C/E (5)
5. Workflow CI (4)

Cada passo é independente; se algo falhar no QA, conseguimos parar entre etapas sem deixar o sistema quebrado.

## O que vai entregar para o usuário

- Garantia automática de que cron e teste nunca divergem.
- 4-6 testes RTL novos cobrindo a UI de composição financeira.
- CET mensal/anual gravado no banco — pronto para contratos e relatórios.
- CI rodando em todo PR, bloqueando merge se vermelho.
- 4 melhorias incrementais "quick win" das pendências abertas.

Pronto para implementar — confirma para eu seguir?
