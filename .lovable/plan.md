

# Correção: Analytics mostrando apenas 819 de 4.491 registros

## Diagnóstico

Dois problemas encontrados:

### Problema 1 — Filtro de data excluindo outubro
Os 3.672 registros importados tem `data_cadastro` de **outubro/2025**. O filtro no screenshot começa em 01/11, excluindo tudo de outubro. Distribuição real no banco:

| Mês | Registros |
|-----|-----------|
| Out/2025 | 3.672 |
| Mar/2026 | 653 |
| Abr/2026 | 166 |
| **Total** | **4.491** |

### Problema 2 — Limite de 1.000 linhas do Supabase
O Supabase JS retorna no máximo 1.000 linhas por padrão. Mesmo corrigindo o filtro de data, a query traria no máximo 1.000 dos 4.491 registros.

## Solução

**Arquivo:** `src/components/corban/CorbanAnalyticsTab.tsx`

### 2.1 — Buscar TODOS os registros com paginação automática
Criar uma função `fetchAllSnapshots` que busca em lotes de 1.000 registros até esgotar, usando `.range(from, to)`:

```
async function fetchAllSnapshots(fromStr, toStr) {
  const PAGE = 1000;
  let all = [], offset = 0, done = false;
  while (!done) {
    const { data } = await supabase
      .from('corban_propostas_snapshot')
      .select('status, banco, valor_liberado, prazo, vendedor_nome, snapshot_date, data_cadastro')
      .gte('data_cadastro', fromStr)
      .lte('data_cadastro', toStr)
      .order('data_cadastro', { ascending: false })
      .range(offset, offset + PAGE - 1);
    all.push(...(data || []));
    done = !data || data.length < PAGE;
    offset += PAGE;
  }
  return all;
}
```

### 2.2 — Ajustar data inicial padrão
Mudar o `snapDateFrom` inicial de `subDays(new Date(), 30)` para `subDays(new Date(), 180)` (6 meses), garantindo que registros mais antigos apareçam por padrão.

### 2.3 — Adicionar botão "Todos"
Adicionar um botão `180d` nos atalhos de período (ao lado de 7d, 30d, 60d, 90d) para facilitar a visualização completa.

## Resultado esperado
- Analytics mostrará os 4.491 registros (ou quantos estiverem no período selecionado)
- Sem limite de 1.000 linhas
- Período padrão mais abrangente

## Checklist manual
- [ ] Abrir Analytics e verificar se mostra ~4.491 registros com o filtro padrão
- [ ] Testar botão 180d
- [ ] Verificar que os gráficos e KPIs refletem todos os dados

