# LordCred — Code Standards

## Regras Obrigatórias

### 1. Cores — Sempre via Tokens Semânticos

```tsx
// ✅ CORRETO
<div className="bg-background text-foreground border-border" />
<Button variant="default" /> // usa --primary automaticamente

// ❌ ERRADO
<div className="bg-white text-black border-gray-200" />
<div style={{ color: '#333' }} />
```

### 2. Componentes UI — shadcn/ui com Variants

```tsx
// ✅ CORRETO — usar componentes shadcn/ui
import { Button } from "@/components/ui/button";
<Button variant="outline" size="sm">Ação</Button>

// ❌ ERRADO — HTML raw com classes manuais
<button className="px-4 py-2 bg-blue-500 text-white rounded">Ação</button>
```

### 3. Timezone — America/Sao_Paulo para Comissões

```tsx
// ✅ CORRETO
function toSaoPauloDate(d: Date | string): Date {
  const date = typeof d === 'string' ? new Date(d) : d;
  const sp = date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
  return new Date(sp);
}

// ❌ ERRADO — usar new Date() direto (assume UTC ou timezone local)
const date = new Date(row.data_pago);
```

### 4. Roles — Sempre via Banco de Dados

```tsx
// ✅ CORRETO — verificar role via Supabase
const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId);

// ❌ ERRADO — verificar via localStorage
const role = localStorage.getItem('userRole');
if (role === 'admin') { /* NUNCA */ }
```

### 5. Types — Nunca Modificar types.ts

```tsx
// ✅ CORRETO — criar tipo derivado
type ChipRow = Database['public']['Tables']['chips']['Row'];

// ❌ ERRADO — modificar src/integrations/supabase/types.ts
```

### 6. Hooks — Lógica Separada da UI

```tsx
// ✅ CORRETO — hook customizado para lógica
function useLeadsData() {
  const [leads, setLeads] = useState([]);
  // ... fetch, filtros, etc.
  return { leads, loading, refetch };
}

// ❌ ERRADO — 500+ linhas de lógica dentro do componente
function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [filters, setFilters] = useState({});
  // ... 400 linhas de lógica aqui
}
```

### 7. Realtime — Usar Hook Genérico

```tsx
// ✅ CORRETO — hook genérico com debounce
useRealtimeSubscription({
  table: 'chips',
  event: '*',
  onData: refetch,
  debounceMs: 300,
});

// ❌ ERRADO — channel manual sem cleanup
useEffect(() => {
  const channel = supabase.channel('chips').on('postgres_changes', ...);
  // esqueceu channel.unsubscribe() no cleanup
}, []);
```

---

## Estrutura de Arquivos

### Componentes
- `src/components/{domínio}/` — agrupados por domínio (whatsapp, admin, corban, etc.)
- Componente < 300 linhas — se maior, extrair sub-componentes ou hooks
- Um componente por arquivo

### Hooks
- `src/hooks/use*.ts` — hooks customizados
- Prefixo `use` obrigatório
- Retornar objeto nomeado (não array)

### Páginas
- `src/pages/` — uma página por rota
- Admin em `src/pages/admin/`
- Corban em `src/pages/corban/`
- Página = orquestrador (< 300 linhas), delega para componentes/hooks

### Edge Functions
- `supabase/functions/{nome}/index.ts` — Deno runtime
- Sempre incluir CORS headers
- Sempre validar auth internamente

---

## Imports

```tsx
// Ordem de imports:
// 1. React/libs externas
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// 2. Componentes UI
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// 3. Hooks e utils internos
import { useLeadsData } from '@/hooks/useLeadsData';
import { supabase } from '@/integrations/supabase/client';

// 4. Types
import type { Database } from '@/integrations/supabase/types';
```

---

## Nomenclatura

| Item | Convenção | Exemplo |
|---|---|---|
| Componentes | PascalCase | `BatchHistoryTab.tsx` |
| Hooks | camelCase com `use` | `useLeadsData.ts` |
| Utilitários | camelCase | `clipboardParser.ts` |
| Constantes | UPPER_SNAKE_CASE | `DEFAULT_STATUS_OPTIONS` |
| CSS tokens | kebab-case | `--primary-foreground` |
| Tabelas SQL | snake_case | `cr_rules_clt` |
| Edge Functions | kebab-case | `corban-status-sync` |

---

## Ver Também

- [SYSTEM-DESIGN.md](./SYSTEM-DESIGN.md) — Arquitetura
- [SECURITY.md](./SECURITY.md) — Práticas de segurança
- [ONBOARDING.md](./ONBOARDING.md) — Guia para novos devs
