# LordCred — Product Requirements Document

## Visão do Produto

LordCred é uma plataforma de aquecimento inteligente de chips WhatsApp com funcionalidades integradas de CRM de vendas. Permite que equipes comerciais gerenciem chips, aqueçam números de forma gradual e segura, e operem vendas via WhatsApp com ferramentas de produtividade (Kanban, leads, chat interno).

## Público-Alvo

- Equipes de vendas que utilizam WhatsApp como canal principal
- Operadores de múltiplos números WhatsApp
- Gestores que precisam monitorar performance de equipe

## Stack Técnica

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions, Realtime, RLS)
- **Integração WhatsApp**: UazAPI v2 (uazapiGO)
- **Deploy**: Lovable Cloud

---

## Features Implementadas

### Core — Aquecimento de Chips

- Conexão de chips via QR Code (UazAPI)
- 5 fases de aquecimento: Novo → Iniciante → Crescimento → Aquecido → Maduro
- Distribuição inteligente de mensagens ao longo do dia
- Proteção anti-bloqueio (simulação de digitação, delay de leitura, variação aleatória)
- Templates de mensagens para warming
- Simulador de volume
- Modos: same_user, between_users, external

### CRM — Comunicação

- Chat WhatsApp integrado (envio/recebimento em tempo real)
- Sincronização de histórico de mensagens
- Suporte a mídia (imagem, áudio, vídeo, documento, PTT, sticker)
- Favoritos de mensagens
- Notas de conversa
- Respostas rápidas
- Labels/etiquetas
- Encaminhamento de mensagens

### CRM — Gestão

- Kanban de conversas (colunas customizáveis, drag & drop)
- Gestão de leads (importação CSV, filtros, atribuição)
- Tickets de suporte interno

### Operacional

- Dashboard com métricas (mensagens enviadas, chips ativos, taxa de entrega)
- Monitor de chips (separado por tipo: aquecimento vs chat)
- Health check de chips
- Diagnóstico de webhooks
- Fila de mensagens (visualização e gerenciamento)
- Chat interno entre operadores
- Logs de auditoria
- Assistência remota

---

## Roles e Permissões

| Role Técnica | Nome no Frontend | Acesso |
|---|---|---|
| `admin` | Master | Acesso total + SQL/Migração + Exportação |
| `user` | Administrador | Acesso total exceto SQL/Migração/Exportação |
| `support` | Suporte | Operacional + criação de usuários + vê todos sellers/supports |
| `seller` | Vendedor | Leads atribuídos + tickets próprios + chat interno |

> Tabela completa de permissões em [INSTRUCOES.md](./INSTRUCOES.md#matriz-de-permissões-por-papel)

---

## Backlog Conhecido

- [ ] Disparos em massa (broadcasts)
- [ ] Relatórios avançados de performance por vendedor
- [ ] API pública para integrações externas
- [ ] Progressão automática de fases de aquecimento
- [ ] Notificações push para mensagens recebidas
- [ ] Filtros avançados no Kanban
- [ ] Exportação de relatórios em PDF

---

## Ver Também

- [ROADMAP.md](./ROADMAP.md) — Fases e prioridades
- [SYSTEM-DESIGN.md](./SYSTEM-DESIGN.md) — Arquitetura técnica
- [INSTRUCOES.md](./INSTRUCOES.md) — Manual de uso
- [PENDENCIAS.md](./PENDENCIAS.md) — Changelog
