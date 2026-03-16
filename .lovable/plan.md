

## Plano: Correções na Gestão de Leads (5 itens)

### 1. Contador limitado a 1000
**Problema:** A query de métricas em `Leads.tsx` linha 150 usa `.limit(5000)`, mas o Supabase tem limite padrão de 1000 por query. Precisa paginar.
**Arquivo:** `src/pages/admin/Leads.tsx`
**Solução:** Substituir a query por loop paginado (igual ao `fetchAllLeadsForExport`), buscando apenas `status, batch_name, assigned_to, created_at, contacted_at, perfil` em batches de 1000.

### 2. Coluna "Perfil" não aparece no card Ordem e Visibilidade
**Problema:** Quando o `lead_table_columns` já foi salvo no banco antes da coluna `perfil` existir, o config salvo não inclui `perfil`. O código usa o config salvo sem mesclar com `ALL_COLUMNS`.
**Arquivo:** `src/pages/admin/Leads.tsx`
**Solução:** Na query `lead-table-columns`, após carregar do banco, mesclar com `ALL_COLUMNS` — adicionar colunas novas que não existem no config salvo, mantendo a ordem salva.

### 3. Coluna "Perfil" não aparece na tabela
**Problema:** Consequência direta do item 2. O `visibleCols` derivado do `columnConfig` não contém `perfil`, então a tabela não renderiza essa coluna.
**Solução:** Resolvido automaticamente pelo item 2.

### 4. Deletar lote no Histórico de Importações
**Arquivo:** `src/pages/admin/Leads.tsx`
**Solução:** Adicionar botão "Excluir" em cada linha do histórico de lotes. Ao clicar, confirmar via AlertDialog e executar `DELETE FROM client_leads WHERE batch_name = ?`. Adicionar import do `AlertDialog` e estado para controle.

### 5. Caracteres com encoding incorreto (ex: "Econ½mica")
**Problema:** O XLSX é lido com `readAsBinaryString` que não trata encoding UTF-8 corretamente para alguns arquivos.
**Arquivo:** `src/components/admin/LeadImporter.tsx`
**Solução:** Trocar `readAsBinaryString` por `readAsArrayBuffer` e usar `XLSX.read(data, { type: 'array' })` que tem suporte melhor a encoding.

### Arquivos modificados
1. `src/pages/admin/Leads.tsx` — itens 1, 2, 4
2. `src/components/admin/LeadImporter.tsx` — item 5

