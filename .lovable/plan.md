

# Fix: Import Errors, Tooltip Flicker, and CPF Format

## Root Cause Analysis

### Issue 1 & 2 — Geral/Repasse not importing cod_contrato, prod_liq, prod_bruta, favorecido

The Excel headers contain **dots and accented characters** that the `normalize()` function does NOT strip:
- Excel header: `Cód. Contrato` → normalizes to `cod. contrato` → alias `cod contrato` does NOT match (the dot remains)
- Excel header: `Prod. Líq.` → normalizes to `prod. liq.` → alias `prod liq` does NOT match
- Excel header: `Prod. Bruta` → normalizes to `prod. bruta` → alias `prod bruta` does NOT match
- Excel header: `Favorecido Codigo-Nome` → normalizes to `favorecido codigo-nome` → alias `favorecido` does NOT match

**Database confirms all these fields are NULL** for every imported record. This cascades to break ALL commission calculations.

**Fix**: Update `normalize()` to strip dots and add exact Excel header aliases.

### Issue 3 — Relatório CPF broken (scientific notation)

Excel stores CPFs as numbers → exports as `9,67E+10` instead of `96673346000`. The `type: 'text'` parser just stores the scientific notation string.

**Fix**: Add CPF cleaning logic that detects scientific notation (`E+`) and converts back to integer string, then formats as `XXX.XXX.XXX-XX`.

### Issue 4 — Column data changes on hover

Each `TSHead` component wraps its own `TooltipProvider`. When hovering across columns, rapid mount/unmount of tooltip providers triggers React re-renders that cascade across the table, causing visual "data changing" effect.

**Fix**: Move `TooltipProvider` to wrap the entire table once, not per-column.

### Issue 5 — Calculations not matching

Direct consequence of Issue 1: `prod_liq` is NULL for all records → CMS calculations are zero → all expected commissions are wrong. Fixing import will fix calculations.

---

## Implementation Plan

### Step 1 — Fix `normalize()` to strip dots/punctuation

In `CRImportTab.tsx` and `CRPasteImportButton.tsx`:
```typescript
// Before: dots remain
const normalize = (s: string) => s?.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() || '';
// After: strip dots, hyphens, special chars
const normalize = (s: string) => s?.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.\-_']/g, ' ').replace(/\s+/g, ' ').trim() || '';
```

This makes `Cód. Contrato` → `cod contrato`, `Prod. Líq.` → `prod liq`, `Prod. Bruta` → `prod bruta`, `Favorecido Codigo-Nome` → `favorecido codigo nome`.

### Step 2 — Add exact Excel aliases

Add these aliases:
- `cod_contrato`: add `"cód contrato"`, `"cód. contrato"`
- `prod_liq`: add `"prod. líq."`, `"prod. líq"`, `"produção líquida"`
- `prod_bruta`: add `"prod. bruta"`, `"produção bruta"`
- `favorecido`: add `"favorecido codigo-nome"`, `"favorecido codigo nome"`
- `cms_rep_favorecido`: add `"cms rep favorecido"` (already exists, but verify)

### Step 3 — Fix CPF scientific notation

Add a `cleanCPF()` helper:
```typescript
function cleanCPF(v: any): string {
  const s = String(v).trim();
  if (/e\+/i.test(s)) {
    // Scientific notation → convert to integer string
    const n = Number(s.replace(',', '.'));
    if (!isNaN(n)) {
      const digits = Math.round(n).toString().padStart(11, '0');
      return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
    }
  }
  return s;
}
```

Apply `cleanCPF` to columns where `key === 'cpf'` during import mapping.

### Step 4 — Fix tooltip flicker

In `CRSortUtils.tsx`, remove per-column `TooltipProvider`. In each table that uses `TSHead`, wrap the entire `<Table>` with a single `<TooltipProvider>`.

Modify `TSHead`:
```typescript
// Remove TooltipProvider wrapper - expect parent to provide it
export function TSHead({ ... }: TSHeadProps) {
  if (!tooltip) return content;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent ...>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
```

Add `<TooltipProvider delayDuration={300}>` wrapping `<Table>` in `CRImportTab`, `CRRelatorio`, `CRIndicadores`, `CRResumo`.

### Step 5 — Re-import data

After code fix, user must re-import the Excel to get correct data. Existing NULL records need to be cleared first. Add a "Limpar dados" button or instruct user to clear via Hist. Importações.

---

## Files to Change

| File | Change |
|------|--------|
| `CRImportTab.tsx` | Fix `normalize()`, add aliases, add `cleanCPF`, wrap table in `TooltipProvider` |
| `CRPasteImportButton.tsx` | Fix `normalize()`, add `cleanCPF` |
| `CRSortUtils.tsx` | Remove per-column `TooltipProvider` from `TSHead` and `THead` |
| `CRRelatorio.tsx` | Wrap table in `TooltipProvider` |
| `CRIndicadores.tsx` | Wrap table in `TooltipProvider` |
| `CRResumo.tsx` | Wrap table in `TooltipProvider` |

---

## Checklist Manual

- [ ] Re-importar planilha Geral → verificar que `Cód. Contrato`, `Prod. Líq.` e `Prod. Bruta` estão preenchidos
- [ ] Re-importar planilha Repasse → verificar que `Favorecido Codigo-Nome` aparece na coluna Favorecido
- [ ] Re-importar Relatório → verificar que CPF aparece como `XXX.XXX.XXX-XX` e não como `9,67E+10`
- [ ] Passar o mouse nas colunas sem que os dados mudem/pisquem
- [ ] Verificar aba Relatório: comissão esperada deve ter valores > 0 (antes era tudo zero por causa de prod_liq NULL)
- [ ] Comparar totais do Resumo com planilha original (~R$203.975 liberado)

