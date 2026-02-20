

## Plano: Funcoes Completas do Menu de Contexto + Correcao de Cache no Login

### 1. Reagir a mensagens (UazAPI: POST /message/react)

**Endpoint UazAPI**: `POST /message/react`
- Body: `{ number: "chatid@s.whatsapp.net", text: "emoji", id: "messageId" }`
- Para remover reacao: `text: ""` (string vazia)

**Alteracoes:**

- **`supabase/functions/uazapi-api/index.ts`**: Adicionar acao `react-message` que chama `POST /message/react` com `{ number: chatId, text: emoji, id: messageId }`
- **`src/components/whatsapp/ChatWindow.tsx`**: Substituir placeholder `handleReact` por logica real. Ao clicar "Reagir", abrir um mini-picker de emojis rapidos (6 emojis comuns: like, coracao, risada, surpresa, triste, reza) em popover sobre a mensagem
- **`src/components/whatsapp/MessageBubble.tsx`**: Adicionar componente inline de reacao rapida (6 emojis) que aparece ao clicar "Reagir" no menu

### 2. Apagar mensagem para todos (UazAPI: POST /message/delete)

**Endpoint UazAPI**: `POST /message/delete`
- Body: `{ id: "messageId" }`
- Apaga para TODOS os participantes

**Nota**: A UazAPI NAO tem endpoint para "apagar apenas para mim". O WhatsApp Web tem essa opcao nativamente, mas a API so suporta "apagar para todos".

**Alteracoes:**

- **`supabase/functions/uazapi-api/index.ts`**: Adicionar acao `delete-message` que chama `POST /message/delete` com `{ id: messageId }`
- **`src/components/whatsapp/ChatWindow.tsx`**: Substituir placeholder `handleDelete` por dialog de confirmacao com opcao "Apagar para todos" (unica opcao via API). Apos sucesso, remover mensagem do state local e do cache
- **`src/components/whatsapp/MessageBubble.tsx`**: Atualizar menu para mostrar "Apagar para todos" ao inves de apenas "Apagar"

### 3. Fixar chat (UazAPI: POST /chat/pin)

**Endpoint UazAPI**: `POST /chat/pin`
- Fixa/desafixa um chat no topo da lista de conversas

**Nota**: Este endpoint fixa o CHAT (conversa inteira), nao uma mensagem individual. A UazAPI nao possui endpoint para fixar mensagens individuais dentro de uma conversa.

**Alteracoes:**

- **`supabase/functions/uazapi-api/index.ts`**: Adicionar acao `pin-chat` que chama `POST /chat/pin` com o chatId
- **`src/components/whatsapp/ChatWindow.tsx`**: Substituir placeholder `handlePin`. Como a API fixa o CHAT e nao a mensagem, o botao "Fixar" no menu de contexto vai fixar a conversa inteira no topo. Toast de confirmacao ao usuario

### 4. Favoritar mensagem (nao suportado pela UazAPI)

**Analise da documentacao**: A UazAPI NAO possui endpoint para favoritar/star mensagens. Os endpoints disponiveis na secao "Acoes na mensagem" sao: download, find, markread, react, delete, edit. Nao existe `/message/star` ou similar.

**Solucao**: Implementar favoritos LOCALMENTE no banco de dados Supabase, criando uma tabela `message_favorites` para armazenar mensagens favoritadas pelo usuario.

**Alteracoes:**

- **Migracao SQL**: Criar tabela `message_favorites` com campos: `id`, `user_id`, `chip_id`, `message_id`, `remote_jid`, `message_text`, `created_at`
- **RLS**: Usuarios podem ver/inserir/deletar apenas seus proprios favoritos
- **`src/components/whatsapp/ChatWindow.tsx`**: Implementar `handleFavorite` que insere/remove da tabela `message_favorites`

### 5. Mensagens nao aparecem ao logar (cache existe mas nao carrega)

**Causa raiz identificada**: Quando o usuario faz login, a pagina `/whatsapp` carrega, mas `selectedChipId` inicia como `null`. O `ChipSelector` carrega os chips e chama `onSelectChip(data[0].id)` no primeiro render. Porem, o `ChatSidebar` depende de `chipId` e a sequencia de eventos e:

1. Login -> navega para `/whatsapp`
2. `selectedChipId = null` -> ChatSidebar nao carrega nada
3. `ChipSelector.fetchChips()` completa -> `onSelectChip(chip.id)` atualiza `selectedChipId`
4. `ChatSidebar` recebe novo `chipId` -> `fetchChats()` executa
5. `getCachedChats(chipId)` pode retornar dados do cache, mas...
6. O `fetchChats` faz `const cached = getCachedChats(chipId)` e seta `setChats(cached)` MAS logo apos inicia o fetch da API
7. Se a API retorna vazio ou erro (ex: token expirado), `setChats` fica com array vazio e sobrescreve o cache

**Problema adicional**: O cache usa `CACHE_VERSION = 'v1'` e expira apos 7 dias. Se o cache expirou, e a API retorna vazio, nao ha dados para mostrar.

**Correcoes:**

- **`src/components/whatsapp/ChatSidebar.tsx`**: Nao sobrescrever o cache com resultado vazio da API. Se a API retornar array vazio ou erro, manter os dados do cache. So atualizar se a API retornar dados reais
- **`src/components/whatsapp/ChatWindow.tsx`**: Mesma logica para mensagens -- se a API retornar vazio, manter o cache. Tambem carregar mensagens do banco de dados (`message_history`) como fallback quando a API nao retorna dados

### 6. Historico de mensagens externas ao sistema

**Resposta**: SIM, e possivel! A UazAPI ja armazena o historico completo de mensagens do WhatsApp (incluindo as trocadas fora da plataforma). O endpoint `POST /message/find` retorna TODAS as mensagens de um chat, independentemente de quando foram enviadas.

O problema atual e que o sistema so mostra 50 mensagens por vez. Para carregar historico mais antigo, precisa implementar paginacao (scroll infinito).

**Alteracoes:**

- **`src/components/whatsapp/ChatWindow.tsx`**: Adicionar scroll infinito -- quando o usuario rolar para o topo, carregar a proxima pagina de mensagens via `fetch-messages` com `page: 2, 3...`

---

### Detalhes Tecnicos

**Tabela nova (migracao SQL):**
```
message_favorites (id, user_id, chip_id, message_id, remote_jid, message_text, created_at)
```

**Arquivos a modificar:**
1. `supabase/functions/uazapi-api/index.ts` -- Adicionar acoes: `react-message`, `delete-message`, `pin-chat`
2. `src/components/whatsapp/ChatWindow.tsx` -- Implementar handlers reais + scroll infinito + proteger cache
3. `src/components/whatsapp/MessageBubble.tsx` -- Mini emoji picker para reacoes + "Apagar para todos"
4. `src/components/whatsapp/ChatSidebar.tsx` -- Proteger cache contra API vazia
5. `src/components/whatsapp/MessageContextMenu.tsx` -- Atualizar labels

**Arquivos a criar:**
1. `src/components/whatsapp/ReactionPicker.tsx` -- Componente de selecao rapida de emoji para reacoes

**Ordem de implementacao:**
1. Corrigir cache no login (prioridade -- funcionalidade quebrada)
2. Adicionar acoes no edge function (react, delete, pin)
3. Implementar handlers reais no ChatWindow
4. Criar tabela de favoritos + implementar
5. Adicionar scroll infinito para historico
