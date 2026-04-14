# LordCred — Onboarding Guide

> Guia para novos desenvolvedores configurarem e entenderem o projeto em < 1 dia.

---

## 1. Setup (15 min)

```bash
# Clone e instale
git clone <repo-url>
cd lordcred
npm install

# Inicie o dev server
npm run dev
```

O projeto usa **Supabase hospedado** (não local). A URL e anon key já estão em `src/integrations/supabase/client.ts`.

### Variáveis de Ambiente

O arquivo `.env` contém apenas a configuração do Vite. Secrets de APIs externas (UazAPI, NewCorban, ClickSign) ficam nos **Supabase Secrets** (edge functions) — nunca no frontend.

---

## 2. Arquitetura (30 min)

Leia estes docs nesta ordem:
1. **[SYSTEM-DESIGN.md](./SYSTEM-DESIGN.md)** — Visão geral da arquitetura
2. **[DATABASE-SCHEMA.md](./DATABASE-SCHEMA.md)** — Tabelas e relações
3. **[SECURITY.md](./SECURITY.md)** — RLS e práticas de segurança

### Conceitos-chave

- **SPA React** com Supabase como backend (auth, DB, realtime, storage, edge functions)
- **5 roles**: master > admin > manager > support > seller
- **`is_privileged()`**: função SQL que retorna true para master/admin/manager
- **UazAPI**: provedor WhatsApp primário (edge function `uazapi-api` como proxy)
- **Realtime**: Supabase WebSocket para atualizar UI em tempo real (chips, mensagens, conversas)

---

## 3. Estrutura do Código (30 min)

### Onde encontrar o quê

| Preciso de... | Onde está |
|---|---|
| Lógica de chat WhatsApp | `src/hooks/useChatMessages.ts`, `useChatActions.ts` |
| Lista de conversas | `src/hooks/useConversations.ts` |
| Componentes do chat | `src/components/whatsapp/` |
| Gestão de leads | `src/hooks/useLeadsData.ts`, `src/pages/admin/Leads.tsx` |
| Comissões (auditoria) | `src/components/commission-reports/` |
| Comissões (parceiros) | `src/components/commissions/` |
| Integração Corban | `src/components/corban/`, `src/lib/corbanPropostas.ts` |
| Permissões | `src/hooks/useFeaturePermissions.ts` |
| Chat interno | `src/hooks/useInternalChat.ts` |
| Edge functions | `supabase/functions/` |
| Tipos do banco | `src/integrations/supabase/types.ts` (READ-ONLY) |

### Padrão de componente

```
Página (orquestrador, ~200 linhas)
  └── Hook customizado (lógica, ~300 linhas)
  └── Sub-componente (UI, ~200 linhas)
  └── Sub-componente (UI, ~200 linhas)
```

---

## 4. Fluxos Principais (1h)

### Aquecimento de Chips
`warming-engine` → `message_queue` → `queue-processor` → UazAPI → WhatsApp → webhook → `evolution-webhook` → `message_history`

### Chat WhatsApp
Usuário digita → `uazapi-api` → UazAPI → WhatsApp → webhook → `evolution-webhook` → `message_history` → Realtime → UI atualiza

### Auditoria de Comissões
Ctrl+V paste → `clipboardParser.ts` → insere em `cr_relatorio` → calcula comissão esperada (SUMIFS-style) → cruza com `cr_geral`/`cr_repasse` para comissão recebida

---

## 5. Regras que Você DEVE Saber

1. **Cores**: SEMPRE via tokens CSS (`bg-background`, `text-primary`). NUNCA `bg-white` ou `text-black`.
2. **Roles**: NUNCA verificar via localStorage. Sempre via `user_roles` + `is_privileged()`.
3. **Types**: NUNCA editar `src/integrations/supabase/types.ts` — é auto-gerado.
4. **Timezone**: `America/Sao_Paulo` para todos os cálculos de comissão.
5. **Edge Function "evolution-webhook"**: nome legado — NÃO renomear (quebraria webhooks).
6. **Componentes grandes**: se > 300 linhas, extrair hooks e sub-componentes.

---

## 6. Comandos Úteis

```bash
npm run dev        # Dev server
npm run build      # Build produção
npm run test       # Testes (Vitest)
npm run lint       # ESLint
npx tsc --noEmit   # Type check sem build
```

---

## 7. Documentação Completa

| Doc | Para quê |
|---|---|
| [PRD.md](./PRD.md) | O que o produto faz |
| [ROADMAP.md](./ROADMAP.md) | O que vem a seguir |
| [CODE-STANDARDS.md](./CODE-STANDARDS.md) | Como escrever código |
| [EDGE-FUNCTIONS.md](./EDGE-FUNCTIONS.md) | Detalhes das 17 funções |
| [INSTRUCOES.md](./INSTRUCOES.md) | Manual de uso (para usuários) |
| [COMMISSION-REPORTS.md](./COMMISSION-REPORTS.md) | Motor de cálculo de comissões |
| [ADR.md](./ADR.md) | Por que decisões foram tomadas |
