

## 5 Novas Funcionalidades para o WhatsApp

### 1. Nova conversa digitando numero de celular

Adicionar um botao "Nova conversa" (icone `MessageSquarePlus`) na sidebar do chat, acima da busca. Ao clicar, abre um Dialog onde o usuario digita um numero de telefone (ex: `5511999999999`). Ao confirmar:
- Formatar o JID como `numero@s.whatsapp.net`
- Criar/upsert uma conversa na tabela `conversations` com os dados basicos
- Selecionar automaticamente o chat recem-criado via `onSelectChat`

**Arquivo**: `src/components/whatsapp/ChatSidebar.tsx`
- Novo estado `newChatDialogOpen` e `newChatNumber`
- Novo handler `handleStartNewChat` que faz upsert em `conversations` e chama `onSelectChat`
- Dialog com Input para digitar o numero

### 2. Nova conversa puxando contato da agenda (busca no WhatsApp)

Dentro do mesmo Dialog de nova conversa, adicionar uma busca que consulta contatos existentes no banco (`conversations` do chip atual). O usuario pode digitar parte do nome ou numero e ver resultados filtrados para selecionar rapidamente.

**Arquivo**: `src/components/whatsapp/ChatSidebar.tsx`
- No Dialog de nova conversa, buscar `conversations` do chip com filtro por nome/telefone
- Exibir lista de contatos encontrados para selecao rapida
- Ao selecionar, navegar direto para o chat

### 3. Renomear chip pelo dropdown (seta ao lado do numero)

No `ChipSelector.tsx`, adicionar uma opcao "Renomear" no dropdown de cada chip. Ao clicar, exibe um Dialog com Input para alterar o nickname. Salva direto na tabela `chips`.

**Arquivo**: `src/components/whatsapp/ChipSelector.tsx`
- Nova opcao `DropdownMenuItem` "Renomear" com icone `Pencil`
- Novo estado `renameDialogOpen`, `chipToRename`, `renameValue`
- Handler `handleRename` que faz `supabase.from('chips').update({ nickname })` e atualiza o estado local

### 4. Clicar em numero de telefone nas mensagens para iniciar conversa

No `MessageBubble.tsx`, detectar numeros de telefone no texto da mensagem (regex para formatos brasileiros e internacionais) e transforma-los em links clicaveis. Ao clicar, dispara um callback que cria/abre a conversa com aquele numero.

**Arquivo**: `src/components/whatsapp/MessageBubble.tsx`
- Atualizar `formatWhatsAppText` para detectar numeros de telefone (regex: sequencias de 10-13 digitos, com ou sem formatacao)
- Renderizar como `<button>` clicavel com estilo de link
- Nova prop `onStartChat?: (phone: string) => void`

**Arquivo**: `src/components/whatsapp/ChatWindow.tsx`
- Passar `onStartChat` ao MessageBubble
- Handler que cria conversa e seleciona o chat (via callback para `WhatsApp.tsx`)

**Arquivo**: `src/pages/WhatsApp.tsx`
- Nova prop `onStartNewChat` passada ao ChatWindow
- Handler que faz upsert em `conversations` e seleciona o chat

### 5. Links do WhatsApp funcionais (wa.me, api.whatsapp.com)

Tambem no `formatWhatsAppText` do `MessageBubble.tsx`, detectar links `https://wa.me/NUMERO` e `https://api.whatsapp.com/send?phone=NUMERO`. Em vez de abrir no navegador, extrair o numero e disparar o mesmo callback `onStartChat` para abrir a conversa dentro da plataforma.

**Arquivo**: `src/components/whatsapp/MessageBubble.tsx`
- No regex de URL existente, verificar se e um link wa.me ou api.whatsapp.com
- Se for, renderizar como botao que chama `onStartChat` com o numero extraido
- Se nao for, manter o comportamento atual (abrir em nova aba)

---

### Detalhes tecnicos

| Funcionalidade | Arquivo(s) | Tipo de alteracao |
|---|---|---|
| Nova conversa por numero | `ChatSidebar.tsx` | Dialog + upsert em conversations |
| Nova conversa por busca de contato | `ChatSidebar.tsx` | Filtro no mesmo dialog |
| Renomear chip | `ChipSelector.tsx` | Dialog + update em chips |
| Numero clicavel na mensagem | `MessageBubble.tsx`, `ChatWindow.tsx`, `WhatsApp.tsx` | Regex + callback chain |
| Links wa.me funcionais | `MessageBubble.tsx` | Interceptar links WhatsApp |

### Fluxo de nova conversa

```text
[Dialog "Nova Conversa"]
   |
   |-- [Tab 1: Digitar numero] --> Input telefone --> Upsert conversations --> onSelectChat
   |
   |-- [Tab 2: Buscar contato] --> Filtro nome/telefone --> Selecionar --> onSelectChat
```

### Regex para deteccao de telefones

```text
Telefones: /\b(\+?\d{2,3}[\s.-]?\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4})\b/
Links WhatsApp: /https?:\/\/(wa\.me|api\.whatsapp\.com\/send\?phone=)(\d+)/
```

