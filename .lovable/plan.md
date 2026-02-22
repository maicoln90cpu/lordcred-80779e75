

## Correcao: sync-history sobrescreve unread_count e last_message_text

### O problema

As linhas 354 e 356 do `sync-history/index.ts` estao destruindo dados validos durante a sincronizacao:

- **Linha 354**: `last_message_text: chat.wa_lastMessageTextVote || chat.lastMessage || ''` — quando a UazAPI retorna vazio, sobrescreve o texto que o trigger/backfill preencheu com string vazia
- **Linha 356**: `unread_count: unreadCount` — quando `wa_unreadCount` e 0, sobrescreve o valor real definido pelo webhook

Resultado: o badge de 2 mensagens do Maicoln desaparece na listagem geral (porque o sync zerou), mas o contador no topo e o filtro ainda capturam o valor correto por timing diferente.

### Correcao

**Arquivo**: `supabase/functions/sync-history/index.ts` (linhas 349-359)

Montar o `convData` sem incluir `last_message_text` e `unread_count` por padrao. Incluir apenas quando os valores da UazAPI sao reais (texto nao vazio, unread > 0):

```typescript
const convData: any = {
  chip_id: chipId,
  remote_jid: canonicalJid,
  contact_name: contactName,
  contact_phone: contactPhone,
  last_message_at: lastMsgAt || new Date().toISOString(),
  is_group: isGroup,
  is_archived: false,
}

// So atualizar last_message_text se a UazAPI retornou texto real
const apiLastMsg = chat.wa_lastMessageTextVote || chat.lastMessage || ''
if (apiLastMsg.length > 0) {
  convData.last_message_text = apiLastMsg
}

// So atualizar unread_count se > 0 (preserva contadores do webhook)
if (unreadCount > 0) {
  convData.unread_count = unreadCount
}
```

### Resultado

- O trigger SQL continua preenchendo `last_message_text` automaticamente em cada INSERT no `message_history`
- O webhook continua incrementando `unread_count` em mensagens novas
- O sync-history NAO sobrescreve esses valores com dados vazios/zerados da UazAPI
- O badge de nao lidas permanece visivel na listagem geral

### Resumo

| Arquivo | Alteracao |
|---|---|
| `sync-history/index.ts` linhas 349-359 | Remover `last_message_text` e `unread_count` do convData padrao; incluir condicionalmente |

Requer redeploy da edge function `sync-history`.

