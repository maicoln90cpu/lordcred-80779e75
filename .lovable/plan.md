

## Plano: Ocultar conversas sem ultima mensagem

### Problema
Conversas com `last_message_text` nulo/vazio estao aparecendo na sidebar, mesmo sem conteudo para exibir. O campo `last_message_text` da tabela `conversations` e o que deve determinar se a conversa aparece ou nao.

### Alteracao

**Arquivo**: `src/components/whatsapp/ChatSidebar.tsx`

Adicionar uma condicao no filtro de chats (funcao `filteredChats`, em torno da linha 428) para excluir conversas onde `lastMessage` e vazio (ou seja, `last_message_text` e null no banco):

```typescript
// Antes dos demais filtros, excluir conversas sem ultima mensagem
if (!chat.lastMessage) return false;
```

Isso garante que:
- Conversas como "Paneh" com `last_message_text = "Kkkkk tnc"` continuam aparecendo normalmente, exibindo esse texto
- Conversas onde `last_message_text` e NULL ou vazio sao ocultadas da lista
- A regra se aplica tanto para a visualizacao normal quanto para a visualizacao de arquivadas
- Novas mensagens recebidas via webhook atualizam `last_message_text` e fazem a conversa aparecer automaticamente via Realtime

### Detalhes tecnicos

O campo `lastMessage` ja e mapeado a partir de `r.last_message_text || ''` (linha 175). O filtro sera aplicado no array `filteredChats` antes da ordenacao, garantindo que conversas sem texto simplesmente nao sejam renderizadas. Nenhuma alteracao no banco de dados e necessaria.

