

## Diagnostico Final: Mensagens de Ariany e 500+ contatos nao aparecem

### Problema Raiz Encontrado (com provas do banco de dados)

A cadeia de falhas que leva ao "Nenhuma mensagem ainda":

1. **Sync antigo** salvou mensagens em `message_history` com JID `@lid` (ex: `79921422553247@lid` = Ariany, com 46 mensagens)
2. **Migration anterior** converteu conversas de `@lid` para `@s.whatsapp.net`, mas usou o numero LID como se fosse telefone: `79921422553247@s.whatsapp.net` (INVALIDO)
3. **Sync novo** (com resolucao de LID) resolveu corretamente o telefone real e criou a conversa `554898111929@s.whatsapp.net` (Ariany Lord Cred)
4. **Resultado**: a sidebar mostra "Ariany Lord Cred" com `remote_jid = 554898111929@s.whatsapp.net`, mas as mensagens estao salvas com `remote_jid = 79921422553247@lid` -- ZERO MATCH

Dados concretos do banco para chip `fc818d1f`:
- 476 conversas totais, das quais **327 sao bogus** (numeros LID usados como telefone)
- 197 mensagens com `@lid` que nao correspondem a nenhuma conversa
- A busca dual do ChatWindow NAO funciona porque o `remote_jid` da conversa ja e `@s.whatsapp.net` (nao `@lid`), entao a logica `if (remoteJid.includes('@lid'))` nunca ativa

### Correcao em 2 Partes

#### Parte 1: sync-history -- Migrar mensagens @lid ao resolver LID

Quando o sync resolve `rawJid = 79921422553247@lid` -> `canonicalJid = 554898111929@s.whatsapp.net`:
- Apos o upsert de conversa, executar UPDATE em `message_history` para migrar `remote_jid` de `rawJid` para `canonicalJid`
- Deletar conversa bogus `rawLidNumber@s.whatsapp.net` se existir (da migration anterior)
- Isso garante que mensagens antigas e novas ficam com o mesmo JID

**Arquivo**: `supabase/functions/sync-history/index.ts`

Adicionar apos o upsert de conversa (linha ~363):

```text
// If we resolved a LID to phone, migrate existing messages
if (rawJid.includes('@lid') && canonicalJid !== rawJid) {
  // Update messages stored with @lid to use canonical phone JID
  await adminClient
    .from('message_history')
    .update({ remote_jid: canonicalJid, recipient_phone: contactPhone || null })
    .eq('chip_id', chipId)
    .eq('remote_jid', rawJid)

  // Delete bogus conversation created by old migration (LID as phone)
  const bogusJid = rawJid.replace('@lid', '@s.whatsapp.net')
  await adminClient
    .from('conversations')
    .delete()
    .eq('chip_id', chipId)
    .eq('remote_jid', bogusJid)
}
```

#### Parte 2: Migration SQL -- Limpar dados bogus existentes

Deletar as 552 conversas bogus (numeros LID formatados como `@s.whatsapp.net`) que poluem a sidebar e nunca terao mensagens. Tambem deletar as 2 conversas `@lid` restantes. Na proxima sincronizacao, o sync recriara tudo corretamente.

```text
-- Delete bogus conversations where LID numbers were used as phone
-- (numbers > 13 digits in @s.whatsapp.net are LIDs, not real phones)
DELETE FROM conversations 
WHERE remote_jid LIKE '%@s.whatsapp.net'
AND LENGTH(REPLACE(remote_jid, '@s.whatsapp.net', '')) > 13;

-- Delete remaining @lid conversations
DELETE FROM conversations 
WHERE remote_jid LIKE '%@lid';

-- Delete orphaned @lid messages (will be re-synced with correct JIDs)
DELETE FROM message_history
WHERE remote_jid LIKE '%@lid';
```

### Detalhes Tecnicos

| # | Arquivo | Alteracao |
|---|---------|-----------|
| 1 | `sync-history/index.ts` | Apos resolver LID->phone, UPDATE message_history.remote_jid e DELETE conversa bogus |
| 2 | Migration SQL | Deletar 552 conversas bogus (LID-como-telefone) + 197 mensagens @lid orfas |

Apos a migration e o re-sync, as mensagens da Ariany e dos outros 500+ contatos serao salvas com o JID correto e aparecerao no ChatWindow.

