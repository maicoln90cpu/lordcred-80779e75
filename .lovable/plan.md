
## Diagnostico Definitivo: Mismatch de JID (@lid vs @s.whatsapp.net)

### Problema Raiz Confirmado

Analise direta do banco de dados revelou:

- **Tabela conversations**: 337 conversas usam formato `@lid` (novo formato WhatsApp), 768 usam `@s.whatsapp.net`
- **Tabela message_history**: ZERO mensagens com `@lid`. Todas as 90 mensagens usam `@s.whatsapp.net` ou `@g.us`

O webhook recebe mensagens com `msg.chatid` = `5511999136884@s.whatsapp.net` (formato telefone). Mas o `/chat/find` retorna `wa_chatid` = `79710449049664@lid` (formato LID). O sync-history cria conversas com o JID LID, mas as mensagens chegam via webhook com JID telefone. **Resultado: o ChatWindow busca por `@lid` mas as mensagens estao armazenadas com `@s.whatsapp.net` - zero resultados.**

Exemplo concreto do banco:
- Conversa "Maicoln Douglas Gomes" com `remote_jid = 5511999136884@s.whatsapp.net` tem **86 mensagens** (funciona!)
- Conversa "79710449049664" com `remote_jid = 79710449049664@lid` tem **0 mensagens** (quebrado!)

### Plano de Correcao (3 frentes)

#### 1. Refazer sync-history com resolucao LID-para-PN

**Arquivo**: `supabase/functions/sync-history/index.ts` (reescrita significativa)

A UazAPI retorna tanto `wa_chatid` quanto `wa_chatlid` no Chat schema. Alem disso, o endpoint `/chat/details` pode resolver o numero de telefone real para contatos LID.

Mudancas:
- Para cada chat retornado pelo `/chat/find`:
  - Se `wa_chatid` for `@s.whatsapp.net` ou `@g.us`: usar diretamente
  - Se `wa_chatid` for `@lid`: tentar resolver via `chat.phone` (se for numero valido) ou consultar `/chat/details` para obter o numero real
  - Salvar a conversa com o JID `@s.whatsapp.net` quando possivel
- Implementar mapeamento LID -> PN em memoria durante o sync
- Para `/message/find`: se o chatid original (`wa_chatid`) for `@lid`, enviar o LID para a API (pois a API interna usa LID), mas salvar as mensagens com o JID `@s.whatsapp.net` resolvido

#### 2. Sync em etapas (staged) para evitar timeout

**Arquivo**: `supabase/functions/sync-history/index.ts`

Edge Functions tem limite de tempo. Com 200 chats e chamadas sequenciais, o sync pode expirar.

Mudancas:
- Processar no maximo **30 chats por invocacao**
- Usar campo `last_sync_cursor` na tabela `chips` para rastrear progresso (indice do chat atual)
- O frontend chama o sync em loop ate receber `hasMore: false`
- Cada etapa retorna `{ hasMore: true/false, processed: N, total: N }`
- Adicionar delay de 200ms entre chamadas API para evitar rate limiting

#### 3. Limpeza de conversas @lid duplicadas

**Migration SQL**:
- Para cada conversa `@lid`, verificar se existe uma conversa `@s.whatsapp.net` para o mesmo chip
- Se existir duplicata, mover dados relevantes (notes, labels, pins) para a versao `@s.whatsapp.net` e deletar a `@lid`
- Se nao existir duplicata mas o telefone for resolvivel, atualizar o `remote_jid` para `@s.whatsapp.net`

#### 4. Atualizar frontend para sync em etapas

**Arquivo**: `src/pages/WhatsApp.tsx`

Mudancas no `handleSyncHistory` e `handleSelectChip`:
- Chamar sync-history em loop ate `hasMore === false`
- Mostrar progresso real (ex: "Sincronizando... 30/200 chats")
- Adicionar delay de 1s entre chamadas para nao sobrecarregar

#### 5. Debug logging agressivo

**Arquivo**: `supabase/functions/sync-history/index.ts`

- Logar o body bruto de `/message/find` para os PRIMEIROS 3 chats (antes de qualquer parsing)
- Logar todos os campos do chat retornado pelo `/chat/find` para os primeiros 3 chats (wa_chatid, wa_chatlid, phone, etc)
- Logar o JID resolvido vs JID original

### Detalhes Tecnicos

| # | Arquivo | Alteracao |
|---|---------|-----------|
| 1 | `sync-history/index.ts` | Reescrita: resolucao LID->PN, sync em etapas (30 chats/call), debug logging |
| 2 | `WhatsApp.tsx` | Loop de sync com progresso visual |
| 3 | Migration SQL | Limpeza de conversas @lid duplicadas |
| 4 | `chips` table | Adicionar coluna `last_sync_cursor` (integer, default 0) |
