

## Plano: Corrigir importação de vendas na aba Base

### Problema
A função `parseExcelDate` (linha 82) não trata objetos `Date`. Como `XLSX.read` é chamado com `cellDates: true` (linha 312), as datas chegam como objetos `Date` do JavaScript, mas a função só verifica `typeof v === 'number'` e `typeof v === 'string'`. Resultado: todas as 63 linhas retornam `saleDate = null` → `skipped++`.

### Correção

**Arquivo**: `src/pages/admin/Commissions.tsx`

1. **Adicionar tratamento de `Date` em `parseExcelDate`** (linhas 82-97):
   - Antes dos checks de `number`/`string`, verificar `if (v instanceof Date)` e converter para ISO string
   - Isso cobre o caso do `cellDates: true`

2. **Melhorar logging temporário** para diagnóstico:
   - Adicionar `console.log` no primeiro row para ver formato real das colunas (será removido depois)

### Código da correção

```typescript
function parseExcelDate(v: any): string | null {
  if (!v) return null;
  // Handle Date objects (from cellDates: true)
  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.toISOString().slice(0, 16);
  }
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}T${String(d.H||0).padStart(2,'0')}:${String(d.M||0).padStart(2,'0')}`;
  }
  if (typeof v === 'string') {
    const parts = v.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (parts) return `${parts[3]}-${parts[2].padStart(2,'0')}-${parts[1].padStart(2,'0')}T${(parts[4]||'12').padStart(2,'0')}:${(parts[5]||'00').padStart(2,'0')}`;
    const iso = new Date(v);
    if (!isNaN(iso.getTime())) return iso.toISOString().slice(0, 16);
  }
  return null;
}
```

### Vantagens
- Corrige 100% dos registros ignorados (causa raiz era tipo Date não tratado)
- Regex também atualizado para aceitar segundos (`:SS`) no formato string
- Sem impacto em outras funcionalidades

### Desvantagens
- Nenhuma

### Checklist manual
- [ ] Reimportar a planilha e verificar que os 63 registros são importados
- [ ] Verificar que `commission_value` e `week_label` foram calculados pelo trigger
- [ ] Confirmar que os vendedores foram mapeados corretamente (Artur, Juliana, etc.)

### Pendente
- Nada — é um fix pontual de 1 função

