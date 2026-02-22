
## Diagnostico: Mensagens no banco mas nao aparecem no chat

### Causas encontradas

**Causa 1 - Filtro da sidebar esconde conversas validas**
O filtro que adicionamos na linha 443 do ChatSidebar (`if (!chat.lastMessage) return false`) esta escondendo conversas que possuem mensagens em `message_history` mas cujo campo `last_message_text` na tabela `conversations` esta vazio/null.

Exemplo real do banco: a conversa `559188738747@s.whatsapp.net` tem 5 mensagens em `message_history`, mas `last_message_text` esta vazio na `conversations` — resultado: a conversa nao aparece na sidebar, logo as mensagens nunca sao exibidas.

**Causa 2 - `last_message_text` nao e atualizado por todos os fluxos**
- Mensagens enviadas via `queue-processor` e `warming-engine` inserem em `message_history` mas nem sempre disparam o webhook que atualiza `conversations.last_message_text`
- O `sync-history` preenche `last_message_text` a partir de metadados do chat UazAPI (`wa_lastMessageTextVote` ou `lastMessage`), que podem estar vazios
- Resultado: muitas conversas com mensagens reais no historico mas preview vazio na sidebar

**Causa 3 - Mensagens com conteudo "EMPTY"**
Algumas mensagens outgoing estao armazenadas com `message_content = "EMPTY"` em vez do texto real, provavelmente vindas de envios automaticos que nao retornaram o texto no webhook.

### Dados do banco confirmando

Para o chip `9db50d5b...`:
- 332 conversas no total, apenas 78 com `last_message_text` preenchido
- 168 mensagens em `message_history`
- Muitas conversas com mensagens reais mas `last_message_text` vazio (ex: Paneh, Fernanda)

### Solucao proposta (3 alteracoes)

#### 1. Remover o filtro que esconde conversas sem texto (ChatSidebar)

**Arquivo**: `src/components/whatsapp/ChatSidebar.tsx`

Remover a linha 443 (`if (!chat.lastMessage) return false`). Em vez disso, mostrar todas as conversas, usando um fallback visual quando nao ha texto:
- Se `lastMessage` esta vazio, exibir o numero de telefone ou "Abrir conversa"
- Isso garante que conversas com mensagens em `message_history` sejam acessiveis

#### 2. Criar trigger no banco para manter `last_message_text` sincronizado

**Migracao SQL**: Criar um trigger `AFTER INSERT` na tabela `message_history` que automaticamente atualiza `conversations.last_message_text` e `last_message_at` com o conteudo da mensagem mais recente. Isso resolve o problema na raiz — qualquer mensagem inserida (via webhook, queue, warming, sync) automaticamente atualiza a conversa.

```text
Fluxo:
message_history INSERT -> trigger -> UPDATE conversations SET last_message_text, last_message_at
```

#### 3. Backfill: preencher `last_message_text` para conversas existentes

**Migracao SQL**: Query unica para preencher `last_message_text` de todas as conversas que estao vazias mas possuem mensagens em `message_history`. Isso corrige os dados existentes imediatamente.

### Detalhes tecnicos

**Trigger SQL (item 2)**:
```text
CREATE FUNCTION update_conversation_last_message()
  AFTER INSERT em message_history:
  - Busca a conversa (chip_id + remote_jid)
  - Atualiza last_message_text com NEW.message_content (se nao vazio)
  - Atualiza last_message_at com NEW.created_at
  - Cria a conversa se nao existir (upsert)
```

**Backfill SQL (item 3)**:
```text
UPDATE conversations c SET
  last_message_text = sub.message_content,
  last_message_at = sub.created_at
FROM (
  SELECT DISTINCT ON (chip_id, remote_jid)
    chip_id, remote_jid, message_content, created_at
  FROM message_history
  WHERE message_content IS NOT NULL AND message_content != '' AND message_content != 'EMPTY'
  ORDER BY chip_id, remote_jid, created_at DESC
) sub
WHERE c.chip_id = sub.chip_id AND c.remote_jid = sub.remote_jid
  AND (c.last_message_text IS NULL OR c.last_message_text = '')
```

**ChatSidebar (item 1)**:
- Remover: `if (!chat.lastMessage) return false`
- Na renderizacao, exibir fallback se `lastMessage` vazio:
  ```text
  {chat.lastMessage || chat.phone || 'Abrir conversa'}
  ```

### Resumo das alteracoes

| Arquivo / Recurso | Alteracao |
|---|---|
| `ChatSidebar.tsx` linha 443 | Remover filtro `if (!chat.lastMessage) return false` + fallback visual |
| Migracao SQL (trigger) | Trigger `AFTER INSERT` em `message_history` para atualizar `conversations` automaticamente |
| Migracao SQL (backfill) | Preencher `last_message_text` de conversas existentes a partir de `message_history` |
