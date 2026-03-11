

## Diagnostico: Contador de unread dos chips inativos esta errado

### Causa raiz

O problema esta na logica de **deltas** do `global-unread-watcher` no `WhatsApp.tsx` (linhas 122-158).

O fluxo atual:
1. `unreadCounts` inicia como `{}` (vazio)
2. Quando uma mensagem chega em chip inativo, o webhook atualiza `unread_count` de uma conversa (ex: 0→1)
3. O watcher calcula `delta = newUnread - oldUnread = 1` e soma ao `prev[chipId] || 0`

**Problema 1 — Sem valor inicial**: O `unreadCounts` para chips inativos nunca eh inicializado com o total real do banco. Comeca em `0` e so acumula deltas.

**Problema 2 — Multiplos eventos por mensagem**: O webhook pode disparar MULTIPLOS updates na tabela `conversations` por mensagem (ex: update `last_message_text`, update `unread_count`, trigger `update_conversation_last_message`). Cada update gera um evento realtime, e cada um calcula um delta. Resultado: 1 mensagem = multiplos incrementos no badge.

**Problema 3 — Ao clicar no chip, corrige para o valor real**: Quando o usuario clica no chip, `ChatSidebar.fetchChats` roda e chama `onUnreadUpdate(chipId, totalReal)`, substituindo o valor inflado pelo valor correto do banco. Por isso o badge "cai" de 7 para 3.

### Solucao

**Substituir logica de deltas por fetch absoluto**:

1. **Inicializacao**: Ao carregar a pagina, buscar o total de unread de TODOS os chips do usuario (uma unica query agrupada).

2. **Global watcher**: Quando detectar mudanca em chip inativo, em vez de calcular delta, fazer um `SELECT SUM(unread_count) FROM conversations WHERE chip_id = X AND is_archived = false`. Debounce de 1s para evitar queries repetidas.

3. **Remover logica de delta** do watcher atual.

### Alteracoes

**`WhatsApp.tsx`**:
- Adicionar `useEffect` de inicializacao que busca `SELECT chip_id, SUM(unread_count) FROM conversations WHERE chip_id IN (chips do user) GROUP BY chip_id`
- No global watcher: trocar calculo de delta por re-fetch do total para o chip especifico (com debounce por chipId)
- Manter o `handleUnreadUpdate` do ChatSidebar como esta (ele ja seta o valor absoluto para o chip ativo)

Resultado: badge sempre reflete o valor real do banco, sem acumular deltas fantasma.

