

# Fix: Resumo Tab — Wrong Data Source + Wrong Calculation Logic

## Root Cause

The **Resumo** tab (`CRResumo.tsx`) has 3 critical bugs:

### Bug 1 — Wrong data source
Resumo reads from `cr_geral` (production data) instead of `cr_relatorio` (sales report). The spreadsheet formulas explicitly reference "RELATORIO NEW CORBAN" columns. This is why all "Esperada" values are R$0 — the `cr_geral` table uses different fields (`tipo_operacao`, `convenio`) that don't match the rate lookup logic properly, and `prod_liq` values may not align.

### Bug 2 — Old first-match rate functions
Lines 30-31 still use the old `for...return` (first match) logic instead of the SUMIFS-style sum that was already fixed in `CRRelatorio.tsx`. This means even if the data source were correct, rates for C6, Prata Digital, etc. would be wrong.

### Bug 3 — Date filtering without São Paulo timezone
`data_pago` is stored as `timestamptz` (UTC). The comparison `slice(0,10)` uses UTC dates, not São Paulo civil dates. A sale at 22:00 BRT (01:00 UTC next day) would be assigned to the wrong date.

## Reference values (spreadsheet, period 01/02 to 10/02/2026)

| Metric | Spreadsheet | Current System |
|--------|------------|----------------|
| Qtd Propostas | 182 | 50 |
| Valor Liberado | R$254.331,34 | R$76.296,51 |
| Comissão Esperada | R$21.868,72 | R$0,00 |
| Comissão Recebida | R$22.062,44 | R$5.763,75 |
| Diferença | R$193,78 | R$5.763,75 |

The discrepancy is massive because it's reading from the wrong table entirely.

## Implementation

### Rewrite `CRResumo.tsx` to mirror `CRRelatorio.tsx` logic:

1. **Change data source**: Fetch from `cr_relatorio` instead of `cr_geral` as the base table
2. **Copy SUMIFS-style rate functions**: Use the exact `findFGTSRate`, `findCLTRate`, `extractTableKeyFGTS`, `extractTableKeyCLT` functions from `CRRelatorio.tsx`
3. **Fix date filtering**: Convert `data_pago` to São Paulo civil date before comparing with filter dates (use `toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })` pattern)
4. **Fix comissão recebida**: Cross-reference `cr_geral` + `cr_repasse` + `cr_seguros` by contract number (same as CRRelatorio)
5. **Fix product identification**: Use `produto` field from `cr_relatorio` (e.g., "FGTS", "Crédito do Trabalhador") instead of `tipo_operacao`/`convenio` from `cr_geral`

### Files to change

| File | Change |
|------|--------|
| `CRResumo.tsx` | Full rewrite of data source + calculation logic |

### Checklist Manual

- [ ] Set period 01/02/2026 to 10/02/2026 → Verify ~182 propostas, ~R$254k liberado
- [ ] Verify Esperada > R$0 for all banks (was all zeros before)
- [ ] Verify Recebida matches cross-reference from Geral+Repasse+Seguros
- [ ] Salvar Fechamento → verify historico saves correctly with new values
- [ ] Compare bank-by-bank totals with spreadsheet values

### Pending (future)

- Small count difference (182 vs 184) may be due to timezone edge cases on boundary dates — will need exact spreadsheet row-by-row comparison

