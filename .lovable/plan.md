

# Plano: Corrigir Erro de Contrato + Filtro Ativo/Inativo em Usuários

---

## PROBLEMA 1: Erro ao gerar contrato

**O que acontece**: Ao salvar dados do parceiro na aba "Representante Legal", o sistema tenta gravar campos como `endereco_rep_bairro`, `endereco_rep_rua`, `endereco_rep_numero`, etc. na tabela `partners`, mas **essas colunas não existem no banco de dados**.

O código em `PartnerDetail.tsx` usa esses campos no formulário e tenta fazer `supabase.from('partners').update(updates)` com todos os campos — incluindo os que não existem. O Supabase retorna o erro: *"Could not find the 'endereco_rep_bairro' column"*.

**Colunas que faltam na tabela `partners`** (8 colunas do endereço do Representante Legal + 1 CEP PJ):

```text
endereco_rep_rua       (text)
endereco_rep_numero    (text)
endereco_rep_complemento (text)
endereco_rep_bairro    (text)
endereco_rep_municipio (text)
endereco_rep_uf        (text)
endereco_rep_cep       (text)
```

**Solução**: Criar migração SQL adicionando as 7 colunas faltantes à tabela `partners`.

---

## PROBLEMA 2: Filtro Ativo/Inativo em Usuários

**Como está hoje**: A tabela já tem o campo `is_blocked` e mostra "Ativo" ou "Bloqueado" por usuário, mas **não existe filtro** para mostrar apenas ativos ou inativos. Todos aparecem misturados.

**Como ficará**:

```text
┌─────────────────────────────────────────────────────────────┐
│ Gerenciar Usuários                      [Ativos ▼] [+ Novo]│
│                                                             │
│  Opções do filtro:                                          │
│  • Ativos (padrão ao abrir)                                 │
│  • Inativos (bloqueados)                                    │
│  • Todos                                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## IMPLEMENTAÇÃO EM 2 ETAPAS

### Etapa 1 — Migração SQL (colunas do Representante Legal)

Criar migração com:
```sql
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS endereco_rep_rua text,
  ADD COLUMN IF NOT EXISTS endereco_rep_numero text,
  ADD COLUMN IF NOT EXISTS endereco_rep_complemento text,
  ADD COLUMN IF NOT EXISTS endereco_rep_bairro text,
  ADD COLUMN IF NOT EXISTS endereco_rep_municipio text,
  ADD COLUMN IF NOT EXISTS endereco_rep_uf text,
  ADD COLUMN IF NOT EXISTS endereco_rep_cep text;
```

**Risco**: Zero — são colunas opcionais (nullable) adicionadas sem alterar dados existentes.

### Etapa 2 — Filtro Ativo/Inativo na página de Usuários

**Arquivos editados**: `src/pages/admin/Users.tsx` + `src/components/admin/UsersTable.tsx`

1. **Users.tsx**: Adicionar estado `statusFilter` com valor padrão `'active'`. Filtrar `users` antes de passar ao `UsersTable`:
   - `active` → `!is_blocked`
   - `blocked` → `is_blocked`
   - `all` → sem filtro

2. **UsersTable.tsx**: Receber prop `statusFilter` + `onStatusFilterChange`. Renderizar um `<Select>` ao lado do título do card com opções "Ativos", "Inativos" e "Todos".

**Vantagens**:
- Administrador vê apenas quem está ativo por padrão (menos poluição visual)
- Pode alternar para ver bloqueados quando precisar
- Usa o campo `is_blocked` já existente — sem necessidade de nova coluna

