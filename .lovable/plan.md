

## Plano: Remover filtro de tempo do sync-history

### Problema
A edge function `sync-history` tem um filtro na linha 435 que descarta todas as mensagens com mais de 24 horas:
```
if (ts > 0 && ts < oneDayAgo) continue
```

Isso faz com que a tabela `message_history` fique vazia para a maioria dos chats. A sidebar mostra as conversas corretamente (usando `conversations.last_message_text`), mas ao clicar em uma conversa como "Paneh", o `ChatWindow` consulta `message_history` e nao encontra nenhuma mensagem, exibindo "Nenhuma mensagem ainda".

### Alteracao

**Arquivo**: `supabase/functions/sync-history/index.ts`

Remover a linha 435 que filtra mensagens por tempo:
```typescript
// REMOVER esta linha:
if (ts > 0 && ts < oneDayAgo) continue
```

Tambem remover a variavel `oneDayAgo` (linha 262) que nao sera mais utilizada:
```typescript
// REMOVER esta linha:
const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
```

### Resultado esperado
- Ao executar "Sincronizar mensagens", TODAS as mensagens retornadas pela UazAPI serao salvas no `message_history`
- Ao clicar em "Paneh" (ou qualquer conversa), o ChatWindow encontrara as mensagens no banco e as exibira
- A sidebar continua funcionando normalmente com `last_message_text` da tabela `conversations`

### Impacto
Apenas 2 linhas removidas. Nenhuma outra alteracao necessaria - o ChatWindow ja consulta `message_history` sem filtro de tempo.

