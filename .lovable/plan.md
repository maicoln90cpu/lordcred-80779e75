

# Correção de chamadas Corban API -- Plano de Implementacao

## Problemas Confirmados (via logs reais)

| Action | Erro | Causa |
|--------|------|-------|
| `getPropostas` sem datas | `"Informe o objeto 'filters->data'"` | API exige `filters.data` sempre |
| `getPropostas` com datas | `"Informe o objeto 'filters->data->tipo'"` | Falta campo `tipo: "cadastro"` |
| `listQueueFGTS` sem datas | `"Informe o objeto 'filters->data'"` | Mesma causa |
| `listLogins` | Funciona, mas parsing quebra | API retorna `["99432_maicon","99432"]` (strings), frontend espera objetos `{id, nome}` |
| Erro silencioso | API retorna `{"error":true, "mensagem":"..."}` com HTTP 200 | Edge function e `invokeCorban` nao detectam erro no body |

## Correcoes

### 1. Edge Function (`supabase/functions/corban-api/index.ts`)

**getPropostas (linhas 98-101):** Garantir que `filters.data` sempre exista com `tipo: "cadastro"` e datas default (90 dias):
```typescript
case 'getPropostas': {
  corbanBody.requestType = 'getPropostas'
  const filters = params?.filters || {}
  // Garantir filters.data com tipo obrigatorio
  if (!filters.data) {
    const now = new Date()
    const from = new Date(now)
    from.setDate(from.getDate() - 90)
    filters.data = {
      tipo: 'cadastro',
      startDate: from.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
    }
  } else if (!filters.data.tipo) {
    filters.data.tipo = 'cadastro'
  }
  corbanBody.filters = filters
  break
}
```

**listQueueFGTS (linhas 118-121):** Garantir `filters.data` com datas default:
```typescript
case 'listQueueFGTS': {
  const filters = params?.filters || {}
  if (!filters.data) {
    const now = new Date()
    const from = new Date(now)
    from.setDate(from.getDate() - 90)
    filters.data = {
      startDate: from.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
    }
  }
  corbanBody.requestType = 'listQueueFGTS'
  corbanBody.filters = filters
  break
}
```

**Deteccao de erro no body (apos linha 147):** A API retorna `{"error":true}` com HTTP 200. Tratar como erro:
```typescript
// Apos parse do result
if (result?.error === true) {
  // API retornou erro logico, nao HTTP
  return new Response(JSON.stringify({
    error: result.mensagem || 'Erro retornado pela API Corban',
    details: result,
  }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
```

### 2. Frontend -- Parsing de listLogins

**`CorbanFGTS.tsx` e `SellerFGTS.tsx`:** O response real e `{"logins":["99432_maicon","99432"]}` (array de strings). Converter para objetos:
```typescript
const raw = data?.logins || data?.data || data || [];
const list = Array.isArray(raw) 
  ? raw.map(l => typeof l === 'string' ? { id: l, nome: l } : l)
  : [];
```

### 3. Frontend -- Datas default na UI

**`CorbanPropostas.tsx`:** Inicializar `dateFrom` com 90 dias atras e `dateTo` com hoje:
```typescript
const [dateFrom, setDateFrom] = useState<Date | undefined>(() => {
  const d = new Date(); d.setDate(d.getDate() - 90); return d;
});
const [dateTo, setDateTo] = useState<Date | undefined>(new Date());
```

**`SellerPropostas.tsx`:** Mesmo default (sem campo de data visivel, aplicar no params da chamada).

**`CorbanFGTS.tsx`:** Mesmo padrao de 90 dias.

### 4. Frontend -- `invokeCorban` nao precisa mudar

Apos a correcao na edge function (item 1), erros logicos da API agora retornam HTTP 422, que ja e capturado por `supabase.functions.invoke` como erro.

## Resumo de arquivos alterados

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/corban-api/index.ts` | Default `filters.data.tipo`, datas 90d, deteccao `error:true` |
| `src/pages/admin/CorbanPropostas.tsx` | Datas default 90 dias |
| `src/pages/admin/CorbanFGTS.tsx` | Datas default 90 dias + parsing logins string |
| `src/pages/corban/SellerPropostas.tsx` | Enviar datas default na chamada |
| `src/pages/corban/SellerFGTS.tsx` | Parsing logins string |

## Vantagens
- Corrige 100% dos erros identificados nos logs
- Datas default 90 dias evitam erro obrigatorio sem impor obrigatoriedade ao usuario
- `tipo: "cadastro"` fixo no backend (usuario nao precisa saber)
- Erros da API agora surfaceiam como toast de erro em vez de "nenhuma proposta"

## Desvantagens
- 90 dias pode nao cobrir propostas antigas; usuario pode ajustar manualmente
- `tipo` fixo em "cadastro" pode nao servir para todos os cenarios futuros

## Checklist Manual
- [ ] Buscar CPF 154.471.528-52 em `/admin/corban/propostas` -- deve retornar propostas
- [ ] Buscar sem datas -- deve usar default 90 dias automaticamente
- [ ] Verificar que erros da API aparecem como toast vermelho
- [ ] Em FGTS, verificar que logins aparecem no dropdown (ex: "99432_maicon")
- [ ] Testar `/corban/propostas` (vendedor) com CPF valido

