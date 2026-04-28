## Objetivo

Tornar a **margem disponível do trabalhador** (campo `availableMarginValue` da V8) visível e acionável no LordCred — hoje ela fica escondida no JSON bruto. Adicionalmente, criar um **glossário visual de status V8** para o operador entender o ciclo de vida sem precisar abrir documentação.

---

## Escopo

### 1. Extrair e persistir a margem disponível

- Adicionar coluna **`available_margin_value`** (numeric, nullable) em `v8_simulations`.
- Atualizar a Edge Function `v8-active-consult-poller` e o webhook `v8-webhook` para extrair `availableMarginValue` do payload da V8 (procurando em múltiplos caminhos possíveis: `consult.result.availableMarginValue`, `data.availableMarginValue`, `availableMargin`, `marginValue`) e gravar na coluna nova.
- Backfill: rodar uma query única que percorre `v8_simulations.raw_response` existente e popula a coluna para registros antigos com `status='success'`.

### 2. Tornar visível na UI

- **Tabela do Histórico** (`V8HistoricoTab`) e **aba Consultas** (`V8ConsultasTab`): adicionar coluna **"Margem Disponível"** formatada em R$/mês, com ordenação clicável (usando o padrão `useSortState`).
- **Modal "Ver status na V8"** (`V8StatusOnV8Dialog`): adicionar bloco em destaque no topo da seção "Resultado da Consulta":
  ```text
  ┌─────────────────────────────────────────┐
  │ 💰 Margem disponível                    │
  │     R$ 412,30 / mês                     │
  │     (teto de parcela CLT consignável)    │
  └─────────────────────────────────────────┘
  ```
- Tooltip explicando que é o valor livre mensal do trabalhador junto ao averbador, **não** a Margem LordCred.

### 3. Glossário de status V8 (novo)

Criar componente `V8StatusGlossary` (popover acionado por ícone "?" no header das abas Histórico, Consultas e Nova Simulação) com tabela leiga:

| Status | Significado | Próxima ação |
|---|---|---|
| `WAITING_CONSENT` | Termo criado, aguardando autorização interna | Aguardar (sistema autoriza sozinho) |
| `CONSENT_APPROVED` | Termo autorizado, V8 consultando averbador | Aguardar resultado |
| `SUCCESS` | Consulta concluída com margem disponível | Rodar simulação |
| `REJECTED` | Cliente sem margem ou inelegível | Descartar lead |
| `WAITING_*` (outros) | Etapas intermediárias da V8 | Aguardar |
| `temporary_v8` | Instabilidade/rate limit da V8 | Retentar (botão) |
| `analysis_pending` | V8 ainda processando | Aguardar / Buscar resultados pendentes |
| `active_consult` | Já existe consulta ativa para o CPF | Buscar resultado existente |

### 4. Documentação

- Atualizar `docs/V8-INTEGRATION.md` com:
  - Seção dedicada **"Margem Disponível vs Margem LordCred"** (tabela comparativa).
  - Glossário de status (mesmo conteúdo do popover).
- Atualizar memória `mem://features/v8-margin-display` (criar) com a regra: margem disponível sempre exposta em coluna + destaque no modal.

---

## Detalhes técnicos

- **Migração SQL**: `ALTER TABLE v8_simulations ADD COLUMN available_margin_value numeric;` + backfill `UPDATE` lendo `raw_response->'consult'->'result'->>'availableMarginValue'` (com COALESCE entre 4–5 caminhos).
- **Edge Functions afetadas**: `v8-webhook/index.ts`, `v8-active-consult-poller/index.ts`, `v8-clt-api/index.ts` (para garantir que extrai e grava em todos os pontos onde recebe payload V8).
- **Frontend**: `V8HistoricoTab.tsx`, `V8ConsultasTab.tsx`, `V8StatusOnV8Dialog.tsx`, novo `V8StatusGlossary.tsx`.
- **Helper puro**: `extractAvailableMargin(rawResponse)` em `src/lib/v8MarginExtractor.ts` + teste Vitest cobrindo os 4–5 caminhos possíveis (prevenção de regressão).
- Sem mudança em `types.ts` (regenerado automaticamente após migração).

---

## Antes vs Depois

- **Antes**: margem disponível só visível abrindo modal → "Payload bruto (JSON)" → expandindo nós até achar o campo. Status `WAITING_CONSENT`/`CONSENT_APPROVED` sem explicação na UI.
- **Depois**: margem em coluna ordenável + destaque visual no modal. Glossário acessível por ícone "?" em todas as abas.

## Vantagens

- Operador prioriza leads pela margem em segundos (ordenando coluna).
- Reduz erro de confundir Margem LordCred (5% interno) com margem do cliente.
- Glossário evita perguntas recorrentes sobre status V8.

## Desvantagens / trade-offs

- +1 coluna na tabela do Histórico (já está densa) — mitigação: posicionar logo após "Status" e antes de "Liberado".
- Backfill toca todos os registros `success` existentes (única vez, query rápida).

## Checklist manual (pós-implementação)

1. Rodar uma nova consulta CLT com CPF válido → confirmar que a margem aparece na coluna assim que vira `SUCCESS`.
2. Abrir modal "Ver status na V8" → confirmar destaque do bloco margem no topo.
3. Clicar no ícone "?" no header → confirmar que o glossário abre e está legível.
4. Ordenar coluna "Margem Disponível" decrescente → confirmar que leads de maior margem sobem.
5. Verificar registros antigos no Histórico → confirmar que o backfill preencheu a coluna.

## Pendências (futuro, fora deste escopo)

- Filtro por faixa de margem (ex.: "mostrar só leads com margem > R$ 300").
- Exportar Histórico para Excel já com a coluna margem.
- Alerta automático quando margem cai abaixo de threshold configurável.

## Prevenção de regressão

- Teste Vitest em `extractAvailableMargin()` cobrindo os 5 formatos de payload conhecidos da V8.
- Memória `mem://features/v8-margin-display` registrando a decisão (evita futura remoção da coluna por engano).
