

## Kanban de Contatos — Plano de Implementacao

### Resumo das decisoes

| Decisao | Resposta |
|---|---|
| Escopo | Todos os chips do usuario |
| Colunas | Dinamicas, definidas pelo admin globalmente |
| Localizacao | Dialog/modal grande dentro da pagina WhatsApp |
| Info no card | Completo (foto, nome, telefone, ultima msg, labels, notas, data) |
| Finalizados | Auto-arquivar apos X dias (configuravel) |
| Filtros | Completos (label, chip, busca) |
| Ordenacao | Por data + drag manual dentro da coluna |
| Realtime | Sim, via Supabase Realtime |
| Colunas dinamicas | Global (admin define) |
| Acao no card | Modal de detalhes com botao para ir ao chat |
| Cores | Customizaveis por coluna |

---

### 1. Banco de dados — Novas tabelas

**Tabela `kanban_columns`** (colunas do Kanban, gerenciadas pelo admin):
```sql
CREATE TABLE kanban_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color_hex text DEFAULT '#6b7280',
  sort_order integer NOT NULL DEFAULT 0,
  auto_archive_days integer DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE kanban_columns ENABLE ROW LEVEL SECURITY;
-- Admin manages, all authenticated can read
```

**Tabela `kanban_cards`** (posicao dos contatos no board):
```sql
CREATE TABLE kanban_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  column_id uuid REFERENCES kanban_columns(id) ON DELETE CASCADE NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(conversation_id)
);
ALTER TABLE kanban_cards ENABLE ROW LEVEL SECURITY;
-- Users can manage cards for their own chip conversations
```

RLS:
- `kanban_columns`: admin ALL, authenticated SELECT
- `kanban_cards`: users manage cards where `conversation_id` belongs to their chips; admin ALL

**Migracao de dados existentes:** Contatos que ja possuem `custom_status` serao migrados para os cards do Kanban com colunas correspondentes (criar colunas padrao: Aguardando, Em andamento, Finalizado, Urgente).

---

### 2. Sincronizacao bidirecional

Quando um card eh movido no Kanban:
- Atualiza `kanban_cards.column_id`
- Atualiza `conversations.custom_status` com o nome da coluna correspondente

Quando `custom_status` muda pelo sidebar:
- Cria/atualiza `kanban_cards` para a coluna correspondente
- Se status for removido (null), remove o card do Kanban

Isso sera feito no frontend (sem trigger) para manter simplicidade.

---

### 3. Frontend — Componentes

**`KanbanDialog.tsx`** — Dialog grande (95vw x 90vh):
- Header: titulo "Kanban", filtros (busca, chip, label), botao fechar
- Body: colunas horizontais com scroll, cada coluna eh um drop zone
- Footer: nenhum

**`KanbanColumn.tsx`** — Coluna individual:
- Header: nome da coluna + cor + contador de cards
- Body: lista de cards com scroll vertical
- Suporte a drop (recebe cards arrastados)

**`KanbanCard.tsx`** — Card de contato:
- Foto de perfil (avatar)
- Nome + telefone
- Ultima mensagem (truncada)
- Labels coloridas
- Contagem de notas
- Data da ultima interacao
- Draggable

**`KanbanCardDetailDialog.tsx`** — Modal de detalhes ao clicar:
- Info completa do contato
- Notas da conversa
- Historico de status
- Botao "Abrir conversa" que fecha o Kanban e navega ao chat

**`KanbanSettingsDialog.tsx`** — Gerenciamento de colunas (apenas admin):
- CRUD de colunas: nome, cor (color picker), ordem, dias para auto-arquivar
- Reordenar colunas via drag

---

### 4. Drag and Drop

Usar a biblioteca nativa HTML5 drag-and-drop com `onDragStart`, `onDragOver`, `onDrop` para evitar dependencia extra. Se a fluidez nao for suficiente, podemos migrar para `@dnd-kit/core` depois.

- Drag entre colunas: move o card e atualiza `column_id` + `custom_status`
- Drag dentro da coluna: reordena e atualiza `sort_order`
- Feedback visual: card fantasma semi-transparente + placeholder na zona de drop

---

### 5. Realtime

Listener Supabase Realtime na tabela `kanban_cards` para detectar INSERTs, UPDATEs e DELETEs. Quando outro usuario ou o sidebar muda um status, o board atualiza automaticamente.

---

### 6. Auto-arquivamento

Contatos na coluna "Finalizado" (ou qualquer coluna com `auto_archive_days` configurado) serao filtrados no frontend: se `updated_at + auto_archive_days < now()`, o card nao aparece. Limpeza periodica pode ser adicionada depois via cron/edge function.

---

### 7. Integracao na pagina WhatsApp

- Adicionar icone de Kanban (lucide `Columns3` ou `LayoutDashboard`) no header do WhatsApp, ao lado dos icones existentes (favoritos, tema, etc.)
- Clicar abre o `KanbanDialog`
- Ao clicar "Abrir conversa" no detalhe do card: fecha dialog, seleciona chip correto, seleciona chat

---

### Arquivos a criar/editar

| Arquivo | Acao |
|---|---|
| Migration SQL | Criar tabelas `kanban_columns` e `kanban_cards` + RLS + colunas padrao |
| `src/components/whatsapp/KanbanDialog.tsx` | Criar — dialog principal |
| `src/components/whatsapp/KanbanColumn.tsx` | Criar — coluna com drop zone |
| `src/components/whatsapp/KanbanCard.tsx` | Criar — card draggable |
| `src/components/whatsapp/KanbanCardDetailDialog.tsx` | Criar — modal de detalhes |
| `src/components/whatsapp/KanbanSettingsDialog.tsx` | Criar — CRUD de colunas (admin) |
| `src/hooks/useKanban.ts` | Criar — hook para fetch, realtime, mutations |
| `src/pages/WhatsApp.tsx` | Editar — adicionar botao + dialog |
| `src/components/whatsapp/ChatSidebar.tsx` | Editar — sincronizar custom_status com kanban_cards |

