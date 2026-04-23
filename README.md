# LordCred

Plataforma de aquecimento inteligente de chips WhatsApp + CRM de vendas + Auditoria de Comissões integrada.

## Stack

- **Frontend**: React 18 + Vite 5 + TypeScript 5 + Tailwind CSS v3 + shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions, Realtime, RLS)
- **WhatsApp API**: UazAPI v2 (uazapiGO) + Meta WhatsApp Business API (secundário)
- **Contratos Digitais**: ClickSign
- **Integração Corban**: NewCorban API (propostas, FGTS, assets)
- **Deploy**: Lovable Cloud

## Setup

```bash
npm install
npm run dev
```

## Comandos

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run preview` | Preview do build |
| `npm run test` | Testes (Vitest) |
| `npm run lint` | Lint (ESLint) |

## Estrutura

```
src/
├── components/       # Componentes React
│   ├── admin/        # Componentes administrativos (LeadConfigTab, BatchHistoryTab, etc.)
│   ├── charts/       # Gráficos (ChipsStatusChart, MessagesChart)
│   ├── commission-reports/  # Relatório de Comissões (11 abas)
│   ├── commissions/  # Comissões de parceiros (6 abas)
│   ├── corban/       # Integração NewCorban (analytics, config, mapping)
│   ├── layout/       # Layout (DashboardLayout)
│   ├── messages/     # Fila e histórico
│   ├── partners/     # Parceiros e contratos (Kanban, ClickSign)
│   ├── profile/      # Perfil do usuário
│   ├── ui/           # shadcn/ui primitivos
│   └── whatsapp/     # Chat WhatsApp, Kanban, Labels, Media
├── contexts/         # React Contexts (AuthContext, InternalChatUnreadContext)
├── hooks/            # Custom hooks (15 hooks modulares)
│   ├── useChatActions.ts      # Ações de chat (envio, mídia, status)
│   ├── useChatMessages.ts     # Mensagens do chat (paginação, busca, real-time)
│   ├── useConversations.ts    # Gestão de conversas (sidebar)
│   ├── useInternalChat.ts     # Chat interno entre operadores
│   ├── useLeadsData.ts        # Dados de leads (fetch, constantes)
│   ├── useRealtimeSubscription.ts # Hook genérico para Supabase Realtime
│   └── ...
├── integrations/     # Supabase client + types (read-only)
├── lib/              # Utilitários (clipboardParser, corban, storageUpload, etc.)
├── pages/            # Páginas da aplicação
│   ├── admin/        # 25+ páginas administrativas
│   └── corban/       # Páginas do vendedor Corban
docs/                 # Documentação completa (12 documentos)
supabase/
└── functions/        # 17 Edge Functions (Deno)
```

## Módulos de Comissão (3 isolados)

| Módulo | Rota | Status |
|---|---|---|
| **Auditoria** | `/admin/commission-reports` | Produção — 11 abas, cálculo SUMIFS |
| **Parceiros V1** | `/admin/commissions` | Produção — fórmula FGTS antiga (3 cols) |
| **Parceiros V2** 🧪 | `/admin/commissions-v2` | Sandbox — nova fórmula FGTS multivariável (8 cols) com 28 taxas pré-populadas (LOTUS, HUB, FACTA, Paraná) |

Detalhes do V2: [docs/COMMISSIONS-V2.md](docs/COMMISSIONS-V2.md). V1 permanece intocado durante validação.

## Meta WhatsApp Business (credenciais editáveis)

Tela **Admin → Integrações → Meta WhatsApp** permite editar 5 campos (App ID, App Secret, WABA ID, Phone Number ID, Verify Token) sem redeploy. Edge functions leem do banco com fallback para `Deno.env`. Manual: [docs/META-WHATSAPP-SETUP.md](docs/META-WHATSAPP-SETUP.md).

## Edge Functions (18)

| Função | Descrição |
|---|---|
| `warming-engine` | Motor de aquecimento de chips |
| `queue-processor` | Processador de fila de mensagens |
| `evolution-webhook` | Receptor de webhooks UazAPI (nome legado) |
| `uazapi-api` | Proxy autenticado para UazAPI |
| `whatsapp-gateway` | Gateway WhatsApp (Meta Business API) |
| `meta-webhook` | Receptor de webhooks Meta |
| `instance-maintenance` | Manutenção de instâncias |
| `chip-health-check` | Verificação de saúde dos chips |
| `sync-history` | Sincronização de histórico |
| `create-user` | Criação de usuários |
| `delete-user` | Exclusão de usuários |
| `update-user-role` | Atualização de roles |
| `corban-api` | Proxy para NewCorban API |
| `corban-status-sync` | Sincronização de status Corban (pg_cron) |
| `corban-snapshot-cron` | Snapshot periódico de propostas |
| `clicksign-api` | Proxy para ClickSign API |
| `clicksign-webhook` | Receptor de webhooks ClickSign |
| `broadcast-sender` | Envio em massa com rate limiting (texto, imagem, documento) |

## Roles

| Role | Frontend | is_privileged() |
|---|---|---|
| `master` | Master | ✅ |
| `admin` | Administrador | ✅ |
| `manager` | Gerente | ✅ |
| `support` | Suporte | ❌ |
| `seller` | Vendedor | ❌ |

> Função `is_privileged()` (SECURITY DEFINER) retorna `true` para master, admin e manager.

## Documentação

| Documento | Descrição |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Requisitos do produto |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Fases e prioridades |
| [docs/SYSTEM-DESIGN.md](docs/SYSTEM-DESIGN.md) | Arquitetura técnica |
| [docs/DATABASE-SCHEMA.md](docs/DATABASE-SCHEMA.md) | Schema completo do banco |
| [docs/SECURITY.md](docs/SECURITY.md) | Práticas de segurança |
| [docs/CODE-STANDARDS.md](docs/CODE-STANDARDS.md) | Padrões de código |
| [docs/EDGE-FUNCTIONS.md](docs/EDGE-FUNCTIONS.md) | Catálogo de Edge Functions |
| [docs/ONBOARDING.md](docs/ONBOARDING.md) | Guia para novos devs |
| [docs/ADR.md](docs/ADR.md) | Decisões arquiteturais |
| [docs/INSTRUCOES.md](docs/INSTRUCOES.md) | Manual de uso |
| [docs/PENDENCIAS.md](docs/PENDENCIAS.md) | Changelog |
| [docs/COMMISSION-REPORTS.md](docs/COMMISSION-REPORTS.md) | Auditoria de comissões |
| [docs/corban.md](docs/corban.md) | Integração NewCorban |
| [docs/UAZAPI.md](docs/UAZAPI.md) | Referência UazAPI |
| [docs/HISTORICO-EVOLUTION-CLEANUP.md](docs/HISTORICO-EVOLUTION-CLEANUP.md) | Migração Evolution → UazAPI |

## Refatorações Recentes (Abril 2026)

O projeto passou por 4 etapas de refatoração modular:
1. **Etapa 1**: Decomposição de Commissions (900→250 linhas) e InternalChat (hooks extraídos)
2. **Etapa 2**: Modularização de ChatSidebar (hooks useConversations + useChatActions)
3. **Etapa 3**: Decomposição de ChatWindow (hook useChatMessages) e início de Leads
4. **Etapa 4**: Finalização de Leads (LeadConfigTab) + hook genérico useRealtimeSubscription
