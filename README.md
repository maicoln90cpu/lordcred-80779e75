# LordCred

Plataforma de aquecimento inteligente de chips WhatsApp + CRM de vendas integrado.

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

## Estrutura

```
src/
├── components/       # Componentes React
│   ├── admin/        # Componentes administrativos
│   ├── charts/       # Gráficos
│   ├── layout/       # Layout (DashboardLayout)
│   ├── messages/     # Fila e histórico
│   ├── ui/           # shadcn/ui primitivos
│   └── whatsapp/     # Chat WhatsApp, Kanban, Labels
├── contexts/         # React Contexts (AuthContext)
├── hooks/            # Custom hooks
├── integrations/     # Supabase client + types
├── pages/            # Páginas da aplicação
│   └── admin/        # Páginas administrativas
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
| [docs/UAZAPI.md](docs/UAZAPI.md) | Referência de endpoints UazAPI |
| [docs/uazapidoc.md](docs/uazapidoc.md) | Documentação OpenAPI completa |

## Roles

| Role | Frontend | Acesso |
|---|---|---|
| `admin` | Master | Total |
| `user` | Administrador | Total exceto SQL/Export |
| `support` | Suporte | Operacional + criação de usuários |
| `seller` | Vendedor | Leads próprios + tickets + chat interno |
