## Contexto
O caso Gabriele (CPF 02676066056) revelou 2 problemas reais e 1 melhoria estratégica:

1. **Bug**: o Select "Parcelas" da Nova Simulação **NÃO é respeitado** no auto-simulate em lote — usa o `installments` salvo no momento da criação do lote, não o valor atual da tela. Por isso a Gabriele rodou em 36x mesmo com 24x selecionado.
2. **UX confusa**: o campo "Parcelas" parece decorativo porque sua influência só aparece em simulação manual.
3. **Gap competitivo**: o outro sistema do usuário **descobre automaticamente** uma combinação `valor + prazo` que caiba na margem disponível e devolve uma proposta pronta. Hoje o LordCred exige que o operador adivinhe valores até bater.

---

## Bloco A — Corrigir uso da parcela escolhida (bug fix)

**Antes**: `auto_simulate_after_consult` usa `sim.installments` (do lote) e ignora o `parcelas` atual da tela.

**Depois**: priorizar `parcelas` da tela para o lote ativo. Se o usuário trocou de 36 para 24, o auto-simulate respeita.

**Arquivos**: `src/components/v8/V8NovaSimulacaoTab.tsx` (linhas 199, 311, 534, 611 — substituir `sim.installments || parcelas` por `parcelas || sim.installments` quando o lote ativo é o atual).

**Risco**: baixo. Lotes antigos sem parcelas continuam usando default.

---

## Bloco B — Botão "Buscar melhor combinação" (paridade com concorrente)

Após uma consulta SUCCESS com `simulate_status=failed`, exibir botão **"🔍 Encontrar proposta viável"** no card do CPF.

**Comportamento**:
1. Lê `margem_valor`, `sim_value_min`, `sim_value_max`, `sim_month_min` do registro.
2. Roda binary search local (sem chamar V8 ainda): para cada prazo aceito pela tabela (`number_of_installments`), calcula valor máximo cuja parcela ≤ margem usando taxa estimada da config.
3. Pega a melhor combinação (maior valor liberado) e dispara **uma única simulação real V8** com esses parâmetros.
4. Se V8 confirmar SUCCESS, atualiza o card.

**Vantagem**: 1 chamada V8 em vez de tentativa-e-erro manual. Resolve casos como Gabriele em 1 clique.

**Arquivos novos**: `src/lib/v8FindBestProposal.ts` (cálculo local) + `src/components/v8/FindBestProposalButton.tsx`.

**Arquivos editados**: `src/components/v8/V8OperacoesTab.tsx` (adicionar botão na linha CPF quando aplicável).

---

## Bloco C — UX do campo Parcelas

Adicionar abaixo do Select "Parcelas":
- **Badge dinâmico**: "Margem detectada: R$ 148,93 — em 24x cabe até R$ X,XX"
- Tooltip explicando: "Em lote com auto-simulação ativa, este valor é usado para todos os CPFs do lote".

**Arquivo**: `src/components/v8/V8NovaSimulacaoTab.tsx` (próximo da linha 675).

---

## Pendências fora do escopo

- Cálculo de juros real por tabela (hoje seria estimado). Para precisão total, dependeria da V8 expor coeficientes — por enquanto usar tabela média conhecida.
- Aplicar Bloco B em massa (lote inteiro) — fica para próxima iteração após validação manual.

---

## Checklist de validação manual (após implementar)

1. Abrir Nova Simulação, criar lote com Gabriele em 24x → conferir que registro grava `installments=24`.
2. Rodar auto-simulate → conferir que body V8 contém `number_of_installments: 24`.
3. Em Operações → Falhas, abrir card Gabriele → clicar "Encontrar proposta viável" → conferir resultado SUCCESS com valor ≤ R$ 1.791,08.
4. Comparar com outro sistema: deve dar valor próximo (variação ≤ 5% por diferença de tabela).

## Prevenção de regressão

- Teste Vitest em `src/lib/__tests__/v8FindBestProposal.test.ts` cobrindo:
  - margem R$ 148,93 + tabela CLT Acelera + prazo 24 → retorna valor compatível
  - margem R$ 0 → retorna null (não chama V8)
  - prazo único disponível → não quebra binary search
