

## Plano: Coluna "Perfil" (opcional) para Leads

### Etapa 1 — Migração SQL
- Adicionar coluna `perfil TEXT DEFAULT NULL` na tabela `client_leads`
- Adicionar coluna `lead_profile_options JSONB` na tabela `system_settings` com valores iniciais: `CLT`, `CLT Clientes`, `FGTS`, `FGTS Clientes`

### Etapa 2 — LeadImporter: seletor de perfil opcional
**Arquivo:** `src/components/admin/LeadImporter.tsx`
- Buscar `lead_profile_options` de `system_settings`
- Adicionar `<Select>` com placeholder "Sem perfil" (valor vazio permitido)
- Incluir `perfil: selectedProfile || null` em cada registro do batch

### Etapa 3 — Card "Gerenciar Perfis" na aba Configurações
**Arquivo:** `src/pages/admin/Leads.tsx`
- Novo Card abaixo do "Gerenciar Status", mesmo padrão visual (editar/adicionar/remover com label + cor)
- Salvar em `system_settings.lead_profile_options`
- Reutilizar `COLOR_PRESETS` existente

### Etapa 4 — Filtro por perfil + coluna na tabela
**Arquivo:** `src/components/admin/LeadsTable.tsx`
- Novo `<Select>` nos filtros: "Todos os perfis" + opções dinâmicas + "Sem perfil"
- Adicionar `.eq('perfil', value)` ou `.is('perfil', null)` quando filtro ativo
- Renderizar perfil como Badge na coluna (via `renderCellValue`)

**Arquivo:** `src/pages/admin/Leads.tsx`
- Adicionar `perfil` ao `ALL_COLUMNS`
- Passar `profileOptions` e `filterProfile` como props
- Propagar filtro para métricas

### Etapa 5 — Exportação
- Incluir campo `Perfil` no export XLSX do `LeadsTable` e nos backups CSV/JSON

### Etapa 6 — Ação em massa "Alterar Perfil"
**Arquivo:** `src/components/admin/LeadsTable.tsx`
- Novo botão bulk "Alterar Perfil" + dialog com select (incluindo opção "Sem perfil")

### Arquivos modificados
1. Nova migração SQL
2. `src/components/admin/LeadImporter.tsx`
3. `src/components/admin/LeadsTable.tsx`
4. `src/pages/admin/Leads.tsx`

