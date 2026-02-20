
## Correções Completas - Interface WhatsApp (Somente UazAPI)

### Problema Raiz Identificado

Analisando os logs reais do webhook e a documentacao `uazapidoc.md`, identifiquei os campos exatos que a UazAPI retorna:

- `msg.mediaType` = `"ptt"`, `"image"`, `""` (campo correto, minusculo simples)
- `msg.messageType` = `"AudioMessage"`, `"ImageMessage"`, `"Conversation"` (PascalCase com sufixo "Message")
- `msg.type` = `"media"` ou `"text"`

Os problemas:

1. **Mensagens enviadas mostram "Midia (imagemessage)"**: O `fetch-messages` nao converte `messageType` como "AudioMessage"/"ImageMessage" para tipos simples ("audio"/"image"). Esses valores caem no fallback e sao exibidos como texto.
2. **Mensagens recebidas mostram "Erro"**: O `download-media` funciona, mas o `messageId` armazenado pode estar no formato errado (com prefixo `owner:`) ou o webhook nao esta salvando corretamente para algumas mensagens.
3. **Menu de contexto invisivel**: O ChevronDown no hover esta posicionado FORA da bolha com posicao absoluta negativa, podendo ser cortado pelo overflow do container pai.
4. **Conversas somem ao trocar chip**: A sidebar reseta corretamente para o novo chip, mas como `setSelectedChat(null)` limpa a conversa selecionada E o cache pode estar vazio, a UI parece "sumir".

---

### Correcoes Planejadas

#### 1. Normalizar `messageType` da UazAPI no fetch-messages

**Arquivo**: `supabase/functions/uazapi-api/index.ts` (acao `fetch-messages`)

Adicionar funcao de normalizacao que converte os valores PascalCase da UazAPI para tipos simples:

```
"ImageMessage" -> "image"
"AudioMessage" -> "audio"  
"PttMessage" -> "ptt"
"VideoMessage" -> "video"
"DocumentMessage" -> "document"
"StickerMessage" -> "sticker"
"Conversation" -> "text"
```

Aplicar essa normalizacao em `detectedMediaType` ANTES de verificar se e midia.

#### 2. Normalizar `messageType` no webhook tambem

**Arquivo**: `supabase/functions/evolution-webhook/index.ts` (funcao `handleUazapiMessage`)

O webhook usa `msg.mediaType` que funciona quando preenchido (ex: `"ptt"`, `"image"`), mas quando `msg.mediaType` esta vazio, deve fazer fallback para `msg.messageType` normalizado. Adicionar a mesma funcao de normalizacao.

#### 3. Corrigir messageId no download-media

**Arquivo**: `supabase/functions/uazapi-api/index.ts` (acao `download-media`)

O `messageid` da UazAPI pode vir no formato `"owner:HEXID"` (ex: `"554898119529:2A5B98D01B9ABF1767C6"`). O endpoint `/message/download` da UazAPI aceita o campo `id` que pode ser o `messageid` completo. Garantir que estamos passando o ID correto sem manipulacao.

#### 4. Corrigir visibilidade do menu de contexto

**Arquivo**: `src/components/whatsapp/MessageBubble.tsx`

Mover o botao ChevronDown para DENTRO da bolha da mensagem em vez de usar posicao absoluta fora dela. Usar `overflow-visible` no container para evitar cortes.

#### 5. Manter conversas visiveis ao trocar chip

**Arquivo**: `src/components/whatsapp/ChatSidebar.tsx`

Quando `chipId` muda, nao limpar o estado `chats` -- manter os dados do chip anterior visiveis ate os novos dados carregarem, usando o cache como fonte imediata.

---

### Detalhes Tecnicos

**Arquivos a modificar:**

1. **`supabase/functions/uazapi-api/index.ts`**:
   - Adicionar funcao `normalizeMessageType(messageType: string): string` que converte PascalCase para tipo simples
   - No `fetch-messages`, aplicar normalizacao: `detectedMediaType = normalizeMessageType(m.messageType) || m.mediaType || ''`
   - No `download-media`, usar `messageId` sem manipulacao

2. **`supabase/functions/evolution-webhook/index.ts`**:
   - Adicionar a mesma funcao `normalizeMessageType`
   - Em `handleUazapiMessage`, se `msg.mediaType` estiver vazio, usar `normalizeMessageType(msg.messageType)` como fallback

3. **`src/components/whatsapp/MessageBubble.tsx`**:
   - Reposicionar o botao ChevronDown para dentro da bolha, no canto superior direito
   - Adicionar `overflow-visible` ao container
   - Expandir `MEDIA_KEYWORDS` para incluir variantes com sufixo "message" como fallback

4. **`src/components/whatsapp/ChatSidebar.tsx`**:
   - Verificar cache para novo chipId antes de mostrar loading

5. **`src/components/whatsapp/MediaRenderer.tsx`**:
   - Melhorar o estado de erro para ser mais sutil

---

### Prompt para Knowledge do Projeto

Ao final da implementacao, sera fornecido um prompt para incluir no knowledge do projeto, reforçando que toda consulta de API deve usar exclusivamente a documentacao `uazapidoc.md` e o provedor UazAPI.
