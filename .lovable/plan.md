

## Plano de Melhorias para Gestao de Leads

### Bug Fix: ScrollArea do modal LeadsPanel

O `ScrollArea` nao tem altura fixa definida. O `DialogContent` usa `flex flex-col` com `max-h-[85vh]`, mas o `ScrollArea` com `flex-1` precisa de `overflow-hidden` no container pai e altura explicita. Corrigir adicionando `className="flex-1 min-h-0"` no ScrollArea e garantindo que a tabela tenha scroll adequado. Tambem adicionar paginacao com botoes "Anterior/Proximo" (50 leads por pagina).

**Arquivo**: `src/components/whatsapp/LeadsPanel.tsx`

---

### Acoes em Massa para Admin (LeadsTable)

Adicionar ao `LeadsTable.tsx`:
- Checkbox na primeira coluna de cada linha + checkbox "selecionar todos" no header
- Barra de acoes flutuante quando ha selecao (ex: "X selecionados")
- Botoes: **Excluir selecionados**, **Alterar status em massa**, **Reatribuir vendedor**
- Confirmacao via AlertDialog antes de excluir
- Estado `selectedIds: Set<string>` para controlar selecao

**Arquivo**: `src/components/admin/LeadsTable.tsx`

---

### 5 Melhorias para o Admin

1. **Dashboard de metricas de leads** -- Cards no topo da pagina Leads mostrando: total de leads, leads pendentes, leads contatados, taxa de aprovacao. Usando contagens dos dados ja carregados.

2. **Filtro por lote (batch_name)** -- Adicionar um Select extra nos filtros do LeadsTable para filtrar por nome do lote importado. Query distinta dos batch_names existentes.

3. **Exportar leads para XLSX** -- Botao "Exportar" que gera um arquivo XLSX com os leads filtrados usando a biblioteca `xlsx` (ja instalada). Util para relatorios.

4. **Historico de importacoes** -- Agrupar leads por batch_name e mostrar uma mini-tabela com: nome do lote, vendedor, qtd leads, data de importacao, % contatados.

5. **Reatribuir lote inteiro a outro vendedor** -- No historico de importacoes, botao para mover todos os leads de um lote para outro vendedor de uma so vez.

**Arquivos**: `src/components/admin/LeadsTable.tsx`, `src/pages/admin/Leads.tsx`

---

### 5 Melhorias para o Vendedor

1. **Contadores de status no topo do modal** -- Badges/chips mostrando: "Pendentes: 42 | Chamei: 15 | Aprovados: 3 | Nao Existe: 8". Clicaveis para filtrar rapidamente.

2. **Paginacao com indicador de progresso** -- Barra de progresso mostrando % de leads ja contatados (status != pendente) do total.

3. **Ordenacao por colunas** -- Permitir clicar no header da tabela para ordenar por nome, valor, status. Estado local de sort.

4. **Filtro por lote** -- Select para filtrar leads por batch_name, util quando o vendedor tem multiplos lotes atribuidos.

5. **Marcar status rapido sem abrir detalhe** -- Dropdown inline na celula de status da tabela para trocar o status direto na lista sem precisar abrir o detalhe do lead.

**Arquivo**: `src/components/whatsapp/LeadsPanel.tsx`

---

### Resumo de arquivos a editar

| Arquivo | Mudancas |
|---|---|
| `src/components/whatsapp/LeadsPanel.tsx` | Fix scroll, paginacao, contadores, ordenacao, filtro lote, status rapido, barra progresso |
| `src/components/admin/LeadsTable.tsx` | Checkbox selecao, acoes em massa (excluir, alterar status, reatribuir), filtro lote, exportar XLSX |
| `src/pages/admin/Leads.tsx` | Dashboard metricas, historico importacoes, reatribuir lote |

