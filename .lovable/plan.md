

## Correcao Completa - 6 Problemas Identificados

### Diagnostico dos Logs

Os logs confirmam: `/chat/find` retorna 50 chats com sucesso, mas `/message/find` retorna **0 mensagens para TODOS os chats**. Isso significa que o parsing da resposta de `/message/find` esta falhando silenciosamente. A resposta da UazAPI provavelmente usa formato paginado (`{ messages: [...], total: N }`) ou outro formato que `extractArray` nao captura corretamente, OU a API retorna dados mas o campo `chatid` no body precisa ser em formato diferente.

---

### 1. Filtro por Conversas Normais vs Grupos

**Arquivo**: `ChatSidebar.tsx`
- Adicionar botoes de filtro "Pessoas" e "Grupos" na barra de filtros existente (ao lado de "Nao lidas", "Favoritas", etc.)
- Filtrar por `isGroup === true` ou `isGroup === false`
- Quando "Grupos" ativo, mostrar apenas conversas com `@g.us`
- Quando "Pessoas" ativo, excluir grupos

### 2. Grupos que nao existem mais (COMPRA E VENDA)

**Problema**: Conversas deletadas no WhatsApp real continuam aparecendo porque a tabela `conversations` do Supabase mantem os dados antigos. O sync so faz upsert (adiciona/atualiza), nunca remove.

**Correcao no `sync-history/index.ts`**:
- Apos buscar os chats da UazAPI, coletar todos os `remote_jid` retornados
- Comparar com as conversas existentes no banco para esse chip
- Marcar como arquivadas (ou deletar) as conversas que nao foram retornadas pela UazAPI (exceto se forem muito antigas, pois o `/chat/find` tem limite)
- Para ser seguro: marcar `is_archived = true` em vez de deletar, com um campo `stale_since` para tracking

### 3. Fotos de perfil nao carregam

**Problema**: O campo `profile_pic_url` esta sendo preenchido com `chat.imagePreview || chat.image` no sync-history e webhook, mas:
- O Chat schema da UazAPI mostra campos `image` (URL da imagem) e `imagePreview` (URL da miniatura)
- Porem o `/chat/find` pode nao retornar esses campos preenchidos por padrao
- A UazAPI tem o endpoint `POST /chat/details` que retorna dados completos incluindo URLs de imagem em dois tamanhos

**Correcao**:
- No `sync-history`, apos obter a lista de chats, para cada chat que NAO tem `imagePreview` ou `image`, fazer uma chamada a `POST /chat/details` com `{ number: remoteJid }` para obter a foto
- Limitar a 20 chamadas de detalhes por sync para nao sobrecarregar
- Salvar `profile_pic_url` no banco com a URL retornada

### 4 e 5. Mensagens nao aparecem no chat (0 messages em TODOS os chats)

**Problema principal confirmado pelos logs**: O `/message/find` retorna dados, mas o parsing falha. A resposta paginada da UazAPI provavelmente tem formato `{ results: [...], total: N, page: N }` ou similar que `extractArray` nao captura. Tambem e possivel que o campo `chatid` precise estar em formato JID completo.

**10 possiveis erros identificados**:

1. **Resposta paginada nao parseada**: `/message/find` retorna objeto com metadata (`total`, `page`, `limit`) e as mensagens em uma chave que `extractArray` nao encontra (ex: `records`, `rows`, `list`)
2. **Campo `chatid` vs `number`**: A documentacao mostra `chatid` como campo de busca, mas pode ser `number` ou `chat_id` dependendo da versao
3. **Sem log do response body**: O codigo nao loga o corpo da resposta quando `messages.length === 0`, tornando impossivel debugar o formato real
4. **O campo `text` pode ser vazio**: Mensagens de midia tem `text` vazio, e o codigo filtra `typeof m.text === 'string'` mas nao considera `m.content`
5. **`messageid` pode ser nulo**: Para mensagens antigas, o `messageid` pode vir vazio, e o codigo faz `if (!msgId) continue` descartando-as
6. **Timestamp filtering muito agressivo**: `tenDaysAgo` descarta mensagens com timestamp errado ou em formato inesperado
7. **O campo `fromMe` pode ser string**: `m.fromMe` pode ser `"true"` (string) em vez de `true` (boolean)
8. **Rate limiting da UazAPI**: 50 chats x 100 messages = 50 requests sequenciais, pode causar throttling
9. **`message_id` unique constraint**: Se o `message_id` ja existe de outra fonte (webhook), `ignoreDuplicates: true` ignora a mensagem silenciosamente - mas isso deveria funcionar
10. **Token expirado durante sync**: O token da instancia pode expirar ou ser invalidado durante o loop de 50 chats

**Correcao principal no `sync-history/index.ts`**:
- Adicionar log do response body bruto de `/message/find` para o PRIMEIRO chat (para debug)
- Adicionar mais chaves ao `extractArray`: `records`, `rows`, `list`, `result`
- Testar se a resposta e um objeto com uma unica chave que contem o array
- Se `extractArray` retorna vazio, logar as chaves do objeto de resposta
- Tratar `fromMe` como string ou boolean

### 6. Badge +99 nao lidas incorreto

**Problema**: O `unread_count` na tabela `conversations` esta inflado porque:
- O webhook incrementa `unread_count` para cada mensagem incoming
- O sync-history faz upsert com `chat.wa_unreadCount` que pode ser um valor alto da UazAPI
- Nunca ha limpeza/recalculo correto

**Correcao**:
- No `sync-history`, usar `chat.wa_unreadCount` diretamente da UazAPI (que reflete o estado real do WhatsApp)
- No frontend, ao abrir um chat, garantir que o `unread_count` e zerado tanto no banco quanto na UazAPI
- Adicionar botao "Marcar tudo como lido" no header do chip

---

### Detalhes Tecnicos

| # | Arquivo | Alteracao |
|---|---------|-----------|
| 1 | `ChatSidebar.tsx` | Adicionar filtros "Pessoas" e "Grupos" |
| 2 | `sync-history/index.ts` | Marcar conversas orfas como arquivadas |
| 3 | `sync-history/index.ts` | Chamar `/chat/details` para buscar fotos de perfil |
| 4-5 | `sync-history/index.ts` | Adicionar logs detalhados do response body, expandir `extractArray`, tratar edge cases |
| 6 | `sync-history/index.ts` + `WhatsApp.tsx` | Corrigir unread_count com valor real da UazAPI |

