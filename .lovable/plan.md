

## Analise dos 4 itens — O que pode ser feito e o que eh limitacao

### Item 1: Audio demora para enviar e bloqueia o chat + feedback visual

**Problema:** O `handleSendMedia` no `ChatWindow.tsx` seta `setSending(true)` que bloqueia toda a interacao ate o upload terminar. Audios webm podem ser grandes e a edge function precisa processar/enviar para a UazAPI.

**Soluvel?** SIM — parcialmente.

**Plano:**
- Tornar o envio de media **nao-bloqueante**: remover `setSending(true)` do `handleSendMedia` ou usar um estado separado `sendingMedia` que nao desabilita o input de texto. O usuario pode continuar digitando e trocando de chat enquanto o audio sobe em background.
- Para o feedback visual: quando o audio eh gravado, o `mediaPreview` mostra um icone generico com nome "audio.webm". Melhorar para mostrar um mini audio player inline no preview (similar ao `AudioPlayer` do `MediaRenderer.tsx`), usando o base64 como src temporario. Assim o usuario ve o player direto, nao um arquivo.
- Mostrar um indicador de "enviando audio..." discreto (toast ou badge no chat) em vez de bloquear o input.

**Limitacao tecnica:** O tempo de upload em si depende da conexao e do tamanho do arquivo — nao ha como acelerar o upload real. Mas desbloqueando a UI o usuario nao fica travado.

---

### Item 2: Lentidao ao carregar midia ao trocar de conversa

**Problema:** O `MediaRenderer.tsx` faz `downloadMedia()` via edge function para CADA mensagem com midia ao montar. Quando troca de conversa com muitas midias, dispara dezenas de chamadas simultaneas a `uazapi-api` com `action: 'download-media'`.

**Soluvel?** SIM — com cache de URLs.

**Plano:**
- Implementar um **cache em memoria** (Map) de `messageId -> mediaUrl` no `MediaRenderer.tsx`. Se o messageId ja foi baixado antes, usar a URL cacheada direto sem chamar a edge function.
- Adicionar **lazy loading**: so carregar midia quando o elemento estiver visivel no viewport (IntersectionObserver), em vez de carregar tudo ao montar.
- Limitar concorrencia: no maximo 3-4 downloads de midia simultaneos para nao sobrecarregar a edge function.

---

### Item 3: Notificacao de mensagem nao aparece em chips inativos

**Problema:** O `ChatSidebar` so escuta realtime do chip ativo (`filter: chip_id=eq.${chipId}`). O `ChipSelector` nao tem nenhum listener realtime — ele so atualiza quando o usuario clica no chip ou quando `refreshTrigger` muda. Portanto, mensagens que chegam em chips inativos nao atualizam o badge de unread.

**Soluvel?** SIM.

**Plano:**
- No `WhatsApp.tsx`, adicionar um **listener realtime global** na tabela `conversations` (sem filtro de chip_id) que escuta UPDATEs onde `unread_count` muda. Quando detectar mudanca em um chip que NAO eh o ativo, atualizar o `unreadCounts` state diretamente.
- Alternativa mais leve: usar o `useRealtimeMessages` hook (ja existe, escuta INSERT em `message_history` sem filtro) no `WhatsApp.tsx` para detectar mensagens incoming em chips inativos e incrementar o `unreadCounts[chipId]`.
- O `ChipSelector` ja renderiza o badge baseado em `unreadCounts` — so precisa receber dados atualizados.

---

### Item 4: Demora para marcar como lida apos clicar na conversa

**Problema:** Ao clicar numa conversa, o `ChatWindow` chama `mark-read` via edge function (HTTP request para UazAPI + update no DB). So apos o DB ser atualizado, o realtime dispara, o `ChatSidebar` faz re-fetch, e ai o badge some. Essa cadeia leva varios segundos.

**Soluvel?** SIM — com update otimista.

**Plano:**
- No `ChatSidebar`, quando o usuario clica em uma conversa, **imediatamente** setar `unreadCount: 0` no estado local (update otimista), antes de esperar a resposta da edge function.
- No `WhatsApp.tsx`, ao selecionar um chat, tambem atualizar `unreadCounts` imediatamente para o chip ativo.
- O `mark-read` continua sendo chamado em background para sincronizar com a UazAPI e o banco.

---

### Resumo de alteracoes

| # | Arquivo | Alteracao |
|---|---|---|
| 1 | `ChatWindow.tsx` | Envio de media nao-bloqueante (estado separado) |
| 1 | `ChatInput.tsx` | Preview de audio gravado como mini player |
| 2 | `MediaRenderer.tsx` | Cache de URLs + lazy loading com IntersectionObserver |
| 3 | `WhatsApp.tsx` | Listener realtime global para unread de chips inativos |
| 4 | `ChatSidebar.tsx` | Update otimista do unread ao clicar na conversa |
| 4 | `WhatsApp.tsx` | Update otimista do unreadCounts ao selecionar chat |

Nenhum desses itens eh limitacao da UazAPI — todos sao melhorias de frontend/UX.

