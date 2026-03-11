

## Plano: Corrigir Bugs de Sync + Badge Kanban no Sidebar + Visual Premium Completo

### Problemas identificados na auditoria

**Bug 1 — Badge Kanban removido do sidebar**
Na edicao anterior, ao remover o filtro de "Status", as badges de status foram removidas do sidebar. O sidebar nao mostra mais em qual coluna Kanban o contato esta. Precisa adicionar uma badge simples com bolinha colorida + nome da coluna.

**Bug 2 — `custom_status` com formato inconsistente**
O banco tem valores misturados: `"Em andamento"` (title case, do codigo antigo) e `"em_andamento"` (lowercase, do codigo novo). O `useKanban.moveCard` gera `"em_andamento"` mas a migracao original usou `"Em andamento"`. Isso causa dessincronia — o sidebar nao reconhece o valor.

**Solucao**: Usar SEMPRE o `column.name` diretamente como `custom_status` (ex: `"Em andamento"`, `"Aguardando"`). Isso eh mais simples e alinhado com o que a migracao fez. Atualizar `useKanban.ts` (`moveCard`, `addCard`) e `ChatSidebar.tsx` (`handleAddToKanban`) para salvar `col.name` em vez de um key normalizado. Remover `STATUS_CONFIG` do sidebar — usar `kanbanColumns` diretamente para renderizar a badge.

**Bug 3 — Editar/Excluir ainda no menu da bolha**
`MessageBubble.tsx` ainda mostra "Editar" e "Apagar para todos" no dropdown menu. Precisam ser removidos.

### Mudancas planejadas

#### 1. `src/hooks/useKanban.ts`
- `moveCard`: mudar `statusKey` de `col.name.toLowerCase()...` para simplesmente `col.name`
- `addCard`: mesma mudanca
- Isso garante que `custom_status` = `col.name` = nome da coluna Kanban

#### 2. `src/components/whatsapp/ChatSidebar.tsx`
- Remover `STATUS_CONFIG` (nao mais necessario)
- No `handleAddToKanban`: salvar `custom_status = col.name` em vez de buscar por `STATUS_CONFIG`
- Adicionar badge simples no card da conversa: bolinha colorida + nome da coluna, buscando de `kanbanColumns` pelo `custom_status` do chat
- O sidebar ja faz fetch de `kanbanColumns` e ja tem `custom_status` em cada chat

#### 3. `src/components/whatsapp/MessageBubble.tsx`
- Remover os itens "Editar" e "Apagar para todos" do dropdown menu
- Remover props `onDelete` e `onEdit` da interface

#### 4. Corrigir dados existentes no banco
- Executar SQL para normalizar os `custom_status` existentes: `"em_andamento"` → `"Em andamento"`, `"aguardando"` → `"Aguardando"`, etc.

#### 5. Visual premium completo
Aplicar visual premium a todos os componentes do chat:
- **ChatWindow header**: gradiente sutil, borda inferior com shadow
- **Bolhas de mensagem**: sombras suaves, bordas mais refinadas, spacing
- **Input area**: borda superior mais elegante, background com gradiente
- **Sidebar cards**: hover effects mais polidos, separadores sutis
- **Filtros**: pills com visual mais refinado

### Arquivos afetados

| Arquivo | Mudanca |
|---|---|
| `src/hooks/useKanban.ts` | Salvar `col.name` como `custom_status` |
| `src/components/whatsapp/ChatSidebar.tsx` | Badge Kanban + remover STATUS_CONFIG |
| `src/components/whatsapp/MessageBubble.tsx` | Remover Editar/Excluir do menu |
| `src/components/whatsapp/ChatWindow.tsx` | Visual premium |
| `src/components/whatsapp/ChatInput.tsx` | Visual premium |
| Migracao SQL | Normalizar `custom_status` existentes |

