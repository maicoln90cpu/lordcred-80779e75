# LordCred

Plataforma de aquecimento inteligente de chips WhatsApp + CRM de vendas + Auditoria de Comissões integrada.

## Stack

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions, Realtime, RLS)
- **WhatsApp API**: UazAPI v2 (uazapiGO)
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
│   ├── admin/        # Componentes administrativos
│   ├── charts/       # Gráficos
│   ├── commission-reports/  # Relatório de Comissões (8 abas)
│   ├── layout/       # Layout (DashboardLayout)
│   ├── messages/     # Fila e histórico
│   ├── profile/      # Perfil do usuário
│   ├── ui/           # shadcn/ui primitivos
│   └── whatsapp/     # Chat WhatsApp, Kanban, Labels
├── contexts/         # React Contexts (AuthContext)
├── hooks/            # Custom hooks
├── integrations/     # Supabase client + types
├── lib/              # Utilitários (clipboardParser, corban, etc.)
├── pages/            # Páginas da aplicação
│   ├── admin/        # Páginas administrativas
│   └── corban/       # Páginas do vendedor Corban
docs/                 # Documentação completa
supabase/
└── functions/        # Edge Functions (Deno)
```

## Documentação

| Documento | Descrição |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Requisitos do produto |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Fases e prioridades |
| [docs/SYSTEM-DESIGN.md](docs/SYSTEM-DESIGN.md) | Arquitetura técnica |
| [docs/INSTRUCOES.md](docs/INSTRUCOES.md) | Manual de uso |
| [docs/PENDENCIAS.md](docs/PENDENCIAS.md) | Changelog |
| [docs/COMMISSION-REPORTS.md](docs/COMMISSION-REPORTS.md) | Sistema de Auditoria de Comissões |
| [docs/corban.md](docs/corban.md) | Integração NewCorban |
| [docs/UAZAPI.md](docs/UAZAPI.md) | Referência de endpoints UazAPI |
| [docs/uazapidoc.md](docs/uazapidoc.md) | Documentação OpenAPI completa |
| [docs/HISTORICO-EVOLUTION-CLEANUP.md](docs/HISTORICO-EVOLUTION-CLEANUP.md) | Migração Evolution → UazAPI |

## Roles

| Role | Frontend | Acesso |
|---|---|---|
| `master` | Master | Total + SQL/Export |
| `admin` | Administrador | Total exceto SQL/Export |
| `manager` | Gerente | Total exceto Permissões/SQL/Export |
| `support` | Suporte | Operacional + criação de usuários |
| `seller` | Vendedor | Leads próprios + tickets + chat interno |

> Função `is_privileged()` (SECURITY DEFINER) retorna `true` para master, admin e manager.
