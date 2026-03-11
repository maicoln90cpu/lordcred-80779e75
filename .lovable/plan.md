

## Plano: 4 Correções

### 1. Kanban não atualiza ao abrir — forçar refetch ao abrir dialog

**Problema**: O `useKanban` faz fetch inicial e depois depende de realtime. Quando o sidebar adiciona um card diretamente via `supabase.from('kanban_cards').upsert(...)`, o hook `useKanban` pode não captar se o dialog estava fechado.

**Solução**: Expor `refetch` do `useKanban` e chamá-lo no `KanbanDialog` sempre que `open` mudar para `true`.

**Arquivo**: `src/components/whatsapp/KanbanDialog.tsx`
- Adicionar `refetch` ao destructure do `useKanban()`
- Adicionar `useEffect` que chama `refetch()` quando `open === true`

### 2. Fundo gradiente no chat (light + dark)

**Problema**: A área de mensagens usa `bg-gradient-to-b from-background/50 to-background` — pouco visível.

**Solução**: Em `src/index.css`, adicionar variáveis CSS customizadas para o fundo do chat:
- Light mode: gradiente sutil de cinza-claro para branco (`from-slate-50 to-white`)
- Dark mode: gradiente sutil de tons mais profundos (`from-[hsl(222,47%,9%)] to-[hsl(222,47%,12%)]`)

**Arquivo**: `src/components/whatsapp/ChatWindow.tsx` linha 605
- Trocar classe de fundo para usar gradiente com tons visíveis em ambos os modos

### 3. Mensagens muito distantes das bordas em telas grandes

**Problema**: Linha 620: `max-w-3xl mx-auto` centraliza as mensagens e limita a 768px, criando espaço enorme nas laterais em telas grandes.

**Solução**: Aumentar `max-w-3xl` para `max-w-4xl` ou `max-w-5xl` e manter `mx-auto`. Isso dá mais espaço sem esticar demais.

**Arquivo**: `src/components/whatsapp/ChatWindow.tsx` linha 620

### 4. Ocultar conversas sem nenhuma mensagem no sidebar

**Problema**: Conversas que nunca tiveram mensagem (`last_message_text` vazio/null E `last_message_at` null) aparecem no sidebar.

**Solução**: No filtro de chats em `ChatSidebar.tsx` linha 526, adicionar condição para esconder conversas onde `lastMessage` está vazio E `lastMessageAt` é null (nunca teve mensagem). Isso não afeta conversas que tiveram mensagens mas cujo preview está vazio.

**Arquivo**: `src/components/whatsapp/ChatSidebar.tsx` — dentro do `filteredChats` filter, adicionar:
```
if (!chat.lastMessage && !chat.lastMessageAt) return false;
```

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/whatsapp/KanbanDialog.tsx` | Chamar `refetch()` ao abrir |
| `src/components/whatsapp/ChatWindow.tsx` | Gradiente de fundo + aumentar `max-w` |
| `src/components/whatsapp/ChatSidebar.tsx` | Filtrar conversas sem mensagens |

