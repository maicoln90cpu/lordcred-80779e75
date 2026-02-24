

## Corrigir bug do contador de mensagens nao lidas piscando

### Causa raiz

Existem **duas fontes concorrentes** atualizando o mesmo estado `unreadCounts` no `WhatsApp.tsx`:

1. **Fonte A** - `fetchAllUnreadCounts` no `WhatsApp.tsx`: busca `unread_count` de TODAS as conversas de TODOS os chips, disparada por uma subscricao realtime global na tabela `conversations` (canal `global-conversations-unread`)
2. **Fonte B** - `onUnreadUpdate` chamado pelo `ChatSidebar.tsx`: calcula o total de nao lidos a cada fetch de chats (que acontece via realtime + polling a cada 10s)

Quando uma conversa muda no banco, ambas as fontes disparam quase simultaneamente e escrevem valores diferentes no estado `unreadCounts` (porque uma pode completar antes da outra), causando o "pisca-pisca" no badge.

Alem disso, o `handleSelectChat` faz um decremento otimista do contador que tambem e sobrescrito pela proxima atualizacao.

### Solucao

Remover a fonte duplicada. O `ChatSidebar` ja faz o trabalho de calcular o total de nao lidos e reportar via `onUnreadUpdate`. A subscricao global no `WhatsApp.tsx` e redundante e causa o conflito.

### Alteracoes

**Arquivo: `src/pages/WhatsApp.tsx`**

1. Remover a funcao `fetchAllUnreadCounts` inteira
2. Remover o `useEffect` que chama `fetchAllUnreadCounts` e cria o canal `global-conversations-unread`
3. Remover o decremento otimista em `handleSelectChat` (o `onUnreadUpdate` do sidebar ja cuida disso apos o fetch)
4. Manter apenas o `handleUnreadUpdate` como unica forma de atualizar `unreadCounts`

Isso elimina a "corrida" entre as duas fontes e o badge passa a ser atualizado somente pelo ChatSidebar, que ja tem debounce e verificacao de chip ativo.

### Detalhes tecnicos

Linhas a remover no `WhatsApp.tsx`:
- `fetchAllUnreadCounts` callback (~15 linhas)
- `useEffect` com canal `global-conversations-unread` (~10 linhas)
- Logica de decremento otimista em `handleSelectChat` (~5 linhas)

Nenhuma outra alteracao necessaria - o fluxo `ChatSidebar -> onUnreadUpdate -> unreadCounts` ja funciona corretamente como fonte unica de verdade.

