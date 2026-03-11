

## Plano: 4 mudancas no Kanban e WhatsApp

### 1. Remover submenu "Status" do context menu do sidebar

O submenu "Status" (linhas 935-955 do ChatSidebar) se tornou redundante com o Kanban. Remover:
- O submenu Status do context menu
- O filtro "Status" da barra de filtros (linhas 759-782)
- O badge de status que aparece nos cards do sidebar (linhas 887-891)
- A funcao `handleSetStatus` (linhas 407-450)
- O state `filterStatus` e tipo `ConversationStatus`
- Manter o `STATUS_CONFIG` e `custom_status` internamente pois o Kanban ainda usa essa sincronizacao

### 2. Remover opcoes de editar e excluir mensagens

**MessageContextMenu.tsx**: Remover os items "Editar" e "Apagar para todos" e suas props (`onDelete`, `onEdit`).

**ChatWindow.tsx**: Remover:
- States `deleteMsg`, `editMsg`, `editText`
- Funcoes `handleDelete`, `handleEdit`, `confirmEdit`, `confirmDelete`
- Os dialogs de editar e deletar no final do componente (linhas 812-847)
- Props `onDelete` e `onEdit` do `<MessageBubble>`

### 3. Corrigir sync bidirecional Kanban → Sidebar

**Bug**: Em `useKanban.ts` `moveCard` (linha 156), o status eh salvo como `col.name` (ex: "Aguardando"), mas o sidebar espera o key (ex: "aguardando"). Precisa converter o nome da coluna para o key correspondente do `STATUS_CONFIG`.

**Fix em `useKanban.ts`**: Na funcao `moveCard`, antes de atualizar `custom_status`, mapear `col.name` para o key correto:

```typescript
// Em vez de: { custom_status: col.name }
// Fazer: encontrar o key do STATUS_CONFIG que tem label === col.name
const statusKey = col.name.toLowerCase().replace(/ /g, '_').replace('em_andamento', 'em_andamento');
```

Na verdade, o approach mais limpo: exportar uma funcao `columnNameToStatusKey` que faz o match inverso. O mesmo fix precisa ser aplicado em `addCard`.

**Alem disso**: O sidebar ja escuta mudancas na tabela `conversations` via realtime com debounce de 500ms, entao uma vez que o `custom_status` seja salvo corretamente, o sidebar vai re-fetchar automaticamente.

### 4. Visual premium do Kanban

Melhorar o visual dos seguintes componentes:

**KanbanColumn.tsx**:
- Fundo com gradiente sutil usando a cor da coluna
- Header com borda colorida mais pronunciada (borda left ou top com a cor da coluna)
- Sombra interna sutil
- Contador com pill mais estilizado

**KanbanCard.tsx**:
- Gradiente sutil no hover
- Borda esquerda colorida baseada na coluna (precisa receber cor da coluna como prop)
- Sombra mais refinada com `shadow-lg` no hover
- Melhor espacamento e tipografia
- Avatar com ring/anel sutil
- Unread badge mais proeminente

**KanbanDialog.tsx**:
- Header mais limpo com separacao visual
- Filtros com design mais polido
- Background com gradiente sutil

**KanbanCardDetailDialog.tsx**:
- Layout mais espacado
- Sections com bordas e backgrounds distintos
- Avatar maior
- Botao "Abrir conversa" mais proeminente

### Arquivos afetados

| Arquivo | Mudanca |
|---|---|
| `src/components/whatsapp/ChatSidebar.tsx` | Remover status submenu, filtro status, badge status |
| `src/components/whatsapp/MessageContextMenu.tsx` | Remover editar e excluir |
| `src/components/whatsapp/ChatWindow.tsx` | Remover logica e dialogs de editar/excluir |
| `src/hooks/useKanban.ts` | Fix sync: converter col.name → status key |
| `src/components/whatsapp/KanbanCard.tsx` | Visual premium |
| `src/components/whatsapp/KanbanColumn.tsx` | Visual premium |
| `src/components/whatsapp/KanbanDialog.tsx` | Visual premium |
| `src/components/whatsapp/KanbanCardDetailDialog.tsx` | Visual premium |

