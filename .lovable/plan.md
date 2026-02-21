
## Plano de Correcoes - 6 Itens Pendentes

### 1. Chip 2 - notificacao so aparece com filtro "Nao lidas" ativo

**Problema**: Na imagem 1 (sem filtro), os chats do chip 2 NAO mostram os badges verdes de unread count. Na imagem 2 (com filtro "Nao lidas"), os badges aparecem corretamente. Isso indica um bug de renderizacao condicional.

**Causa raiz**: Na sidebar (`ChatSidebar.tsx` linha 477), o badge de unread so aparece quando `chat.unreadCount > 0`. O problema e que quando o chip 2 carrega do cache (`getCachedChats`), os dados cacheados podem ter `unreadCount: 0` de uma sessao anterior. O realtime subscription so atualiza se a conversa receber um evento. Mas o bug real e que os badges APARECEM quando o filtro esta ativo - isso sugere que o filtro esta correto mas algo no re-render sem filtro nao esta atualizando.

**Investigacao adicional**: O `fetchChats` busca `unread_count` do banco corretamente (linha 152). O cache pode estar desatualizado. O realtime tambem atualiza (linha 218). Mas o chip 2 so funciona com filtro porque o filtro forca um recalculo do array filtrado.

**Correcao**: Ao selecionar um chip, forcar um `fetchChats()` fresh (ignorando cache) para garantir dados atualizados. Tambem garantir que a subscription global de unread re-fetche os chats periodicamente.

**Arquivos**: `src/components/whatsapp/ChatSidebar.tsx`

---

### 2. Badge do chip 2 mostra 99+ mas so tem 10 nao lidas

**Causa raiz**: O `unreadCounts` no `WhatsApp.tsx` (fetchAllUnreadCounts) soma TODOS os `unread_count` de todas as conversations do chip, incluindo conversations muito antigas que nunca foram marcadas como lidas. Pode haver conversas com unread_count alto que foram incrementadas pelo webhook mas nunca resetadas.

**Correcao**: O calculo em `WhatsApp.tsx` esta correto - ele soma o `unread_count` de todas as conversations. O problema real e que existem conversas no banco com `unread_count` inflado (nunca foram abertas/lidas). Isso nao e um bug de codigo, e um problema de dados. Porem, para melhorar a UX, podemos limitar o badge a mostrar o total real baseado nas conversations visiveis (nao arquivadas). Tambem ao abrir o chip, sincronizar os unread counts fazendo um re-fetch.

**Arquivos**: `src/pages/WhatsApp.tsx` (fetchAllUnreadCounts - filtrar `is_archived = false`)

---

### 3. Tique azul de leitura nao funciona

**Causa raiz**: O codigo no `MessageBubble.tsx` (linhas 172-179) esta correto visualmente. O problema e que o webhook `handleMessagesUpdate` (evolution-webhook) pode nao estar recebendo os eventos `messages_update` com o estado correto, OU a UazAPI pode estar enviando o status em formato diferente do esperado.

**Correcao**:
- Adicionar log detalhado no webhook para `messages_update` para ver o payload exato
- O status `read` pode vir como `PLAYED` para audios, ou como numero `4` ou `READ` - verificar e adicionar mapeamentos
- Tambem pode ser que o campo na tabela `message_history` nao esta sendo atualizado - adicionar verificacao se o `message_id` bate
- Garantir que o realtime UPDATE no ChatWindow esta capturando as mudancas

**Arquivos**: `supabase/functions/evolution-webhook/index.ts`

---

### 4. Menu 3 pontos - falta opcao de etiquetas

**Causa raiz**: O menu de 3 pontos na sidebar (`ChatSidebar.tsx` linhas 505-548) JA TEM as opcoes de etiquetas - mas so aparecem se `labels.length > 0` (linha 510). Se o chip nao tem etiquetas carregadas/sincronizadas, o menu so mostra "Arquivar".

**Correcao**: Sempre mostrar a opcao de etiquetas no menu, mesmo que nao haja etiquetas criadas. Incluir um item "Gerenciar Etiquetas" no menu de 3 pontos para criar novas. Se o fetch de labels esta falhando (chip desconectado), carregar do banco local independentemente.

**Arquivos**: `src/components/whatsapp/ChatSidebar.tsx`

---

### 5. Chip desconectado - mensagem aparece e some

**Causa raiz**: Ao enviar mensagem (`ChatWindow.tsx` handleSend, linhas 270-303), se a UazAPI retorna erro (chip desconectado), o `catch` remove a mensagem temporaria sem dar feedback. O usuario ve a mensagem aparecer e sumir.

**Correcao**:
- Antes de enviar, verificar o status do chip no banco (`chips.status`)
- Se desconectado, mostrar um banner/dialog no centro da tela com:
  - Mensagem: "Este chip esta desconectado"
  - Botao "Reconectar" que abre o ChipConnectDialog
  - Botao "Cancelar"
- Se a mensagem falhar por qualquer motivo, manter a mensagem temporaria com um icone de erro e opcao de re-enviar

**Arquivos**: `src/components/whatsapp/ChatWindow.tsx`

---

### 6. Midias antigas (antes da implementacao)

**Realidade tecnica**: Midias antigas armazenadas no WhatsApp podem ser recuperadas via `POST /message/download` com o `messageid` correto, DESDE QUE o WhatsApp ainda tenha o cache dessas midias no dispositivo/servidor. Midias muito antigas (meses) geralmente sao purgadas pelo WhatsApp e nao estao mais disponiveis.

**O que podemos fazer**: 
- O `MediaRenderer.tsx` ja tenta baixar e mostra "Audio indisponivel" se falhar
- Para midias que ainda existem no WhatsApp, o download deve funcionar se tivermos o `message_id` correto no banco
- Se os registros antigos no `message_history` nao tem `message_id` (foram criados sem), nao ha como recuperar
- Podemos melhorar a UX mostrando um estado mais informativo: "Midia nao disponivel - conteudo anterior a integracao do sistema"

**Arquivos**: `src/components/whatsapp/MediaRenderer.tsx`

---

### Detalhes Tecnicos - Implementacao

| # | Arquivo | Alteracao |
|---|---------|-----------|
| 1 | `ChatSidebar.tsx` | Forcar re-fetch ao trocar chip (ignorar cache no primeiro load); garantir badges aparecem sem filtro |
| 2 | `WhatsApp.tsx` | Filtrar `is_archived = false` no fetchAllUnreadCounts |
| 3 | `evolution-webhook/index.ts` | Adicionar mais mapeamentos de status (PLAYED, READ, numeric) e logs detalhados; deploy |
| 4 | `ChatSidebar.tsx` | Sempre mostrar secao de etiquetas no menu 3 pontos + "Gerenciar Etiquetas" |
| 5 | `ChatWindow.tsx` | Adicionar verificacao de status do chip antes de enviar; mostrar banner de desconectado com opcao de reconectar |
| 6 | `MediaRenderer.tsx` | Melhorar mensagem para midias indisponiveis com contexto informativo |
