

## Plano: Melhorias no Kanban + Remover do Kanban + Fonte do header do chat

### 1. Cinco melhorias uteis para o modal do Kanban

1. **Mover card entre colunas pelo detail dialog** — Select/dropdown no detail dialog para trocar a coluna sem precisar arrastar
2. **Contador de tempo na coluna** — Mostrar ha quanto tempo o contato esta naquela coluna (ex: "ha 3 dias")
3. **Adicionar nota rapida pelo detail dialog** — Input para adicionar nota diretamente sem precisar abrir o chat
4. **Filtro por "sem mensagem ha X dias"** — Filtrar contatos inativos para follow-up
5. **Indicador visual de contatos inativos** — Opacity reduzida ou badge "inativo" em cards sem mensagem ha mais de 3 dias

### 2. Botao "Remover do Kanban" no KanbanCardDetailDialog

**Arquivo**: `src/components/whatsapp/KanbanCardDetailDialog.tsx`
- Adicionar prop `onRemoveCard: (cardId: string) => void`
- Adicionar botao vermelho "Remover do Kanban" no footer, ao lado de "Fechar"
- Ao clicar, chamar `onRemoveCard(card.id)` e fechar o dialog

**Arquivo**: `src/components/whatsapp/KanbanDialog.tsx`
- Importar `removeCard` do `useKanban()`
- Passar `onRemoveCard={handleRemoveCard}` ao `KanbanCardDetailDialog`
- `handleRemoveCard` chama `removeCard(cardId)` e limpa `detailCard`

### 3. Aumentar fonte no header do chat

**Arquivo**: `src/components/whatsapp/ChatWindow.tsx` linha 549
- Nome: trocar `text-sm font-semibold` para `text-base font-bold`
- Telefone: trocar `text-xs` para `text-sm`

### Arquivos afetados

| Arquivo | Mudanca |
|---|---|
| `KanbanCardDetailDialog.tsx` | Botao remover + select de coluna + input de nota + tempo na coluna |
| `KanbanDialog.tsx` | Passar `removeCard` e handlers ao detail dialog |
| `KanbanCard.tsx` | Indicador de inatividade |
| `KanbanColumn.tsx` | Sem mudancas |
| `ChatWindow.tsx` | Aumentar fonte do header |

