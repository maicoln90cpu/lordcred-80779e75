

# Correção: Snapshot salvando apenas 30 dias

## Problema Encontrado

O botão **"Salvar Snapshot"** (linha 304-351 do `CorbanPropostas.tsx`) **ignora completamente os dados já carregados na tela**. Em vez de salvar os 3.672 registros que você já buscou, ele faz uma **nova consulta à API limitada aos últimos 30 dias** (linhas 307-308):

```text
const dateFromSnap = subDays(new Date(), 30)  ← sempre 30 dias
const dateToSnap = new Date()
```

Por isso só salva 794 — são apenas os registros de cadastro dos últimos 30 dias.

## Como Ficará

O botão "Salvar Snapshot" passará a salvar **todos os registros já carregados na tela** (o array `propostas` que já está em memória), sem fazer uma nova chamada à API. Assim:

- Buscou 3.672 registros na tela? → Salva 3.672 no banco
- Buscou 500 com filtro de CPF? → Salva 500
- O texto do toast mostrará a contagem real: "Snapshot salvo com 3.672 propostas"

## Alteração

**Arquivo:** `src/pages/admin/CorbanPropostas.tsx`

**Antes:** `handleSaveSnapshot` faz nova chamada `invokeCorban('getPropostas', { últimos 30 dias })` e normaliza do zero.

**Depois:** `handleSaveSnapshot` usa o array `propostas` já carregado (state existente). Remove as linhas 307-314 (nova chamada API) e substitui por uma verificação simples: se `propostas.length === 0`, pede para buscar primeiro. O mapeamento para rows (linhas 317-331) permanece idêntico, apenas usando `propostas` em vez de `list`.

## Vantagens
- Salva exatamente o que o usuário vê na tela — sem surpresas
- Mais rápido (não faz segunda chamada à API)
- Sem risco de timeout/WORKER_LIMIT na segunda chamada

## Desvantagens
- Nenhuma significativa. Se o usuário quiser salvar dados de um período diferente, basta buscar primeiro e depois salvar.

## Checklist Manual
- [ ] Buscar propostas com período amplo (ex: 6 meses)
- [ ] Clicar "Salvar Snapshot" e confirmar que o toast mostra a contagem total (ex: 3.672)
- [ ] Verificar no Analytics/Relatório que os dados apareceram

