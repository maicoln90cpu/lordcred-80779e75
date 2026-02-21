

## Correcao Definitiva: Mensagens Aparecem e Somem

### Resposta a Pergunta 1: LID, @s.whatsapp.net -- tudo da UazAPI

Sim, 100% da UazAPI. Confirmado na documentacao oficial (uazapidoc.md):

- Linha 4413: `wa_chatid` - "ID completo do chat no WhatsApp"
- Linha 4414: `wa_chatlid` - "LID do chat no WhatsApp (quando disponivel)"
- Linha 4459: `phone` - "Numero de telefone"

O formato `@lid` e um identificador interno do WhatsApp (Linked ID) que a UazAPI expoe. O formato `@s.whatsapp.net` e o JID baseado em numero de telefone. **Nenhuma dessas informacoes vem da Evolution API.**

---

### Resposta a Pergunta 2: Porque as mensagens aparecem por microsegundos e somem

O fluxo exato do bug:

1. Usuario clica num chat na sidebar (ex: `remoteJid = 79710449049664@lid`)
2. `ChatWindow` verifica o cache local -- pode ter dados de antes, mostra por microsegundos
3. `ChatWindow` faz query no Supabase: `message_history WHERE remote_jid = '79710449049664@lid'`
4. Resultado: **array vazio** (0 mensagens) -- porque o webhook salva mensagens com `5511999136884@s.whatsapp.net`
5. O estado `messages` e atualizado para `[]`, apagando o cache anterior

Evidencia direta nos logs de rede capturados:
```
GET .../message_history?...&remote_jid=eq.79710449049664%40lid
Response: []
```

### Porque a migration anterior nao funcionou

A migration tentou converter `@lid` para `@s.whatsapp.net` usando `contact_phone`, mas:
- Para chats `@lid`, o `contact_phone` foi preenchido com o numero LID (ex: `79710449049664`) em vez do telefone real
- A condicao `contact_phone ~ '^\d+$'` passou, mas o numero LID nao e um telefone valido
- Resultado: conversas ficaram com `79710449049664@s.whatsapp.net` (invalido) ou permaneceram com `@lid`

### Plano de Correcao

#### 1. ChatWindow: Busca dupla (LID + phone JID)

Quando o `remoteJid` for `@lid`, o ChatWindow tambem deve buscar mensagens pelo `contact_phone@s.whatsapp.net` da conversa. Isso resolve imediatamente sem esperar sync.

**Arquivo**: `src/components/whatsapp/ChatWindow.tsx`

Mudancas:
- No `fetchMessages`, se `chat.remoteJid` contem `@lid`, tambem buscar por `chat.phone + '@s.whatsapp.net'`
- Combinar resultados de ambas as queries
- Isso garante que mensagens do webhook (`@s.whatsapp.net`) aparecem mesmo que a conversa use `@lid`

#### 2. ChatContact: Adicionar campo alternateJid

**Arquivo**: `src/pages/WhatsApp.tsx` (interface ChatContact)

Adicionar campo `alternateJid?: string` para carregar o JID alternativo quando disponivel.

#### 3. ChatSidebar: Preencher alternateJid

**Arquivo**: `src/components/whatsapp/ChatSidebar.tsx`

Ao mapear conversas do banco, se `remote_jid` contem `@lid` e `contact_phone` e um numero de telefone valido (com DDI, 10+ digitos), preencher `alternateJid` com `contact_phone@s.whatsapp.net`.

#### 4. Sync-history: Melhorar resolucao de telefone

**Arquivo**: `supabase/functions/sync-history/index.ts`

Para chats `@lid` onde `chat.phone` esta vazio ou e invalido:
- Tentar usar `/chat/details` para resolver o numero real
- Salvar o numero resolvido no campo `contact_phone` da conversa
- Usar o JID `@s.whatsapp.net` resolvido como `remote_jid` no banco

#### 5. Webhook: Criar mapeamento reverso

**Arquivo**: `supabase/functions/evolution-webhook/index.ts`

Quando o webhook recebe uma mensagem com `chatid = 5511999136884@s.whatsapp.net`:
- Verificar se existe uma conversa com esse `remote_jid` 
- Se NAO existir, verificar se existe uma conversa `@lid` com `contact_phone` correspondente
- Se encontrar, atualizar o `remote_jid` da conversa de `@lid` para `@s.whatsapp.net` (auto-correcao)

---

### Detalhes Tecnicos

| # | Arquivo | Alteracao |
|---|---------|-----------|
| 1 | `ChatWindow.tsx` | Busca dupla: se remoteJid e @lid, tambem buscar por phone@s.whatsapp.net |
| 2 | `WhatsApp.tsx` | Adicionar `alternateJid` ao ChatContact |
| 3 | `ChatSidebar.tsx` | Preencher alternateJid para conversas @lid com telefone valido |
| 4 | `sync-history/index.ts` | Usar /chat/details como fallback para resolver telefone de chats @lid |
| 5 | `evolution-webhook/index.ts` | Auto-corrigir remote_jid de @lid para @s.whatsapp.net quando webhook recebe mensagem |

