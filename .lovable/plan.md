

## Plano Completo: 6 Correcoes e Funcionalidades

### 1. Carregar TODAS as conversas do WhatsApp (historico completo)

**Problema**: O `fetch-chats` no edge function envia `limit: 50` e filtra grupos. A UazAPI via `POST /chat/find` retorna todas as conversas do numero, incluindo as que nao foram trocadas dentro da plataforma. O limite precisa ser aumentado e a paginacao implementada.

**Correcoes**:
- **`supabase/functions/uazapi-api/index.ts` (acao `fetch-chats`)**: Aumentar limite padrao para 200. Remover o filtro `!c.wa_isGroup` (deixar grupos aparecerem tambem). Adicionar suporte a paginacao para carregar mais conversas.
- **`src/components/whatsapp/ChatSidebar.tsx`**: Adicionar scroll infinito na lista de conversas -- ao chegar no final da lista, carregar proxima pagina. Passar `page` para a API.

### 2. Sidebar nao filtra conversas ao trocar de chip

**Problema**: Ao trocar de chip, o `handleSelectChip` faz `setSelectedChat(null)`, mas a sidebar usa cache do chip anterior e nao limpa as conversas. O cache do chip 1 permanece visivel quando o chip 2 esta selecionado.

**Causa raiz**: O `ChatSidebar` carrega cache por `chipId` corretamente, mas a conversa do chip anterior fica visivel no cache porque o `useEffect` com `fetchChats` depende de `chipId`, e no momento da troca, o estado `chats` ainda tem os dados antigos ate o cache/API do novo chip carregar.

**Correcao**:
- **`src/components/whatsapp/ChatSidebar.tsx`**: Quando `chipId` muda, IMEDIATAMENTE carregar o cache do novo chip ou limpar o estado. Adicionar um `useEffect` que ao detectar mudanca de `chipId`, faz:
  1. Tentar carregar cache do novo chip
  2. Se nao tem cache, limpar `chats` e mostrar loading
  3. Buscar da API em seguida

### 3. Botao "Reagir" nao funciona

**Problema**: O fluxo atual e: clique em "Reagir" -> seta `reactMsg` -> o `messages.map()` detecta que `reactMsg` corresponde ao `msg` -> envolve o bubble num `ReactionPicker` (Popover). Porem, o `Popover` tem `open` controlado internamente e o `PopoverTrigger` e a propria bolha da mensagem -- o usuario teria que clicar NOVAMENTE na bolha para abrir o popover. Isso nunca funciona na pratica.

**Correcao**:
- **`src/components/whatsapp/ChatWindow.tsx`**: Remover a logica de wrapping do `ReactionPicker` no `messages.map()`. Em vez disso, usar um Popover/Dialog posicionado absolutamente que abre automaticamente quando `reactMsg` e setado. Usar estado `reactMsg` + posicao da mensagem para renderizar o picker como overlay.
- Alternativa mais simples: Criar um componente `ReactionOverlay` que aparece como dialog fixo no centro da tela com os 6 emojis quando `reactMsg !== null`. Ao clicar num emoji, chama `handleReactEmoji` e fecha.

### 4. Sinalizador visual de conversa fixada

**Problema**: Ao fixar uma conversa via UazAPI (`POST /chat/pin`), nao ha indicador visual na sidebar mostrando que ela esta fixada.

**Correcao**:
- **`src/pages/WhatsApp.tsx`**: Adicionar campo `isPinned` no tipo `ChatContact`.
- **`supabase/functions/uazapi-api/index.ts` (acao `fetch-chats`)**: Verificar campo `wa_pin` ou `pin` retornado pelo `POST /chat/find` da UazAPI e incluir no objeto normalizado.
- **`src/components/whatsapp/ChatSidebar.tsx`**: Exibir icone de pin (lucide `Pin`) ao lado do nome da conversa quando `chat.isPinned === true`. Ordenar conversas fixadas no topo.

### 5. Pagina/painel de mensagens favoritadas

**Implementacao**: Criar um painel lateral (sheet/drawer) acessivel pela pagina WhatsApp, que mostra todas as mensagens favoritadas do usuario.

- **Criar `src/components/whatsapp/FavoritesPanel.tsx`**: Componente Sheet que:
  - Busca da tabela `message_favorites` do Supabase
  - Agrupa por conversa (`remote_jid`)
  - Mostra texto da mensagem, data, e link para abrir a conversa
  - Permite remover favoritos
- **`src/pages/WhatsApp.tsx`**: Adicionar botao de estrela no header que abre o `FavoritesPanel`.

### 6. Editar mensagens enviadas (UazAPI: POST /message/edit)

**Endpoint UazAPI**: `POST /message/edit`
- Body: `{ id: "messageId", content: "novo texto" }`
- So funciona para mensagens enviadas pela propria instancia
- Mensagem deve estar dentro do prazo do WhatsApp

**Implementacao**:
- **`supabase/functions/uazapi-api/index.ts`**: Adicionar acao `edit-message` que chama `POST /message/edit` com `{ id: messageId, content: newText }`.
- **`src/components/whatsapp/MessageContextMenu.tsx`**: Adicionar opcao "Editar" no menu (apenas para mensagens `fromMe`).
- **`src/components/whatsapp/MessageBubble.tsx`**: Adicionar "Editar" no dropdown (apenas `fromMe`). Passar callback `onEdit`.
- **`src/components/whatsapp/ChatWindow.tsx`**: Adicionar handler `handleEdit` que abre um dialog/input com o texto atual, permite editar, e envia para a API. Apos sucesso, atualizar o texto da mensagem no estado local.

---

### Detalhes Tecnicos

**Arquivos a criar:**
1. `src/components/whatsapp/FavoritesPanel.tsx` -- Painel lateral de favoritos

**Arquivos a modificar:**
1. `supabase/functions/uazapi-api/index.ts` -- Adicionar `edit-message`, ajustar `fetch-chats` (limite, campo pin, remover filtro grupos)
2. `src/components/whatsapp/ChatWindow.tsx` -- Corrigir ReactionPicker (overlay em vez de wrapper), adicionar handler `handleEdit`, dialog de edicao
3. `src/components/whatsapp/ChatSidebar.tsx` -- Limpar estado ao trocar chip, scroll infinito, icone de pin, ordenacao pinned-first
4. `src/components/whatsapp/MessageBubble.tsx` -- Adicionar "Editar" no menu (somente fromMe)
5. `src/components/whatsapp/MessageContextMenu.tsx` -- Adicionar "Editar" no context menu (somente fromMe)
6. `src/pages/WhatsApp.tsx` -- Adicionar `isPinned` no tipo `ChatContact`, botao de favoritos no header

**Ordem de implementacao:**
1. Corrigir sidebar ao trocar chip (prioridade -- bug visivel)
2. Corrigir ReactionPicker (bug -- nao abre)
3. Ajustar `fetch-chats` para trazer todas as conversas + campo pin
4. Adicionar sinalizador de pin na sidebar
5. Adicionar acao `edit-message` no edge function + UI
6. Criar painel de favoritos
