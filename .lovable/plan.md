

## Plan: 6 Changes (items 1-3, 5, 7 are code changes; items 4, 6 are explanations)

### Item 4 — Fila de Mensagens (explicação)
A **Fila de Mensagens** (`/admin/queue`) é o sistema que gerencia o envio em massa de mensagens WhatsApp. Quando você agenda mensagens para enviar a múltiplos contatos, elas entram numa fila (`message_queue`) com status: pendente, processando, pausado, erro ou enviado. A página permite pausar, retomar, retentar ou cancelar mensagens em lote, além de mostrar KPIs em tempo real do estado da fila. É essencialmente o "painel de controle" do disparo de mensagens.

### Item 6 — Templates (explicação)
**Templates** (`/admin/templates`) são modelos de mensagem pré-prontos organizados por categoria (saudação, vendas, cobrança, suporte, geral). Em vez de digitar a mesma mensagem repetidamente, o usuário copia um template pronto. Admin e Suporte podem criar, editar e desativar templates que ficam disponíveis para toda a equipe.

---

### Item 1 — Admin ver todos os usuários (exceto Master)

**Problema**: Na linha 104-108 de `Users.tsx`, o admin regular filtra `created_by === currentUser?.id`, então não vê usuários criados pelo suporte.

**Fix**: Mudar o filtro do admin regular para mostrar todos os usuários com role `seller`, `support` ou `user` (exceto `admin`/master), removendo a restrição de `created_by`:
```ts
// Admin regular vê todos exceto master (role admin)
enrichedUsers = enrichedUsers.filter(u => u.role !== 'admin' && u.user_id !== currentUser?.id);
```
Isso iguala o comportamento ao Master (que já filtra `role !== 'admin'`), excluindo a si mesmo.

---

### Item 2 — Suporte editar Kanban igual Admin

**File**: `src/pages/admin/KanbanAdmin.tsx`
- Remove `const readOnly = isSupport;` → set `readOnly = false` (or remove it entirely)
- This unlocks create, drag-reorder, delete for Support users
- RLS: kanban_columns already has `Authenticated users can read` + need to add ALL policy for support. Will create a migration.

---

### Item 3 — Monitor de Chips: mostrar nome do usuário

**File**: `src/pages/admin/ChipMonitor.tsx`
- After fetching chips, also fetch profiles to build a `userIdToName` map
- Display the user name/email on each chip card (below phone number or as a small badge)
- Query: `supabase.from('profiles').select('user_id, email, name')`

---

### Item 5 — Sidebar: "Mensagens" como sub-item de "Meus Chips"

**File**: `src/components/layout/DashboardLayout.tsx`
- Remove "Mensagens" as a standalone item from the "Principal" group
- Add a `children` property to `NavItem` interface
- Under "Meus Chips", render "Mensagens" as an indented sub-link (smaller text, slightly more left padding)
- When sidebar is collapsed, show both icons individually

---

### Item 7 — Monitor de Chips: filtros (conectado/desconectado, por usuário)

**File**: `src/pages/admin/ChipMonitor.tsx`
- Add filter bar above the chips grid with:
  - **Status filter**: Select with options "Todos", "Conectados", "Desconectados"
  - **User filter**: Select populated from the profiles map, "Todos os usuários" + each user
- Apply filters to the `chips` array before rendering
- State: `filterStatus`, `filterUserId`

---

### Files to modify

1. **`src/pages/admin/Users.tsx`** — Fix admin filter (line 104-108)
2. **`src/pages/admin/KanbanAdmin.tsx`** — Remove `readOnly = isSupport`
3. **`src/pages/admin/ChipMonitor.tsx`** — Add user names + filter bar
4. **`src/components/layout/DashboardLayout.tsx`** — Restructure "Mensagens" as sub-item of "Meus Chips"
5. **New migration** — Add kanban_columns ALL policy for support role

