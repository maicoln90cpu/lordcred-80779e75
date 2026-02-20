## Correções e Melhorias da Interface WhatsApp - Fase 2 (CONCLUÍDO)

### 1. ✅ Encaminhamento de mensagens
- Criado `ForwardDialog.tsx` com seleção múltipla de contatos
- Adicionada action `forward-message` na edge function `uazapi-api`
- Wired no `ChatWindow.tsx` via handler `handleForward`

### 2. ✅ Mídia enviada pelo sistema (imagens, áudios) renderizando corretamente
- Removido filtro `wasSentByApi` no webhook `evolution-webhook`
- Adicionada deduplicação por `message_id` para evitar duplicatas
- Mensagens enviadas agora são armazenadas no `message_history` com `message_id` e `media_type`
- `MessageBubble` mostra "Enviando mídia..." para mensagens temporárias sem `messageId`

### 3. ✅ Menu de contexto visível com ícone hover
- Adicionado chevron (seta) que aparece ao passar o mouse sobre a mensagem
- Menu dropdown com todas as opções: Responder, Reagir, Encaminhar, Baixar, Fixar, Favoritar, Apagar
- Handlers passados diretamente ao `MessageBubble` (sem wrapper `MessageContextMenu`)

### 4. ✅ Conversas não somem ao trocar chip
- `ChatSidebar` agora mantém dados em cache durante a transição
- Loading spinner só aparece quando não há dados em cache

### 5. ✅ Mensagens de erro melhoradas
- `MediaRenderer` mostra "Mídia indisponível" em vez de "Erro"
- Mensagens temporárias de mídia mostram "Enviando mídia..." em vez de tentar renderizar
