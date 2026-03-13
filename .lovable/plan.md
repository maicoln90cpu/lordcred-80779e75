

## Separar filtros e tabela em Cards independentes

**Problema**: O componente `LeadsTable` usa um unico `Card` que engloba header, filtros, bulk actions, tabela e paginacao. O usuario quer que a tabela tenha seu proprio Card separado dos filtros/cards do topo, e que o scroll horizontal exista apenas na tabela.

**Arquivo**: `src/components/admin/LeadsTable.tsx`

**Mudancas**:

1. **Primeiro Card** (linhas 238-278 + bulk actions + paginacao): Contem o header "Todos os Leads", botao exportar, filtros de busca, e a barra de acoes em massa. Sem scroll.

2. **Segundo Card** (novo): Envolve apenas a div da tabela com `overflow-x-auto` e a `Table` com `min-w-[2000px]`. Este Card tera o scroll horizontal contido nele. A paginacao fica abaixo deste Card, fora do scroll.

Estrutura resultante:
```text
<>
  <div className="space-y-4">
    {/* Card 1: Header + Filtros + Bulk Actions */}
    <Card>
      <CardHeader>... titulo + exportar ...</CardHeader>
      <CardContent>... filtros + bulk bar ...</CardContent>
    </Card>

    {/* Card 2: Apenas a Tabela */}
    <Card className="overflow-hidden">
      <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
        <Table className="min-w-[2000px]">...</Table>
      </div>
    </Card>

    {/* Paginacao fora dos cards */}
    <div>... pagination ...</div>
  </div>

  {/* Dialogs permanecem iguais */}
</>
```

3. Remover `overflow-x-hidden` residual do `TabsContent` e containers pai em `Leads.tsx` (linhas 210, 244, 254), pois o overflow agora esta contido no Card da tabela.

