

## Separar filtros da tabela e adicionar scroll horizontal apenas na tabela

**Problema**: O `Card` em `LeadsTable.tsx` engloba tudo (header, filtros, bulk actions, tabela, paginacao) em um unico componente. O scroll precisa ser apenas na div da tabela.

**Solucao**: Remover o `Card` wrapper unico. Manter filtros/header/bulk actions/paginacao fora do scroll. Envolver apenas a `Table` em uma div com `overflow-x-auto` e restaurar `min-w-[2000px]` na tabela para permitir scroll horizontal.

**Arquivo**: `src/components/admin/LeadsTable.tsx`

**Mudancas**:
1. Remover `overflow-hidden` e `overflow-x-hidden` do `Card` e `CardContent`
2. Na div que envolve a `Table` (linha 308-309), trocar `overflow-hidden` por `overflow-x-auto`
3. Restaurar `min-w-[2000px]` na `Table` (linha 310) para que as 22 colunas tenham espaco e o scroll funcione
4. Manter `table-fixed` removido — usar layout automatico para as colunas se ajustarem ao conteudo

