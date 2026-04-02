
# Plan: 4 Melhorias — Bonus Config, Sidebar Financeiro, Filtros Leads, Help Modals

## Item 1 — Expandir Configurações de Bônus (Comissões Parceiros)

**Hoje**: Só existe meta por valor liberado (R$) e taxa percentual.
**Depois**: Duas opções de meta (valor liberado OU número de contratos) + duas opções de premiação (taxa % OU valor fixo R$).

### Alterações

**Database** (`commission_settings`): Adicionar 2 colunas via migration:
- `bonus_mode` (text, default `'valor'`) — `'valor'` ou `'contratos'`
- `bonus_fixed_value` (numeric, default 0) — valor fixo em R$ (alternativa à taxa %)

**Frontend** (`ConfigTab` em `Commissions.tsx`):
- Adicionar Select para "Tipo de meta": Valor Liberado (R$) / Nº de Contratos
- Quando `contratos`, o campo threshold muda label para "Nº mínimo de contratos"
- Adicionar Select para "Tipo de bônus": Taxa percentual (%) / Valor fixo (R$)
- Quando `fixo`, mostrar campo "Valor fixo por contrato (R$)" no lugar da taxa %
- Atualizar o box explicativo para refletir as opções selecionadas

**Trigger SQL**: Atualizar `calculate_commission` para suportar os novos modos (contagem de contratos + valor fixo).

---

## Item 2 — Nova Categoria "Financeiro" no Sidebar

**Hoje**: Comissões Parceiros e Relat. Comissões ficam dentro de "Equipe".
**Depois**: Nova categoria "Financeiro" com ícone `Wallet` contendo esses 2 itens.

### Alterações

**`DashboardLayout.tsx`**:
- Remover `Comissões Parceiros` e `Relat. Comissões` da categoria "Equipe"
- Criar nova categoria `Financeiro` (ícone `Wallet`) com esses 2 itens
- Posicionar entre "Equipe" e "Operações"

---

## Item 3 — Filtros por Banco e Lote em Leads > Gerenciamento

**Hoje**: Filtros globais apenas por Status e Perfil.
**Depois**: Adicionar filtros por Banco Simulado e por Lote (batch_name).

### Alterações

**`LeadManagement.tsx`**:
- Expandir a query para incluir `banco_simulado` e `batch_name` nos campos selecionados
- Adicionar estados `globalBancos` e `globalBatches` (multi-select como os existentes)
- Adicionar 2 Popovers com checkboxes (mesmo padrão dos filtros existentes)
- Aplicar filtros no `globalFiltered` useMemo
- Extrair listas únicas de bancos e lotes dos dados carregados

---

## Item 4 — Modal de Ajuda (?) nos Títulos de Comissões

**Hoje**: Nenhuma explicação contextual sobre como funcionam os cálculos.
**Depois**: Botão `?` ao lado dos títulos que abre modal com explicação completa.

### Alterações

**Novo componente** `src/components/commission-reports/HelpModal.tsx`:
- Componente reutilizável: `<HelpButton content={...} />`
- Ícone `HelpCircle` que abre `Dialog` com conteúdo formatado
- Conteúdo em Markdown-like (headings, listas, tabelas)

**`Commissions.tsx`** (Comissões Parceiros):
- Adicionar `HelpButton` ao lado do título `<h1>`
- Conteúdo: explicação de como funciona o trigger de cálculo, week_label, bônus, taxas CLT/FGTS, extrato, consolidado

**`CommissionReports.tsx`** (Relatório Comissões):
- Adicionar `HelpButton` ao lado do título `<h1>`
- Conteúdo: explicação do fluxo de importação, motor de cálculo (extractTableKey → findRate), cross-reference, divergências, timezone

---

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `supabase/migrations/[new].sql` | Colunas bonus_mode + bonus_fixed_value + trigger update |
| `src/pages/admin/Commissions.tsx` | ConfigTab expandido + HelpButton no título |
| `src/pages/admin/CommissionReports.tsx` | HelpButton no título |
| `src/components/layout/DashboardLayout.tsx` | Nova categoria Financeiro |
| `src/components/admin/LeadManagement.tsx` | Filtros banco + lote |
| `src/components/commission-reports/HelpModal.tsx` | Novo componente |
| `src/integrations/supabase/types.ts` | Atualizar tipos (read-only note: será auto-gerado) |

## Checklist Manual

- [ ] Config de bônus: alternar entre valor/contratos e taxa/fixo, salvar e recarregar
- [ ] Sidebar: confirmar que Financeiro aparece com os 2 itens, e que Equipe não os contém mais
- [ ] Leads Gerenciamento: filtrar por banco e por lote, verificar contagens
- [ ] Help modal: clicar no ? em ambos os títulos e verificar conteúdo completo
- [ ] Trigger de bônus: importar venda e verificar se o novo modo é aplicado corretamente
