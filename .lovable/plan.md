

# Plan: Full Documentation Audit and Update

## Audit Results

### Discrepancies Found

| Area | Current State | Reality |
|------|--------------|---------|
| **Roles** | README/PRD/SYSTEM-DESIGN say 4 roles (admin, user, support, seller) | System has **5 roles**: master, admin, manager, support, seller |
| **Commission Reports** | Not mentioned anywhere in docs | Fully implemented: 8 tabs (Geral, Repasse, Seguros, Relatório, Resumo, Indicadores, Regras CLT/FGTS, Histórico) |
| **Corban Integration** | `docs/corban.md` exists but not linked from any doc | 6 admin pages + 2 seller pages + 2 edge functions + feature config system |
| **DB Tables** | SYSTEM-DESIGN lists ~20 tables | Missing ~15 tables: `cr_geral`, `cr_repasse`, `cr_seguros`, `cr_relatorio`, `cr_rules_clt`, `cr_rules_fgts`, `cr_history`, `corban_*`, `feature_permissions`, `quick_replies` |
| **Edge Functions** | Lists 9 functions | Missing `corban-api`, `corban-status-sync` |
| **PENDENCIAS.md** | Last entry: 2026-02 | Missing all late March 2026 work (commission reports, tooltip fix, paste import, Corban, etc.) |
| **ROADMAP.md** | Phase 4 shows 3 pending items | Missing ~10 completed items from Phase 4 |
| **Knowledge prompt** | Says 4 roles, no commission info | Severely outdated |
| **.lovable/plan.md** | Contains stale tooltip fix plan | Should be cleaned |

### Files to Update (8 files)

---

## Etapa 1 — README.md

- Add `manager` role to roles table
- Add Commission Reports and Corban to structure tree
- Add `docs/corban.md` and `docs/COMMISSION-REPORTS.md` to docs table
- Add `pages/corban/` to structure
- Update commands (add `npm run lint`)

## Etapa 2 — PRD.md

- Update roles table: 5 roles (master, admin, manager, support, seller) with correct frontend names
- Add new section "Relatório de Comissões" under Features: Geral/Repasse/Seguros import, CLT/FGTS rate engine, Resumo with SUMIFS-style calculations, Indicadores, Histórico/Fechamento
- Add "Corban Integration" section: NewCorban API, propostas, FGTS, assets, config, dashboard
- Add "Feature Permissions" section: granular per-role + per-user control
- Update backlog (remove items already done like "Relatórios avançados")
- Fix cross-references

## Etapa 3 — ROADMAP.md

- Phase 4: mark completed items: Commission Reports system, Corban integration, Paste import (Ctrl+V), Tooltip stability fix, Timezone standardization (São Paulo), Feature permissions granulares, Manager role, `is_privileged()` RLS consolidation
- Phase 5: update with realistic next items, remove already-done items

## Etapa 4 — PENDENCIAS.md

Add entries for all recent work:
- 2026-03 — Relatório de Comissões: 8 abas, import Ctrl+V, cálculos CLT/FGTS SUMIFS, Resumo detalhado, Indicadores
- 2026-03 — Corban Integration: propostas, FGTS, assets, config, dashboard, seller pages
- 2026-03 — Manager Role + is_privileged(): 5 roles, RLS consolidation
- 2026-03 — Feature Permissions: granular per-role/per-user, realtime
- 2026-03 — Tooltip Fix: CRSortUtils stable tooltips
- 2026-03 — Timezone: São Paulo standardization across commission calculations
- 2026-03 — Paste Import: Ctrl+V for Geral, Repasse, Seguros with duplicate detection

## Etapa 5 — SYSTEM-DESIGN.md

- Update roles to 5 (master, admin, manager, support, seller)
- Add `is_privileged()` SECURITY DEFINER explanation
- Add Commission Reports tables: `cr_geral`, `cr_repasse`, `cr_seguros`, `cr_relatorio`, `cr_rules_clt`, `cr_rules_fgts`, `cr_history`
- Add Corban tables: `corban_feature_config`, `corban_propostas`, etc.
- Add `feature_permissions` table
- Add `quick_replies` table
- Add edge functions: `corban-api`, `corban-status-sync`
- Add Commission Calculation flow diagram (CLT/FGTS rate lookup, SUMIFS aggregation, cross-reference)
- Add Corban API flow diagram

## Etapa 6 — Create docs/COMMISSION-REPORTS.md (new file)

Dedicated doc explaining:
- Architecture: 4 import tables + 2 rules tables + 1 history table
- CLT calculation: `extractTableKeyCLT` → `findCLTRate` (SUMIFS aggregation)
- FGTS calculation: `extractTableKeyFGTS` → `findFGTSRate` (SUMIFS aggregation)
- Cross-reference logic: contract matching across Geral+Repasse+Seguros
- Timezone handling: `toSaoPauloDate` pattern
- Import flow: paste → parse → preview → batch insert
- Resumo: filtered aggregation with date range
- Indicadores: KPI formulas

## Etapa 7 — Update docs/INSTRUCOES.md

- Add section about Commission Reports usage (how to import, how to read Resumo)
- Add Corban usage section
- Update cross-references to include new docs

## Etapa 8 — Clean .lovable/plan.md

- Clear stale plan content

## Etapa 9 — Update Knowledge Prompt

Deliver via chat a complete updated knowledge prompt including:
- 5 roles (master, admin, manager, support, seller) with `is_privileged()`
- Commission Reports system overview
- Corban integration overview
- Feature permissions system
- Timezone convention (São Paulo)
- Updated table list
- Updated edge function list
- Checklist rule for all implementations

---

## Files Summary

| File | Action |
|------|--------|
| `README.md` | Update roles, structure, docs links |
| `docs/PRD.md` | Add Commission Reports, Corban, 5 roles, update backlog |
| `docs/ROADMAP.md` | Mark Phase 4 items done, update Phase 5 |
| `docs/PENDENCIAS.md` | Add all March 2026 entries |
| `docs/SYSTEM-DESIGN.md` | Add tables, functions, flows, 5 roles |
| `docs/COMMISSION-REPORTS.md` | **New** — dedicated commission system doc |
| `docs/INSTRUCOES.md` | Add commission + corban usage sections |
| `.lovable/plan.md` | Clean stale content |

## Checklist Manual

- [ ] All `Ver Também` links resolve correctly between docs
- [ ] README docs table lists all 10 docs
- [ ] PRD roles table shows 5 roles
- [ ] ROADMAP Phase 4 reflects all completed work
- [ ] PENDENCIAS has chronological entries through March 2026
- [ ] SYSTEM-DESIGN lists all ~35 tables and 11 edge functions
- [ ] COMMISSION-REPORTS.md explains CLT/FGTS calculation accurately
- [ ] Knowledge prompt covers all systems

