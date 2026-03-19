

## Plano de Implementação — 6 Itens

### Etapa 1: Ícone "Meus Leads" no header WhatsApp
**Arquivo**: `src/pages/WhatsApp.tsx`
- Trocar `ClipboardList` por `DollarSign` (cifrão) do lucide-react no botão "Meus Leads"
- Atualizar import

**Checklist**:
- [ ] Ícone de cifrão visível no header do /whatsapp para "Meus Leads"

---

### Etapa 2: Reorganizar tela Templates no admin
**Arquivo**: `src/pages/admin/Templates.tsx`

Atualmente os templates são agrupados por **categoria** (Saudação, Vendas, etc). A nova organização será por **usuário/vendedor**:

- Para admin/suporte: agrupar templates por `created_by` — cada linha/card mostra o nome do usuário e seus templates em grid horizontal
- Manter busca e filtro por categoria como filtros secundários
- Cada "linha" de vendedor será um Card com header mostrando nome/email do criador e a contagem de templates
- Dentro do card, os templates ficam em grid compacto (como cards menores)
- Templates globais (sem `created_by` de vendedor) ficam em seção separada no topo "Templates Globais"

**Checklist**:
- [ ] Templates agrupados por vendedor/criador
- [ ] Seção de templates globais separada
- [ ] Filtros de busca e categoria continuam funcionando

---

### Etapa 3: Multi-seleção de usuários no campo "Visível para" dos Templates
**Arquivo**: `src/pages/admin/Templates.tsx`, `src/components/whatsapp/TemplatePicker.tsx`

**Problema**: `visible_to` é `uuid` (single), precisa suportar múltiplos.

**Solução com migration**:
- Adicionar coluna `visible_to_list uuid[]` (array) na tabela `message_templates`
- Migrar dados existentes: se `visible_to` não é null, copiar para `visible_to_list` como array de 1 elemento
- Manter `visible_to` temporariamente para backward compatibility

**No frontend (Templates.tsx)**:
- Trocar o `Select` por lista com `Checkbox` (similar ao seletor de membros do grupo)
- State `visibleToList: string[]` em vez de `visibleTo: string`
- No save: gravar `visible_to_list` como array dos user_ids selecionados (vazio = todos)

**No frontend (TemplatePicker.tsx)**:
- Filtro: `t.created_by === user.id || !t.visible_to_list || t.visible_to_list.length === 0 || t.visible_to_list.includes(user.id)`

**Checklist**:
- [ ] Migration cria coluna `visible_to_list`
- [ ] UI mostra checkboxes em vez de select
- [ ] Pode selecionar múltiplos usuários
- [ ] Picker filtra corretamente com array
- [ ] Templates antigos continuam funcionando

---

### Etapa 4: Permissão de configurações de grupo no chat interno
**Arquivo**: `src/pages/admin/InternalChat.tsx`

**Problema**: Apenas `isAdmin` pode acessar o botão "Configurações" do grupo. Precisa permitir que admin conceda permissão a usuários específicos.

**Solução com migration**:
- Adicionar coluna `config_allowed_users uuid[]` na tabela `internal_channels` — lista de user_ids que podem acessar configurações do grupo além dos admins

**No frontend**:
- No header do chat, mostrar botão "Configurações" se `isAdmin || configAllowedUsers.includes(user.id)`
- Dentro do dialog de configurações (aba Permissões), adicionar seção onde admin pode selecionar quais usuários têm acesso às configurações — lista com checkboxes dos membros do grupo
- Usuários com permissão podem editar nome, descrição, avatar e membros, mas NÃO podem alterar permissões (apenas admin)

**Checklist**:
- [ ] Migration cria coluna `config_allowed_users`
- [ ] Admin pode conceder permissão a membros específicos
- [ ] Usuário autorizado vê botão "Configurações"
- [ ] Usuário autorizado NÃO pode alterar permissões

---

### Etapa 5: Alterar modal "Nova Conversa" do vendedor no chat interno + Botão Suporte
**Arquivo**: `src/pages/admin/InternalChat.tsx`, migration para `system_settings`

**Mudanças no modal do vendedor**:
1. Campo de busca aceita **email OU nome** (não apenas email exato) — busca parcial em `allUsers` por nome ou email
2. Se digitar corretamente (match exato de email ou nome único), pode iniciar conversa com **qualquer** tipo de usuário (vendedor, suporte, admin)
3. Remover a restrição que impede vendedor de falar com outro vendedor

**Botão "Suporte"**:
- Abaixo do campo de busca, adicionar botão "Suporte" que inicia conversa direta com o usuário de suporte designado
- O responsável pelo suporte é configurável: adicionar coluna `support_chat_user_id uuid` em `system_settings`
- No menu admin (Settings), adicionar campo onde admin seleciona qual usuário de suporte será o responsável
- Ao clicar no botão "Suporte", o sistema inicia/abre a conversa direta com aquele usuário

**Checklist**:
- [ ] Vendedor pode buscar por nome OU email
- [ ] Vendedor pode iniciar conversa com qualquer usuário
- [ ] Botão "Suporte" aparece abaixo do campo
- [ ] Admin pode configurar o responsável pelo suporte em Settings
- [ ] Clicar no botão abre conversa com o suporte designado

---

### Etapa 6: Remover cards duplicados na aba Gerenciamento de /admin/leads
**Arquivo**: `src/pages/admin/Leads.tsx`

**Problema**: A página `/admin/leads` mostra cards de métricas (Total, Pendentes, Contatados, Aprovados) no nível da página (linhas 528-553) que são SEMPRE visíveis. Quando o usuário vai na aba "Gerenciamento", o componente `LeadManagement` mostra seus PRÓPRIOS cards (linhas 261-297), resultando em 2 conjuntos duplicados.

**Solução**: Remover os cards de métricas do componente `LeadManagement.tsx` — manter APENAS os cards do nível da página (`Leads.tsx`) que já reagem aos filtros globais. O `LeadManagement` começa direto com os filtros globais e a tabela de vendedores.

**Checklist**:
- [ ] Apenas 1 conjunto de cards de métricas visível
- [ ] Cards do topo da página continuam funcionando
- [ ] Aba Gerenciamento mostra filtros + tabela sem cards duplicados

---

### Resumo de Migrations Necessárias

```sql
-- 1. Array de visibilidade para templates
ALTER TABLE message_templates ADD COLUMN visible_to_list uuid[] DEFAULT '{}';
UPDATE message_templates SET visible_to_list = ARRAY[visible_to] WHERE visible_to IS NOT NULL;

-- 2. Permissões de config de grupo no chat interno
ALTER TABLE internal_channels ADD COLUMN config_allowed_users uuid[] DEFAULT '{}';

-- 3. Responsável pelo suporte no chat
ALTER TABLE system_settings ADD COLUMN support_chat_user_id uuid;
```

### Ordem de Implementação
1. Etapa 6 (remover cards duplicados) — rápido, sem migration
2. Etapa 1 (ícone cifrão) — rápido, sem migration
3. Etapa 2 (reorganizar templates) — frontend only
4. Etapa 3 (multi-select visible_to) — migration + frontend
5. Etapa 4 (permissão grupo chat) — migration + frontend
6. Etapa 5 (modal vendedor + suporte) — migration + frontend

