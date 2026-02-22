

## Implementar: Deletar Chat, Silenciar Chat, Bloquear/Desbloquear e Respostas Rapidas

### Resumo

4 funcionalidades novas usando endpoints UazAPI ja disponiveis. Alteracoes em 3 arquivos.

---

### 1. Edge Function: Novos actions no `uazapi-api/index.ts`

Adicionar 5 novos cases no switch:

**`delete-chat`** - POST `/chat/delete`
```
body: { number: chatId, deleteWhatsApp: true, deleteDB: true, deleteMessages: true }
```
Apos sucesso, deletar conversa e mensagens do banco local.

**`mute-chat`** - POST `/chat/mute`
```
body: { number: chatId, duration: body.duration }
// duration: 0 (desmuta), 8 (8h), 168 (1 semana), -1 (sempre)
```

**`block-contact`** - POST `/chat/block`
```
body: { number: chatId, block: body.block }
// block: true = bloquear, false = desbloquear
```

**`list-quick-replies`** - GET `/quickreply/showall`
Retorna array de QuickReply da instancia.

**`edit-quick-reply`** - POST `/quickreply/edit`
```
body: { shortCut, text, id?, delete?, type? }
// Sem id = criar, com id = atualizar, delete:true = excluir
```

---

### 2. ChatSidebar: Novas opcoes no menu de 3 pontos

Arquivo: `src/components/whatsapp/ChatSidebar.tsx`

Adicionar ao DropdownMenu de cada conversa:
- **Silenciar** (com submenu: 8h, 1 semana, Sempre, Desmutar)
- **Bloquear contato** (com confirmacao via toast)
- **Deletar conversa** (com confirmacao via AlertDialog)

Novos handlers:
- `handleMuteChat(chat, duration)` - chama `uazapi-api` com action `mute-chat`
- `handleBlockContact(chat, block)` - chama `uazapi-api` com action `block-contact`
- `handleDeleteChat(chat)` - chama `uazapi-api` com action `delete-chat`, remove do estado local

Imports adicionais: `BellOff`, `Ban`, `Trash2` do lucide-react e `AlertDialog` components.

---

### 3. ChatInput: Respostas rapidas com atalho "/"

Arquivo: `src/components/whatsapp/ChatInput.tsx`

Comportamento:
- Quando usuario digita "/" no inicio da mensagem, buscar respostas rapidas da instancia (GET via edge function `list-quick-replies`)
- Exibir dropdown acima do input com as opcoes filtradas pelo texto apos "/"
- Ao selecionar, substitui o texto do input pelo conteudo da resposta
- Cache local das respostas rapidas por chipId (busca apenas 1x por sessao)

Props novas: `chipId: string | null` (passado do ChatWindow)

UI: Popover sobre o input mostrando lista de atalhos + texto preview, filtravel.

Gestao de respostas rapidas (CRUD) sera acessivel por um botao no header ou via painel admin futuramente — nesta versao, apenas o consumo das respostas ja cadastradas na UazAPI.

---

### Detalhes tecnicos

| Funcionalidade | Endpoint UazAPI | Payload principal |
|---|---|---|
| Deletar chat | POST /chat/delete | `{ number, deleteWhatsApp, deleteDB, deleteMessages }` |
| Silenciar chat | POST /chat/mute | `{ number, duration }` |
| Bloquear contato | POST /chat/block | `{ number, block }` |
| Listar respostas rapidas | GET /quickreply/showall | - (header token) |
| CRUD resposta rapida | POST /quickreply/edit | `{ shortCut, text, id?, delete? }` |

### Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/uazapi-api/index.ts` | 5 novos cases no switch |
| `src/components/whatsapp/ChatSidebar.tsx` | 3 novos handlers + menu items (silenciar, bloquear, deletar) |
| `src/components/whatsapp/ChatInput.tsx` | Sistema de respostas rapidas com "/" |
| `src/components/whatsapp/ChatWindow.tsx` | Passar chipId ao ChatInput |

