

# Fix: NewCorban API returns object, frontend expects array

## Root Cause (confirmed via logs)

The NewCorban API returns proposals as a **keyed object**, not an array:
```json
{ "11341357": { "averbacao": {...}, "api": {...}, ... } }
```

The edge function passes this object as-is in `data`. The frontend then tries `Array.isArray(data)` which is `false`, then `data?.propostas` / `data?.data` / `data?.result` -- all undefined. Result: empty array, "Nenhuma proposta encontrada".

## Fix

### 1. Edge Function (`supabase/functions/corban-api/index.ts`)

For `getPropostas` action, convert the keyed object to an array before returning:

```typescript
// Before the final return (line ~229), add conversion for getPropostas
let finalData = result;
if (action === 'getPropostas' && typeof result === 'object' && result !== null && !Array.isArray(result)) {
  finalData = Object.entries(result).map(([id, value]) => ({
    proposta_id: id,
    ...(typeof value === 'object' ? value : { raw: value }),
  }));
}

return new Response(JSON.stringify({
  success: true,
  data: finalData,
}), ...)
```

Similarly for `listQueueFGTS` if it returns the same pattern.

### 2. Additional debug safety in frontend

Add `console.log` of raw `data` in `CorbanPropostas.tsx` handleSearch so if the structure changes again, we see it immediately in browser console.

### Files Changed
| File | Change |
|------|--------|
| `supabase/functions/corban-api/index.ts` | Convert object-keyed responses to arrays for getPropostas and listQueueFGTS |
| `src/pages/admin/CorbanPropostas.tsx` | Add console.log of raw data for debug |
| `src/pages/corban/SellerPropostas.tsx` | Same debug log |

