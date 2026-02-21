
## Correcao do Mismatch LID: Resolucao Definitiva via /chat/details

### Problema Identificado (caso concreto FRANCISCO)

Dados reais encontrados no banco:

| Tabela | remote_jid | contact_phone | Mensagens |
|--------|-----------|---------------|-----------|
| conversations | `79710449049664@lid` | `79710449049664@lid` | 0 (criada pelo sync) |
| conversations | `558586297491@s.whatsapp.net` | `558586297491` | 1 (criada pelo webhook) |
| message_history | `558586297491@s.whatsapp.net` | `558586297491` | 1 mensagem real |

O usuario ve a conversa `@lid` na sidebar (que tem o texto da ultima mensagem vindo do sync), clica nela, e o ChatWindow busca por `79710449049664@lid` -- 0 resultados. A busca dual falha porque `contact_phone` contem `79710449049664@lid` (numero LID, nao o telefone real).

**Sao 265 conversas nesta mesma situacao.**

### Causa Raiz

1. O `/chat/find` da UazAPI retorna `wa_chatid = 79710449049664@lid` com `phone` vazio para muitos contatos
2. O `resolveJid()` nao consegue resolver sem `phone`, entao usa o LID como `canonicalJid`
3. O `contact_phone` e preenchido com `canonicalJid.split('@')[0]` = `79710449049664` (LID, nao telefone)
4. A auto-correcao no webhook compara `contact_phone == recipientPhone` mas `79710449049664 != 558586297491`
5. Resultado: duas conversas duplicadas que nunca se conectam

### Solucao em 3 Partes

#### Parte 1: sync-history -- Forcar resolucao via /chat/details para TODOS os chats @lid

Quando `chat.phone` esta vazio e o `wa_chatid` e `@lid`:
- SEMPRE chamar `/chat/details` passando o LID como `number`
- Extrair o campo `phone` da resposta (conforme doc UazAPI, /chat/details retorna "phone" entre os campos)
- Usar esse phone para construir o JID canonico `phone@s.whatsapp.net`
- Salvar o phone real no `contact_phone` da conversa
- Remover o limite de 10 chamadas de `/chat/details` para contatos LID (manter limite para profile pics de contatos normais)

**Arquivo**: `supabase/functions/sync-history/index.ts`

Mudancas especificas:
- Na funcao `resolveJid`: aceitar um parametro opcional `resolvedPhone` que vem de `/chat/details`
- No loop de processamento: para cada chat LID sem phone, chamar `/chat/details` ANTES de resolver o JID
- Separar o contador de profile pic fetches do contador de phone resolution fetches
- `contactPhone` deve usar o phone resolvido, NUNCA o numero LID

#### Parte 2: evolution-webhook -- Corrigir auto-correcao para funcionar sem phone match

A auto-correcao atual falha porque `contact_phone` contem o LID. Nova estrategia:

Quando o webhook recebe uma mensagem com `@s.whatsapp.net` e cria uma conversa:
- Apos o upsert, verificar se existe uma conversa DUPLICADA `@lid` para o MESMO chip
- Como nao podemos comparar por phone (LID != phone), comparar por `contact_name`:
  - Se o webhook recebe `chat.wa_contactName` ou `chat.name`, buscar conversa `@lid` com mesmo nome
  - Se encontrar match unico, deletar a conversa `@lid` (a `@s.whatsapp.net` ja tem os dados corretos)
- Alternativa mais segura: nao tentar auto-corrigir no webhook, deixar o sync-history resolver

**Arquivo**: `supabase/functions/evolution-webhook/index.ts`

Mudanca: remover a auto-correcao por `contact_phone` (que nunca funciona) e manter a logica simples de upsert por `remote_jid`.

#### Parte 3: Migration SQL -- Limpar as 265 conversas @lid duplicadas

Para cada conversa `@lid`, verificar se ja existe uma conversa `@s.whatsapp.net` para o mesmo chip com mensagens reais. Se sim, deletar a `@lid` (que nao tem mensagens). Se nao, manter e deixar o sync-history resolver na proxima execucao.

```text
-- Delete @lid conversations that have a duplicate @s.whatsapp.net 
-- conversation for the same chip (the @s.whatsapp.net one has the real messages)
DELETE FROM conversations 
WHERE remote_jid LIKE '%@lid' 
AND EXISTS (
  SELECT 1 FROM message_history m 
  WHERE m.chip_id = conversations.chip_id 
  AND m.remote_jid LIKE '%@s.whatsapp.net'
  AND m.remote_jid != conversations.remote_jid
  -- match by looking if any message exists for the same chip
  -- that was created around the same time as the @lid conversation
);

-- More targeted: for remaining @lid convos, strip the @lid suffix 
-- from contact_phone to not pollute dual-query logic
UPDATE conversations 
SET contact_phone = REPLACE(contact_phone, '@lid', '')
WHERE contact_phone LIKE '%@lid';
```

A migracao real sera mais conservadora: so deletar `@lid` convos que comprovadamente tem duplicata.

---

### Detalhes Tecnicos

| # | Arquivo | Alteracao |
|---|---------|-----------|
| 1 | `sync-history/index.ts` | Forcar `/chat/details` para TODOS os chats @lid sem phone; usar phone resolvido como canonicalJid e contact_phone |
| 2 | `evolution-webhook/index.ts` | Remover auto-correcao quebrada por contact_phone; simplificar |
| 3 | Migration SQL | Deletar conversas @lid duplicadas; limpar contact_phone removendo sufixo @lid |
