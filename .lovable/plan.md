## Diagnóstico — por que diverge?

Não há bug na V8 nem na margem. O sistema usa **duas estratégias diferentes** de envio:

### Aba Operações (botão "Encontrar proposta viável") — funciona
Em `src/components/v8/FindBestProposalButton.tsx` + `src/lib/v8FindBestProposal.ts`:
- Lê `margem_valor` daquele CPF específico
- Aplica **fator de segurança 0,95** → parcela = margem × 0,95
- Envia em `installment_face_value` no **maior prazo permitido**
- Resultado: parcela fica abaixo da margem → V8 aceita

### Aba Nova Simulação (botão "Simular selecionados") — falha
Em `src/hooks/useV8BatchOperations.ts` linhas 239–274:
- Envia o `simulation_mode` e `simulation_value` **globais do formulário** (mesmos para todos os CPFs)
- Quando o operador deixa "Sem valor" (`simulation_mode='none'`), a V8 devolve um cenário default cuja **parcela bate igual ou acima da margem** do CPF de baixa margem
- V8 recusa: "Valor da parcela acima da margem disponível"
- É exatamente o que mostram seus prints (Rogerio: margem R$ 1.105,63 / parcela devolvida R$ 1.105,63 = no limite → rejeitada)

### Por que "Auto-melhor" não cobre tudo
O `runAutoBestForSim` (mesma lógica do botão de Operações, com 0,95) só roda no `useEffect` quando o toggle **autoBest=ON**. Se estiver OFF, ninguém aplica fator de segurança em lote → todos batem no limite.

---

## Plano (3 etapas pequenas e seguras)

### Etapa 1 — Unificar `handleSimulateSelected` com a lógica do botão "🔍"
Em `src/hooks/useV8BatchOperations.ts` (`handleSimulateSelected`):
- Quando `simulation_mode === 'none'` (ou valor não informado pelo operador), **não cair no default da V8**.
- Em vez disso, para cada CPF chamar `runAutoBestForSim` (mesmo fluxo do botão Operações: 6 candidatos com fator 0,95 → 0,65, maior prazo primeiro, throttled).
- Quando o operador informar valor manual, manter o comportamento atual (envia o valor que ele digitou).
- Toast final mantém contagem `ok / fail` somando os candidatos aceitos.

### Etapa 2 — Ligar Auto-melhor por padrão em lotes novos
Em `src/components/v8/V8NovaSimulacaoTab.tsx`:
- `autoBest` passa a ser `true` por default ao criar/abrir um lote.
- Tooltip do toggle: "Procura a melhor combinação valor × prazo automaticamente — mesma lógica do botão 🔍 da aba Operações."
- Mantém o usuário podendo desligar.

### Etapa 3 — Mensagem honesta no card quando V8 recusa
Em `BatchProgressTable.tsx`:
- Quando `simulate_status='failed'` E o motivo for "parcela acima da margem", incluir uma linha curta: "Tente desligar valor manual ou ative Auto-melhor — as duas abas usam a mesma V8."
- Apenas texto. Não muda lógica.

---

## Detalhes técnicos

| Arquivo | O que muda |
|---|---|
| `src/hooks/useV8BatchOperations.ts` | `handleSimulateSelected`: ramificar entre "valor manual digitado" e "auto-melhor por linha" |
| `src/components/v8/V8NovaSimulacaoTab.tsx` | `autoBest` default `true`; texto do toggle |
| `src/components/v8/nova-simulacao/BatchProgressTable.tsx` | Texto auxiliar quando motivo = "parcela acima da margem" |
| `src/lib/__tests__/v8FindBestProposal.test.ts` | Já cobre os candidatos. Adicionar 1 teste do caso Rogerio (margem 1105,63 → fator 0,95 produz parcela ≤ margem) |

Sem mudanças em edge function nem em banco. Sem migração.

---

## Antes vs Depois

- **Antes:** "Simular selecionados" usa valor global → CPFs de margem baixa batem no teto e a V8 recusa.
- **Depois:** "Simular selecionados" sem valor manual usa auto-melhor por CPF (parcela = margem × 0,95) → mesma taxa de aceitação do botão da aba Operações.

## Vantagens / Desvantagens

- **+** Paridade total entre as duas abas.
- **+** Não precisa o operador saber que existe um toggle Auto-melhor.
- **−** "Simular selecionados" fica um pouco mais lento (vários candidatos por CPF). Mitigação: throttle igual ao atual + para no primeiro aceito.

## Checklist manual após implementar

1. Abrir lote com CPFs que falharam com "parcela acima da margem".
2. Clicar "Simular selecionados" sem digitar valor.
3. Conferir que a maioria vira `success` com parcela < margem.
4. Conferir que CPFs sem margem continuam `rejected`.
5. Comparar com o botão "🔍" da aba Operações no mesmo CPF — deve aceitar o mesmo prazo/parcela.

## Pendências (futuro, não agora)

- Permitir o operador escolher o fator de segurança (0,95 / 0,85) na UI do lote.
- Mostrar no card qual candidato foi aceito (prazo + fator).

## Prevenção de regressão

- Teste novo: caso Rogerio (margem 1105,63) → primeiro candidato com 0,95 deve gerar parcela ≤ margem.
- Teste existente (Paulo / Gabriele) já garante que o fator de segurança seja aplicado.
