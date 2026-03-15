
Objetivo: corrigir os 3 pontos funcionais pendentes (Kanban, Monitor de Chips, Webhooks) e entregar uma lista clara de permissões (Admin, Suporte, Vendedor).

Diagnóstico encontrado no código atual:
1) Kanban (suporte): existem bloqueios em pontos diferentes.
- `KanbanAdmin.tsx` já está com `readOnly = false`, mas o diálogo Kanban do WhatsApp (`KanbanDialog.tsx`) ainda libera “Colunas” só para `isAdmin` (que hoje significa Master).
- `useKanban.ts` busca chips por `user.id` apenas; para suporte isso limita/zera cards fora dos próprios chips.
- RLS de `kanban_cards` ainda tem suporte só com `SELECT` (sem INSERT/UPDATE/DELETE), impedindo edição total de cards.

2) Monitor de Chips:
- O arquivo já tem estrutura de nome do dono + filtros, mas vou consolidar para garantir que apareça sempre (incluindo fallback de carregamento de perfis via RPC, evitando falha de visibilidade por política de perfil).

3) Webhook Diagnostics:
- Não existe filtro de origem (aquecimento vs chat de vendedores).

4) Lista de permissões:
- Não existe uma matriz única e atualizada em documentação.

Plano de implementação:
1) Permitir edição total do Kanban para Suporte
- `src/components/whatsapp/KanbanDialog.tsx`:
  - trocar gate de configuração de colunas para “pode gerenciar Kanban” (Suporte + Admin + Master; apenas vendedor bloqueado).
- `src/hooks/useKanban.ts`:
  - tornar a carga de cards role-aware (Suporte enxergar chips globais do board, não só próprios).
- `src/pages/admin/KanbanAdmin.tsx`:
  - remover completamente qualquer lógica/texto de “somente leitura” para evitar regressão visual.
- Nova migration:
  - adicionar política `ALL` para suporte em `public.kanban_cards` (com `USING` e `WITH CHECK`).

2) Garantir nome do usuário e filtros no Monitor de Chips
- `src/pages/admin/ChipMonitor.tsx`:
  - reforçar exibição do dono no card (nome/email).
  - manter/garantir filtros: status (todos/conectados/desconectados) e usuário.
  - fallback de perfis via RPC (`get_all_chat_profiles`) se necessário, para evitar lista vazia de nomes.

3) Filtro de origem no Diagnóstico de Webhooks
- `src/pages/admin/WebhookDiagnostics.tsx`:
  - adicionar `filterSource` com opções: `Todos`, `Aquecimento`, `Chat Vendedores`.
  - classificar cada log por `chip_type` do chip vinculado (`warming` => aquecimento; `whatsapp` => chat vendedores).
  - mostrar badge de origem na tabela para leitura rápida.

4) Lista completa de diferenças de permissões
- Atualizar documentação com matriz objetiva (rota + ação):
  - arquivo: `INSTRUCOES.MD` (seção nova “Matriz de Permissões”).
  - cobrir: acesso de menu, rotas, criação/edição de usuários, Kanban, monitor, fila, webhooks, templates, performance, tickets/chat interno.

Detalhes técnicos (resumo):
- Arquivos:  
  - `src/components/whatsapp/KanbanDialog.tsx`  
  - `src/hooks/useKanban.ts`  
  - `src/pages/admin/KanbanAdmin.tsx`  
  - `src/pages/admin/ChipMonitor.tsx`  
  - `src/pages/admin/WebhookDiagnostics.tsx`  
  - `INSTRUCOES.MD`  
  - `supabase/migrations/<timestamp>_support_manage_kanban_cards.sql`
- Sem alterar schema de tabelas (apenas política RLS nova para `kanban_cards`).

Critérios de aceite:
1) Suporte consegue criar/editar/excluir/reordenar colunas e mover/remover cards no Kanban.
2) Monitor de Chips mostra dono do chip e filtros funcionam (status + usuário).
3) Diagnóstico de Webhooks filtra corretamente aquecimento vs chat vendedores.
4) Existe matriz de permissões documentada e atualizada para Admin, Suporte e Vendedor.
