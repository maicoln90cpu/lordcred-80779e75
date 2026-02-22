

## Plano: Leitura bidirecional completa via UazAPI (sem persistencia local de notificacoes)

### Problema atual
1. O endpoint `mark-read` na edge function `uazapi-api` envia `{ number: chatId }` mas **nao inclui o campo `read: true`** exigido pela documentacao da UazAPI
2. O `ChatWindow` atualiza `unread_count` no banco local ao abrir um chat -- isso deve ser removido pois a sincronizacao deve ser 100% via UazAPI
3. O `ChatSidebar` tem funcao `handleClearAllUnread` que zera unread_count direto no banco -- deve enviar mark-read para UazAPI em cada conversa
4. O webhook (`evolution-webhook`) incrementa `unread_count` localmente ao receber mensagem -- isso deve ser mantido como fallback ate que a UazAPI retorne o valor real via evento `chats`

### Alteracoes

#### 1. Edge function `uazapi-api` - Corrigir payload do mark-read

**Arquivo**: `supabase/functions/uazapi-api/index.ts`

Adicionar o campo `read: true` ao body do POST `/chat/read`:
```typescript
body: JSON.stringify({ number: chatId, read: true })
```

Alem disso, adicionar nova action `mark-unread` que envia `read: false`:
```typescript
case 'mark-unread': {
  // mesma logica, mas com read: false
  body: JSON.stringify({ number: chatId, read: false })
}
```

Tambem atualizar o `unread_count` no banco apos sucesso do mark-read (zerar) e mark-unread (setar para 1):
```typescript
// Apos sucesso do mark-read:
await adminClient.from('conversations').update({ unread_count: 0 }).eq('chip_id', chipId).eq('remote_jid', chatId)

// Apos sucesso do mark-unread:
await adminClient.from('conversations').update({ unread_count: 1 }).eq('chip_id', chipId).eq('remote_jid', chatId)
```

#### 2. ChatWindow - Simplificar mark-read (remover update local duplicado)

**Arquivo**: `src/components/whatsapp/ChatWindow.tsx`

Linhas 178-192: Remover o `supabase.from('conversations').update({ unread_count: 0 })` duplicado. A edge function ja vai cuidar disso apos confirmar com a UazAPI. Manter apenas a chamada `supabase.functions.invoke('uazapi-api', { body: { action: 'mark-read', chipId, chatId } })`.

#### 3. ChatSidebar - Marcar como lido/nao lido via UazAPI

**Arquivo**: `src/components/whatsapp/ChatSidebar.tsx`

- Modificar `handleClearAllUnread` (linha 411) para iterar sobre conversas com unread > 0 e chamar `uazapi-api` com `action: 'mark-read'` para cada uma, em vez de apenas zerar no banco
- Adicionar botao/opcao no menu de contexto de cada conversa para "Marcar como nao lida" que chama `action: 'mark-unread'`

#### 4. Webhook - Manter incremento de unread como fallback

**Arquivo**: `supabase/functions/evolution-webhook/index.ts`

O incremento de `unread_count` ao receber mensagem nova (linha 168) sera **mantido** -- isso garante que o badge apareca imediatamente via Realtime, mesmo antes de qualquer sync. O valor sera corrigido quando o usuario abrir o chat (mark-read via UazAPI).

### Resumo

| Arquivo | Alteracao |
|---------|-----------|
| `uazapi-api/index.ts` | Corrigir payload mark-read (`read: true`), adicionar `mark-unread` (`read: false`), atualizar DB apos sucesso |
| `ChatWindow.tsx` | Remover update local de unread_count (linhas 186-191) |
| `ChatSidebar.tsx` | `handleClearAllUnread` via UazAPI; adicionar opcao "Marcar como nao lida" no menu |
| `evolution-webhook/index.ts` | Sem alteracao (manter incremento como fallback) |

### Secao tecnica

O fluxo completo bidirecional sera:

1. **Abrir chat** -> ChatWindow chama `mark-read` -> edge function envia `POST /chat/read { number, read: true }` -> atualiza `unread_count: 0` no banco -> Realtime propaga para sidebar
2. **Marcar como nao lida** -> ChatSidebar chama `mark-unread` -> edge function envia `POST /chat/read { number, read: false }` -> atualiza `unread_count: 1` no banco -> Realtime propaga
3. **Nova mensagem do WhatsApp** -> webhook incrementa unread_count -> Realtime propaga badge
4. **Limpar todas nao lidas** -> itera conversas com unread > 0 -> chama mark-read para cada -> DB atualizado via edge function

