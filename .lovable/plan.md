
## Plano: 8 Funcionalidades WhatsApp - Analise e Implementacao

---

### Resumo da Viabilidade por Item

| # | Funcionalidade | UazAPI Suporta? | Viabilidade |
|---|---------------|-----------------|-------------|
| 1 | Historico via banco de dados | Sim (`/message/find` com `messageTimestamp` int ms) | Alta |
| 2 | Marcar como lido ao clicar | Sim (`POST /chat/read` com `chatid`) | Alta |
| 3 | Arquivar/desarquivar conversas | Sim (`POST /chat/archive`) | Alta |
| 4 | Etiquetar conversas | Sim (`POST /chat/labels`, `GET /labels`, `POST /label/edit`) | Alta |
| 5 | Gravacao de audio estilo WhatsApp Web | N/A (frontend only) | Alta |
| 6 | Sync historico ao logar (10 dias) | Sim (`/message/find` + `/chat/find`) | Media |
| 7 | Badge de mensagens nao lidas no chip | N/A (frontend + banco) | Alta |
| 8 | Alterar nome/foto do perfil | Sim (`POST /profile/name`, `POST /profile/image`) | Alta |

---

### Item 1: Persistir Historico no Banco de Dados

**Analise da sua proposta**: A sua ideia e excelente e resolve os problemas na raiz.

**Pros**:
- Renderizacao 100% previsivel: tudo vem do Supabase com timestamps ISO, ordenado por `created_at`
- Elimina dependencia da UazAPI para leitura (que pode retornar formatos inconsistentes)
- Performance: queries locais sao mais rapidas que chamadas API externas
- Funciona offline (dados ja estao no banco)
- Facilita busca de mensagens, favoritos, exportacao
- O webhook ja salva mensagens na tabela `message_history` com `created_at` automatico

**Contras**:
- Mensagens anteriores a conexao do sistema nao existem no banco (precisa sync inicial - item 6)
- Storage no Supabase aumenta com volume de mensagens
- Se o usuario deletar mensagem no WhatsApp, nosso banco nao reflete automaticamente (precisa tratar webhook `messages_update`)

**Implementacao**: Alterar `ChatWindow.tsx` para buscar mensagens EXCLUSIVAMENTE da tabela `message_history` (query Supabase direto), em vez de chamar a edge function `fetch-messages`. O realtime subscription ja existe e continuara adicionando novas mensagens em tempo real.

**Detalhes tecnicos**:
- `ChatWindow.tsx`: substituir chamada `fetch-messages` por query direta:
  ```text
  supabase.from('message_history')
    .select('*')
    .eq('chip_id', chipId)
    .eq('remote_jid', remoteJid)
    .order('created_at', { ascending: true })
    .limit(50)
  ```
- Manter paginacao via scroll infinito com `.range(offset, offset + limit)`
- `ChatSidebar.tsx`: substituir chamada `fetch-chats` por query direta na tabela `conversations`
- Remover dependencia do edge function para leitura (manter apenas para sync e envio)

---

### Item 2: Marcar como Lido ao Clicar no Chat

**Documentacao UazAPI confirmada**: `POST /chat/read` com body `{ "chatid": "numero@s.whatsapp.net" }` marca como lido tanto no sistema quanto no WhatsApp.

**Implementacao**:
- No `ChatSidebar.tsx`, ao selecionar um chat, chamar a edge function com action `mark-read` (ja existe no edge function, linha 492-508)
- Apos marcar como lido, atualizar `conversations.unread_count = 0` no Supabase
- Atualizar o estado local do chat para refletir unread = 0 imediatamente

---

### Item 3: Arquivar/Desarquivar Conversas

**Documentacao UazAPI confirmada**: `POST /chat/archive` com body `{ "chatid": "numero@s.whatsapp.net", "archive": true/false }`.

**Implementacao**:
- Adicionar coluna `is_archived` (boolean, default false) na tabela `conversations` via migracao
- Criar action `archive-chat` no edge function `uazapi-api` que:
  1. Chama `POST /chat/archive` na UazAPI
  2. Atualiza `conversations.is_archived` no banco
- No `ChatSidebar.tsx`:
  - Filtrar conversas arquivadas da lista principal (`WHERE is_archived = false`)
  - Adicionar botao "Arquivadas" que mostra conversas com `is_archived = true`
  - Menu de contexto no chat com opcao "Arquivar"/"Desarquivar"

---

### Item 4: Etiquetar Conversas

**Documentacao UazAPI confirmada**:
- `GET /labels` - listar etiquetas existentes (retorna array de `Label` com id, name, color, colorHex, labelid)
- `POST /label/edit` - criar/editar etiqueta (name, color, delete)
- `POST /chat/labels` - associar labels a um chat (add_labelid, remove_labelid, ou labelids para definir todas)

**Implementacao**:
- Criar tabela `labels` no Supabase para cachear as etiquetas do WhatsApp (id, chip_id, label_id, name, color_hex)
- Criar action `fetch-labels` no edge function para buscar e sincronizar labels
- Criar action `set-chat-labels` para associar/remover labels de um chat
- No frontend:
  - Componente `LabelBadge` com cores do WhatsApp
  - Menu no chat para adicionar/remover etiquetas
  - Filtro na sidebar para mostrar apenas chats com determinada etiqueta
- Adicionar coluna `labels` (text[] ou jsonb) na tabela `conversations`

---

### Item 5: Gravacao de Audio Estilo WhatsApp Web

**Referencia visual**: A imagem do WhatsApp Web mostra a gravacao com:
- Icone de lixeira (descartar) a esquerda
- Ponto vermelho + cronometro ao centro
- Waveform/visualizador de ondas sonoras
- Botao de pause
- Botao de enviar (seta azul) a direita

**Implementacao** (apenas frontend, `ChatInput.tsx`):
- Redesenhar a barra de gravacao para ficar similar ao WhatsApp Web:
  - Substituir o layout atual (barra vermelha em cima) por uma barra inline
  - Lixeira a esquerda para cancelar
  - Indicador de gravacao com ponto vermelho pulsante + timer
  - Visualizador de waveform simples (barras animadas CSS)
  - Botao de envio circular azul a direita
- Manter a mesma logica de MediaRecorder e conversao para base64

---

### Item 6: Sync de Historico ao Logar (ate 10 dias)

**Documentacao UazAPI confirmada**: `POST /message/find` com `{ "chatid": "...", "limit": 100 }` retorna mensagens com `messageTimestamp` (int ms).

**Implementacao em duas fases**:

**Fase 1 - Sync imediato (ultimas conversas)**:
- Ao selecionar um chip, chamar `POST /chat/find` para buscar os 50 chats mais recentes
- Para cada chat, inserir/atualizar na tabela `conversations`
- Para o chat aberto, buscar ultimas 50 mensagens via `/message/find` e fazer UPSERT na `message_history`

**Fase 2 - Sync em background (10 dias)**:
- Criar edge function `sync-history` que:
  1. Para cada chat do chip, chama `/message/find` com paginacao
  2. Filtra mensagens dos ultimos 10 dias
  3. Faz UPSERT na `message_history` usando `message_id` como chave de deduplicacao
- Executar em background apos login (nao bloqueia a UI)
- Guardar `last_sync_at` na tabela `chips` para nao repetir sync desnecessariamente

---

### Item 7: Badge de Mensagens Nao Lidas no Chip

**Implementacao** (frontend + banco):
- No `ChipSelector.tsx`, alem de mostrar o nome/numero do chip, adicionar um badge vermelho com contador
- Query: `SELECT SUM(unread_count) FROM conversations WHERE chip_id = ?`
- Atualizar via realtime subscription na tabela `conversations`
- Badge vermelho circular no canto superior direito do botao do chip, similar ao da imagem enviada

---

### Item 8: Alterar Nome/Foto do Perfil via API

**Documentacao UazAPI confirmada**:
- `POST /profile/name` com body `{ "name": "Novo Nome" }` - altera nome do perfil
- `POST /profile/image` com body contendo URL ou base64 da imagem (JPEG 640x640)

**Implementacao**:
- Criar actions `update-profile-name` e `update-profile-image` no edge function
- No frontend, adicionar secao de "Configuracoes do WhatsApp" acessivel pelo menu do chip ou header:
  - Campo de texto para nome do perfil
  - Upload de imagem para foto de perfil
  - Preview da imagem antes de enviar

---

### Ordem de Implementacao Recomendada

1. **Item 1** (banco) + **Item 6** (sync) - Fundacao: mudar para leitura via banco
2. **Item 2** (marcar lido) - Rapido e melhora UX imediatamente
3. **Item 7** (badge) - Complementa o item 2
4. **Item 5** (audio) - Visual, melhora UX
5. **Item 3** (arquivar) - Organizacao
6. **Item 4** (etiquetas) - Mais complexo, depende de migracao + sync
7. **Item 8** (perfil) - Complementar

### Detalhes Tecnicos - Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|-----------|
| `src/components/whatsapp/ChatWindow.tsx` | Buscar mensagens do Supabase direto em vez de edge function |
| `src/components/whatsapp/ChatSidebar.tsx` | Buscar conversas do Supabase direto, marcar como lido, filtro de arquivados |
| `src/components/whatsapp/ChatInput.tsx` | Redesign da gravacao de audio estilo WhatsApp Web |
| `src/components/whatsapp/ChipSelector.tsx` | Badge de unread count por chip |
| `supabase/functions/uazapi-api/index.ts` | Novas actions: archive-chat, fetch-labels, set-chat-labels, update-profile-name, update-profile-image |
| Nova migracao SQL | Adicionar `is_archived` em conversations, tabela `labels`, `last_sync_at` em chips |
| Nova edge function `sync-history` | Sync de mensagens em background (ate 10 dias) |
| Novos componentes | `LabelBadge.tsx`, `ProfileSettings.tsx`, `ArchivedChats.tsx` |
