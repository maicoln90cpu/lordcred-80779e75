

# Diagnóstico e Correção: getPropostas retornando vazio

## Problema Identificado

A busca por CPF funciona (testConnection OK, sem erros nos logs), mas retorna "Nenhuma proposta encontrada". Dois problemas potenciais:

### 1. `getClaims()` pode nao existir no supabase-js@2
A edge function usa `supabaseUser.auth.getClaims(token)` que nao e um metodo padrao do supabase-js v2. O metodo correto e `getUser()`. No entanto, como testConnection funciona com badge verde, a autenticacao esta passando -- possivelmente `getClaims` existe na versao importada via esm.sh.

### 2. Parsing do response (causa mais provavel)
A resposta da NewCorban pode ter estrutura diferente da esperada. O fluxo atual:
- Edge Function retorna: `{ success: true, data: result }` (onde `result` e o JSON cru da NewCorban)
- `invokeCorban` extrai: `data?.data` (pega `result`)
- Frontend tenta: `Array.isArray(data) ? data : (data?.propostas || data?.data || [])`

Se a NewCorban retorna algo como `{ success: true, propostas: [...] }` ou outra estrutura aninhada, o parsing pode falhar silenciosamente.

**Nao ha logging do response body** -- impossivel diagnosticar sem ver o que a API realmente retorna.

## Plano de Correcao

### Passo 1: Adicionar logging detalhado na Edge Function
**Arquivo:** `supabase/functions/corban-api/index.ts`

Adicionar logs do body enviado e do response recebido:
```typescript
console.log(`[corban-api] Request body:`, JSON.stringify(corbanBody))
// ... apos parse do response:
console.log(`[corban-api] Response status: ${corbanResponse.status}, body preview:`, 
  responseText.substring(0, 500))
```

### Passo 2: Substituir `getClaims` por `getUser` (seguranca)
Trocar:
```typescript
const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token)
```
Por:
```typescript
const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
const userId = user.id
const userEmail = user.email || 'unknown'
```

### Passo 3: Melhorar parsing do response no frontend
**Arquivo:** `src/pages/admin/CorbanPropostas.tsx` e `src/pages/corban/SellerPropostas.tsx`

Tornar o parsing mais robusto, tentando mais caminhos possiveis:
```typescript
const list = Array.isArray(data) 
  ? data 
  : (data?.propostas || data?.data || data?.result || data?.results || []);

// Se ainda vazio mas data tem conteudo, logar para debug
if (list.length === 0 && data) {
  console.warn('[CorbanPropostas] Response structure:', JSON.stringify(data).substring(0, 300));
}
```

### Passo 4: Incluir response completo no audit_log
Adicionar o body de resposta (truncado) no campo `details` do audit_logs para permitir debug futuro sem precisar de logs ao vivo.

## Resumo de Alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/corban-api/index.ts` | Logging detalhado + fix getClaims → getUser + response no audit |
| `src/pages/admin/CorbanPropostas.tsx` | Parsing robusto + console.warn para debug |
| `src/pages/corban/SellerPropostas.tsx` | Mesmo parsing robusto |

## Vantagens
- Debug imediato: apos deploy, os logs mostrarao exatamente o que a NewCorban retorna
- Auth mais estavel com `getUser()` (metodo oficial)
- Parsing robusto cobre multiplas estruturas de resposta

## Desvantagens
- Logging do body pode conter dados sensiveis (truncar em 500 chars mitiga)
- Precisaremos de um segundo ciclo de ajuste apos ver o response real

## Checklist Manual
- [ ] Apos deploy, buscar CPF 154.471.528-52 novamente
- [ ] Verificar Edge Function Logs para ver o response body real
- [ ] Ajustar parsing se a estrutura for diferente do esperado

