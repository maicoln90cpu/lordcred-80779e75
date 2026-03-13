

## Plano de Melhorias

### 1. Erro no Dashboard ao ativar aquecimento + toggle de Settings nao persiste

**Problema**: O usuario logado no screenshot (`silascarlosdias@gmail.com`, role "Administrador" = role `user`) nao tem permissao de UPDATE na tabela `system_settings` -- as RLS policies so permitem `is_admin()` (role `admin`). O toggle na pagina Settings tambem falha silenciosamente pelo mesmo motivo: o `handleSaveSettings` faz update, recebe erro de permissao, mas o estado local ja mudou, dando impressao de que salvou.

**Solucao**: Adicionar uma RLS policy para permitir que usuarios com role `user` tambem possam fazer UPDATE em `system_settings`, OU -- mais adequado -- verificar se o usuario logado e admin antes de mostrar os controles. Como o contexto de memoria indica que "Administrador" = role `user` com permissoes especificas, a melhor abordagem e adicionar uma policy de UPDATE para `authenticated` users (ja existe SELECT para authenticated). Alternativamente, criar uma policy que permita update para users que criaram vendedores (administradores).

**Arquivo**: Nova migration SQL adicionando UPDATE policy para authenticated users na `system_settings`.

---

### 2. Mostrar todas as colunas no painel admin + scroll lateral

**Problema**: O `LeadsTable.tsx` so mostra 7 colunas (Nome, Telefone, Valor Lib, Status, Vendedor, Lote). A tabela `client_leads` tem mais: CPF, Prazo, Parcela, Banco Simulado, Banco Nome, Banco Codigo, Agencia, Conta, Aprovado, Reprovado, Data Nasc, Nome Mae, Data Ref, Notas.

**Solucao**: Expandir a tabela para incluir todas as colunas. Adicionar `overflow-x-auto` no container da tabela e `min-w-[1600px]` na Table para garantir scroll lateral. Tambem atualizar o export XLSX para incluir todas as colunas.

**Arquivo**: `src/components/admin/LeadsTable.tsx`

---

### 3. Permitir admin editar os status possiveis dos leads

**Problema**: Os status sao hardcoded como constante `STATUS_OPTIONS` em `LeadsTable.tsx` e `LeadsPanel.tsx`.

**Solucao**: Criar uma nova tabela `lead_status_options` no Supabase com colunas (`id`, `value`, `label`, `color_class`, `sort_order`). Admin pode editar/adicionar/remover status. Os componentes LeadsTable e LeadsPanel buscarao os status do banco ao inves de usar constantes.

Alternativamente, para evitar complexidade de migration + nova tabela, armazenar os status como JSON na tabela `system_settings` (adicionar coluna `lead_status_options jsonb`). Isso e mais simples e centralizado.

**Abordagem escolhida**: Nova coluna `lead_status_options` em `system_settings` com valor default dos 5 status atuais. UI de edicao na pagina admin Leads. LeadsTable e LeadsPanel consultam do banco.

**Arquivos**: Migration SQL, `src/pages/admin/Leads.tsx` (aba de config de status), `src/components/admin/LeadsTable.tsx`, `src/components/whatsapp/LeadsPanel.tsx`

---

### 4. Metricas do admin refletirem filtros selecionados

**Problema**: Os cards de metricas em `Leads.tsx` usam `allLeads` de uma query separada (`admin-leads-metrics`) que sempre busca todos os leads sem filtro. O `LeadsTable` tem seus proprios filtros mas os cards nao reagem a eles.

**Solucao**: Mover os filtros de vendedor/status/lote para o componente pai (`Leads.tsx`) e passar como props ao `LeadsTable`. Os cards de metricas usam os mesmos filtros aplicados. Quando o admin seleciona um vendedor, os cards mostram so os dados daquele vendedor.

**Arquivos**: `src/pages/admin/Leads.tsx`, `src/components/admin/LeadsTable.tsx`

---

### Resumo de arquivos

| Arquivo | Mudancas |
|---|---|
| Migration SQL | Policy UPDATE em system_settings para authenticated; coluna `lead_status_options` jsonb em system_settings |
| `src/pages/admin/Leads.tsx` | Filtros no nivel pai, metricas reativas, UI para gerenciar status customizados |
| `src/components/admin/LeadsTable.tsx` | Receber filtros como props, mostrar todas as colunas, scroll lateral |
| `src/components/whatsapp/LeadsPanel.tsx` | Buscar status do banco ao inves de constantes |

