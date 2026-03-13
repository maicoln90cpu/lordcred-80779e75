

## Fix: Scroll lateral apenas na div da tabela

**Problema**: A tabela tem `min-w-[2000px]` mas o overflow horizontal esta vazando para a pagina inteira porque o `Card` e o `CardContent` nao restringem o overflow.

**Solucao**: Adicionar `overflow-hidden` no `Card` do LeadsTable para conter o scroll horizontal dentro da div da tabela. O wrapper da tabela (linha 308) ja tem `overflow-x-auto` e `overflow-y-auto`, entao basta impedir que o overflow vaze para cima.

**Arquivo**: `src/components/admin/LeadsTable.tsx`

- Linha 238: `<Card>` → `<Card className="overflow-hidden">`
- Isso garante que o scroll horizontal fica contido na div `border rounded-lg max-h-[600px] overflow-y-auto` existente na linha 308, sem afetar a pagina.

