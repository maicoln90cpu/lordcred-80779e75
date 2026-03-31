

# Plan: Fix Paste Import Errors for Repasse and Seguros

## Root Cause Analysis

### Repasse — "89 com erro"
Two issues:
1. **Missing column**: `cms_rep` is defined in `REPASSE_COLUMNS` and sent in the INSERT payload, but the `cr_repasse` table **does not have** a `cms_rep` column. PostgreSQL rejects every batch insert.
2. **Date format mismatch**: `data_pgt_cliente` and `data_digitacao` are `timestamptz` in the DB, but the paste sends raw text like `"1/30/2026"`. PostgreSQL cannot parse US-format dates without explicit casting.

### Seguros — "Nenhum registro válido encontrado"  
1. **Date format mismatch**: `data_registro` is `timestamptz` in DB but receives text like `"2/2/26 11:59"`.
2. The toast says "Nenhum registro válido" which means the `findColValue` mapping returns empty for all columns, making `hasAnyValue = false`. This is because the pasted data **has headers** (the first row contains `#`, date info, description, etc.) but `looksLikeDateValue` incorrectly classifies the first cell (`669386`) as NOT a date, so the parser treats the first row as headers. Those headers (`669386`, `2/2/26 11:59`, etc.) don't match any aliases, causing all column lookups to fail.

### Why Geral works
The `cr_geral` table has `cms_rep` and all columns match. The date values from the Geral spreadsheet happened to be in a format PostgreSQL accepted.

---

## Fix Plan

### Step 1 — Add `cms_rep` column to `cr_repasse` table
New migration:
```sql
ALTER TABLE public.cr_repasse ADD COLUMN IF NOT EXISTS cms_rep numeric DEFAULT 0;
```

### Step 2 — Date parsing helper in `CRPasteImportButton.tsx`
Add a `cleanDate` function that converts common Brazilian/US date formats to ISO strings that PostgreSQL accepts:
- `"2/2/2026"` → `"2026-02-02"`
- `"2/2/26 11:59"` → `"2026-02-02T11:59:00"`  
- `"1/30/2026"` → `"2026-01-30"`
- Already ISO → pass through
- Empty/null → return null

Apply `cleanDate` to any column where the DB type is `timestamptz`. Since the `ColumnDef` type field only has `text|currency|percent|integer`, we need to either:
- **Option A**: Add a `'date'` type to `ColumnDef` and mark the date columns accordingly
- **Option B**: Handle it at insert time by detecting date-like column keys

**Option A is cleaner** — add `'date'` to the ColumnDef type union and mark `data_pgt_cliente`, `data_digitacao`, `data_registro` as `type: 'date'`.

### Step 3 — Fix Seguros header detection
The Seguros data has no column headers (raw numeric IDs in first cell like `669386`). The `looksLikeDateValue` check fails because `669386` is not a date. Two options:
- The `noHeader` prop is already passed for Seguros in `CommissionReports.tsx`. Pass it through to `CRPasteImportButton` so it **always** treats the data as headerless, bypassing auto-detection.

### Step 4 — Apply same date cleaning in `CRImportTab.tsx` Excel path
For consistency, also apply `cleanDate` when processing Excel uploads so both paths handle dates identically.

---

## Files to Change

| File | Change |
|------|--------|
| New migration | `ALTER TABLE cr_repasse ADD COLUMN cms_rep numeric DEFAULT 0` |
| `src/components/commission-reports/CRImportTab.tsx` | Add `'date'` to ColumnDef type, mark date columns, pass `noHeader` to paste button |
| `src/components/commission-reports/CRPasteImportButton.tsx` | Add `cleanDate` helper, handle `'date'` type in mapping, accept `noHeader` prop to force headerless parsing |
| `src/lib/clipboardParser.ts` | No change needed (parser itself is fine) |

---

## Checklist After Implementation

- [ ] Paste Seguros data → preview shows 210 records → click Import → success toast
- [ ] Paste Repasse data → preview shows 89 records → click Import → success toast, 0 errors
- [ ] Paste Geral data → still works (regression check)
- [ ] Verify imported dates appear correctly in the data table
- [ ] Check Hist. Importações shows the new batches

