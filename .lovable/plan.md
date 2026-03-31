

# Fix: Tooltip Flicker, Resumo Detalhado, Histórico/Indicadores

## 4 Issues Identified

### Issue 1 — Tooltip deforma colunas ao hover
**Causa**: `TSHead` usa `<TableHead>` como `TooltipTrigger asChild`. Quando o tooltip abre, o Radix injeta atributos que causam re-render e layout shift no `<th>`. Solução: envolver apenas o conteúdo interno (o `<span>`) no tooltip, não o `<TableHead>` inteiro.

### Issue 2 — Resumo não tem tabela detalhada
**Causa**: O Resumo só mostra "Resumo por Banco" (top 10). Falta a tabela detalhada com todos os contratos individuais (como existe no Relatório). Solução: adicionar uma seção "Detalhado" colapsável abaixo do resumo por banco, mostrando cada contrato com seus valores.

### Issue 3 — Histórico Detalhado/Gestão/Diferença Detalhada
**Resposta**: Esses relatórios **já existem** no sistema:
- **Histórico Gestão** = aba "Histórico" (lista de fechamentos salvos com totais)
- **Histórico Detalhado** = ao expandir um fechamento, mostra todos os contratos
- **Diferença Detalhada** = aba "Divergências" (filtra apenas contratos com |Δ| > R$0.01)

Vou apenas melhorar a visibilidade adicionando um card informativo na aba Resumo que aponte para essas abas.

### Issue 4 — Indicadores todos zerados (0.0%, R$0.00)
**Causa**: `CRIndicadores.tsx` lê de `cr_geral` e usa `identifyProduct(tipo_operacao, convenio)` + `hasInsuranceFn(convenio)` para calcular esperada. Mas os nomes de banco em `cr_geral` (ex: "HUB CRÉDITOS", "BANCO PRATA DIGITAL") **não batem** com os nomes nas regras CLT/FGTS (ex: "Hub Credito", "Prata Digital"). Além disso, a lógica de tabela_chave usa `convenio` direto em vez do extractor correto. Resultado: todas as taxas retornam 0%.

**Solução**: Reescrever `CRIndicadores` para usar `cr_relatorio` como fonte primária (igual ao Resumo e Relatório), com as mesmas funções `extractTableKey*` e `findRate*`.

---

## Plano de Implementação

### Etapa 1 — Fix tooltip flicker em TSHead (CRSortUtils.tsx)
- Mover o `<Tooltip>` para envolver apenas o `<span>` interno, não o `<TableHead>` inteiro
- Isso evita que o Radix injete atributos no `<th>` e cause layout shift

### Etapa 2 — Adicionar tabela detalhada no Resumo (CRResumo.tsx)
- Adicionar seção colapsável "Detalhado" com todos os contratos do período filtrado
- Colunas: Contrato, Nome, Banco, Produto, Valor Lib., Recebida, Esperada, Diferença
- Com paginação ou scroll (max 500 linhas visíveis)
- Remover limite de `slice(0, 10)` no resumo por banco (mostrar todos)

### Etapa 3 — Reescrever CRIndicadores para usar cr_relatorio
- Trocar fonte de `cr_geral` para `cr_relatorio`
- Usar mesmas funções de cálculo do CRRelatorio
- Cross-reference com cr_geral/cr_repasse/cr_seguros para comissão recebida
- Resultado: acurácia, perda acumulada e taxa média calculadas corretamente

---

## Arquivos a Alterar

| Arquivo | Alteração |
|---------|-----------|
| `CRSortUtils.tsx` | Fix tooltip — mover para `<span>` interno |
| `CRResumo.tsx` | Adicionar tabela detalhada + mostrar todos bancos |
| `CRIndicadores.tsx` | Reescrever com cr_relatorio como fonte |

## Checklist Manual

- [ ] Hover nas colunas não deforma layout
- [ ] Aba Resumo mostra tabela detalhada com contratos individuais
- [ ] Resumo por Banco mostra TODOS os bancos (não apenas top 10)
- [ ] Indicadores: Acurácia > 0%, Perda Acumulada > R$0, bancos com dados reais
- [ ] Verificar que Relatório e Divergências continuam funcionando

## Pendente (futuro)
- Nenhum item pendente — todos os 4 pontos são resolvidos nesta implementação

