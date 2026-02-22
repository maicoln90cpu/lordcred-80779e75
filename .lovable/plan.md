

## Reconstrucao completa: sync-history + exibicao de chats

### Diagnostico final

O problema tem DUAS camadas:

**Camada 1 - sync-history corrompe dados**: Mesmo com a correcao anterior, o sync-history faz upsert de 342 conversas em sequencia. Cada upsert dispara um evento realtime. O Supabase Realtime pode PERDER eventos quando ha centenas em sequencia rapida. Se o evento do Maicoln (com unread_count=4) for perdido ou substituido por um evento posterior, a sidebar fica com dados desatualizados.

**Camada 2 - Sem re-fetch apos sync**: Quando o sync termina, o frontend NAO re-busca os chats do banco. Ele depende 100% dos eventos realtime, que podem ter sido perdidos. Resultado: o estado local fica inconsistente com o banco.

**Por que o filtro "Nao lidas" funciona**: O contador no topo usa `fetchAllUnreadCounts` que re-consulta o banco a cada mudanca. O filtro "Nao lidas" tambem dispara a mesma query. Mas a sidebar geral usa o estado local (`chats`) que ficou desatualizado.

### Plano de reconstrucao (3 partes)

---

#### Parte 1: Reconstruir sync-history completamente

**Arquivo**: `supabase/functions/sync-history/index.ts`

Principios da nova versao:
- NUNCA sobrescrever `unread_count` (remover completamente do upsert)
- NUNCA sobrescrever `last_message_text` com string vazia
- NUNCA sobrescrever `is_archived` (remover do upsert — deixar o webhook e acoes manuais controlarem)
- NUNCA sobrescrever `is_pinned`, `is_starred`, `custom_status`, `label_ids` (campos geridos pelo usuario)
- Upsert de conversa atualiza APENAS: `contact_name`, `contact_phone`, `wa_name`, `profile_pic_url`, `last_message_at`, `is_group`
- Para conversas novas (INSERT), os defaults do banco cuidam de `unread_count=0`, `is_archived=false`, etc.

Mudancas especificas:
```
convData = {
  chip_id,
  remote_jid: canonicalJid,
  contact_name: contactName,
  contact_phone: contactPhone,
  is_group: isGroup,
}

// Apenas incluir se tiver valor real
if (lastMsgAt) convData.last_message_at = lastMsgAt
if (waName) convData.wa_name = waName
if (profilePicUrl) convData.profile_pic_url = profilePicUrl

// last_message_text: SOMENTE se a UazAPI retornou texto real
const apiLastMsg = chat.wa_lastMessageTextVote || chat.lastMessage || ''
if (apiLastMsg.length > 0) convData.last_message_text = apiLastMsg

// unread_count: NUNCA incluir no upsert (preservar valor do webhook/mark-read)
// is_archived: NUNCA incluir no upsert (preservar estado do usuario)
```

---

#### Parte 2: Adicionar re-fetch apos sync no frontend

**Arquivo**: `src/components/whatsapp/ChatSidebar.tsx`

Adicionar uma prop `refreshKey` que, ao mudar, dispara `fetchChats()` novamente:

```typescript
interface ChatSidebarProps {
  ...
  refreshKey?: number; // incrementado apos sync
}
```

No `useEffect`:
```typescript
useEffect(() => {
  if (chipId) fetchChats();
}, [fetchChats, chipId, refreshKey]);
```

**Arquivo**: `src/pages/WhatsApp.tsx`

Apos `runStagedSync` terminar, incrementar `refreshTrigger` e passar como `refreshKey`:

```typescript
// Em runStagedSync, apos o loop while:
setRefreshTrigger(prev => prev + 1);

// Na renderizacao:
<ChatSidebar refreshKey={refreshTrigger} ... />
```

---

#### Parte 3: Re-executar backfill

**Migracao SQL**: Executar novamente o backfill para corrigir dados que o sync-history corrompeu:

```
UPDATE conversations c SET
  last_message_text = sub.message_content,
  last_message_at = sub.created_at,
  updated_at = now()
FROM (
  SELECT DISTINCT ON (chip_id, remote_jid)
    chip_id, remote_jid, message_content, created_at
  FROM message_history
  WHERE message_content IS NOT NULL
    AND message_content != ''
    AND message_content != 'EMPTY'
    AND remote_jid IS NOT NULL
  ORDER BY chip_id, remote_jid, created_at DESC
) sub
WHERE c.chip_id = sub.chip_id
  AND c.remote_jid = sub.remote_jid
  AND (c.last_message_text IS NULL OR c.last_message_text = '')
```

---

### Resumo das alteracoes

| Arquivo / Recurso | Alteracao |
|---|---|
| `sync-history/index.ts` | Reconstruir inteiro: remover `unread_count`, `is_archived` do upsert, proteger `last_message_text` |
| `ChatSidebar.tsx` | Adicionar prop `refreshKey` para re-fetch apos sync |
| `WhatsApp.tsx` | Passar `refreshTrigger` como `refreshKey`, incrementar apos sync |
| Migracao SQL | Re-executar backfill de `last_message_text` |

### Resultado esperado

- sync-history NUNCA mais corrompe `unread_count`, `last_message_text` ou `is_archived`
- Apos cada sync, o frontend busca dados frescos do banco, eliminando dependencia de realtime durante sync
- Badge de nao lidas permanece visivel em TODAS as views (geral, filtrada, topo)

