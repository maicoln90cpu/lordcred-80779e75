## Objetivo
Resolver 4 confusões reportadas na tela `/admin/v8-simulador`: limites V8 invisíveis, "23 meses" enganoso, valor aprovado escondido após a simulação, e parcelas ausentes na tabela "Progresso do Lote".

---

## 1) Mini-painel "Limites V8" ao lado do botão Encontrar proposta viável

**Onde**: `src/components/v8/V8OperacoesTab.tsx` (banner verde quando `successCount > 0`, linhas 469–479) e `src/components/v8/FindBestProposalButton.tsx` (passar dados via prop OU buscar no próprio botão).

**O que fazer**:
- Carregar a última simulação SUCCESS do CPF (já é feita dentro do botão) e expor um pequeno bloco informativo logo ao lado:
  - `Parcelas: 6–36x` (de `sim_installments_min/max`, fallback para `parcelOptions` da config)
  - `Valor: R$ 500–2.908` (de `sim_value_min/max`)
  - `Margem: R$ 80,78` (de `margem_valor`)
- Implementação: criar `V8LimitsBadge` (componente novo, ~40 linhas) que recebe `cpf` e busca uma vez. Aparece à esquerda do botão dentro do mesmo banner verde.
- Tooltip em cada chip explicando a origem ("limite oficial retornado pela V8 nesta consulta").

---

## 2) Por que DANILA mostra "23 meses" se as parcelas padrão são 36/24/12

**Causa raiz**: o subtitle do evento "Simulação" na timeline (`V8OperacoesTab.tsx` linha 267) usa `s.sim_month_max` — esse campo vem do payload V8 e representa o **tempo de admissão/contrato CLT do trabalhador** (em meses), não o número de parcelas. Danila tem 23 meses de empresa.

**Correção**:
- Trocar a fonte do subtitle de `sim_month_max` para `s.installments` (coluna real do nº de parcelas usadas na simulação).
- Renomear o sufixo de "meses" para "x" quando vier de `installments`.
- Adicionar SELECT do campo `installments` no query de timeline (linha 253).
- Quando ainda não há simulação executada (apenas consulta), esconder o sufixo em vez de mostrar lixo.

```ts
// antes
s.sim_month_max === 999 ? '24+ meses' : s.sim_month_max ? `${s.sim_month_max} meses` : null
// depois
s.installments ? `${s.installments}x` : null
```

---

## 3) Renderizar valor aprovado no card após sucesso da simulação

**Hoje**: o card timeline mostra apenas `subtitle` (texto solto) + os botões `JSON · consult · sim_id` do `TimelineEventActions`. O `released_value` está no subtitle mas se perde no meio da string.

**Correção em `V8OperacoesTab.tsx`**:
- Após a linha do `subtitle`, quando o evento é `kind='simulation' && status='success'`, renderizar um bloco destacado verde:

```
┌─────────────────────────────────────────┐
│ ✅ Liberado: R$ 9.029,88                │
│    Parcela:  R$ 250,83 · 24x            │
│    Tabela:   CLT Acelera - Seguro       │
└─────────────────────────────────────────┘
```

- Campos a buscar (acrescentar ao SELECT da linha 253): `released_value, installment_value, installments, company_margin, amount_to_charge`.
- Componente `V8ApprovedSummary` inline (~25 linhas), com tipografia maior (`text-sm font-semibold`) e ícone `CheckCircle2` em verde.

---

## 4) Mostrar parcelas na tabela "Progresso do Lote"

**Onde**: `src/components/v8/V8NovaSimulacaoTab.tsx` linhas 936–1086.

**Correção**:
- Adicionar nova coluna `Parcelas` entre "Status" e "Margem Disp." (ou entre "Liberado" e "Parcela", à escolha).
- Conteúdo: `s.installments ? \`${s.installments}x\` : '—'`
- Header: `<th className="px-2 py-1 text-center" title="Nº de parcelas usadas na simulação">Parcelas</th>`
- Quando `s.installments` for null mas o lote tem `parcelas` configurado (state local), mostrar esse valor em cinza com tooltip "configurado, ainda não simulado".

**Confirmação semântica**: já existe `installments` em `v8_simulations` (preenchido por `simulate_one` linha 1572 e `simulate_only_for_consult` linha 2052 do `v8-clt-api/index.ts`). O hook `useV8BatchSimulations` provavelmente já traz tudo (`select *`); apenas confirmar e usar.

---

## Arquivos a alterar

| Arquivo | Mudança |
|---|---|
| `src/components/v8/V8OperacoesTab.tsx` | Itens 1, 2, 3: SELECT, subtitle, V8ApprovedSummary, slot do banner |
| `src/components/v8/V8LimitsBadge.tsx` (novo) | Item 1: mini-painel de limites |
| `src/components/v8/V8NovaSimulacaoTab.tsx` | Item 4: nova coluna `Parcelas` na tabela |
| `src/hooks/useV8Batches.ts` | (verificação) garantir que `installments` está no SELECT |

---

## Antes vs Depois

| Item | Antes | Depois |
|---|---|---|
| 1 | Operador clica no botão sem saber se a margem cabe | Vê limites V8 oficiais ao lado |
| 2 | "23 meses" confunde (parece prazo do empréstimo) | "24x" fica claro = parcelas |
| 3 | Valor liberado some entre botões `JSON/consult/sim_id` | Card verde destacado com Liberado · Parcela · Nx |
| 4 | Tabela mostra Liberado e Parcela mas não diz em quantas vezes | Coluna "Parcelas" com `24x`, `36x`… |

## Vantagens
- Operador não precisa abrir JSON nem o modal V8 para entender o cenário.
- Reduz erro de "encontrar proposta viável" tentando combinações fora do limite (operador vê antes).
- Paridade visual entre Operações e Nova Simulação.

## Desvantagens / trade-offs
- Mini-painel faz uma query extra por CPF expandido (mitigado: só roda quando a linha é expandida; pode usar o mesmo dado já carregado pelo botão se refatorarmos).
- Card verde aumenta a altura do evento de simulação (aceitável — destaca o que importa).

## Checklist manual de validação
1. Abrir `/admin/v8-simulador → Operações`.
2. Buscar "DANILA" e expandir o card.
3. Verificar mini-painel mostrando: `Parcelas: 6–46x · Valor: R$ X–Y · Margem: R$ 250,83`.
4. Confirmar que o subtitle do evento "Simulação" diz `R$ 3.136,96 • 24x • simulate_only` (não mais "23 meses").
5. Verificar bloco verde "Liberado / Parcela / Tabela" abaixo do título.
6. Ir para "Nova Simulação", abrir um lote existente; conferir nova coluna "Parcelas" mostrando `24x`.

## Pendências
- (futuro, se aprovado) Reutilizar o resultado do `V8LimitsBadge` no `FindBestProposalButton` para evitar dupla query.
- (futuro) Persistir `parcelas` desejadas na criação do lote como default visual quando `installments` ainda é null.

## Prevenção de regressão
- Adicionar comentário explícito acima de `sim_month_max` em `V8OperacoesTab` avisando que NÃO é prazo do empréstimo (evita repetir o bug).
- Estender `src/lib/__tests__/v8FindBestProposal.test.ts` com um teste garantindo que `installments` é a fonte de verdade do prazo (não `sim_month_max`).

---

**Posso seguir com a implementação?**