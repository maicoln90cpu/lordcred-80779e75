# LordCred — Product Requirements Document

## Visão do Produto

LordCred é uma plataforma de aquecimento inteligente de chips WhatsApp com funcionalidades integradas de CRM de vendas e auditoria de comissões. Permite que equipes comerciais gerenciem chips, aqueçam números de forma gradual e segura, operem vendas via WhatsApp e auditem comissões recebidas vs esperadas.

## Público-Alvo / Personas

- **Gestor Comercial**: Monitora performance de equipe, audita comissões, gerencia parceiros
- **Operador de Chips**: Gerencia múltiplos números WhatsApp, monitora aquecimento
- **Vendedor**: Usa WhatsApp como canal principal de vendas, gerencia leads atribuídos
- **Auditor de Comissões**: Cruza planilhas de produção com regras de comissão (CLT/FGTS)
- **Admin testando nova fórmula FGTS (V2)**: Valida o sandbox de Comissões Parceiros V2 comparando com V1 antes de migrar para produção
- **Suporte**: Atende tickets, cria vendedores, opera ferramentas operacionais

## Métricas de Sucesso

- **Taxa de bloqueio de chips**: < 5% dos chips ativos
- **Acurácia de comissões**: > 95% de contratos sem divergência
- **Tempo de resposta WhatsApp**: < 5min no horário comercial
- **Adoção**: 100% da equipe usando a plataforma diariamente

## Stack Técnica

- **Frontend**: React 18 + Vite 5 + TypeScript 5 + Tailwind CSS v3 + shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions, Realtime, RLS)
- **WhatsApp**: UazAPI v2 (primário) + Meta WhatsApp Business API (secundário)
- **Corban**: NewCorban API (propostas, FGTS, assets)
- **Contratos**: ClickSign (assinatura digital)
- **Deploy**: Lovable Cloud

---

## Features Implementadas

### Core — Aquecimento de Chips

- Conexão de chips via QR Code (UazAPI) e WhatsApp Business (Meta)
- 5 fases de aquecimento: Novo → Iniciante → Crescimento → Aquecido → Maduro
- Distribuição inteligente de mensagens ao longo do dia
- Proteção anti-bloqueio (simulação de digitação, delay de leitura, variação aleatória)
- Templates de mensagens para warming
- Simulador de volume
- Modos: same_user, between_users, external
- Chips compartilhados entre usuários

### CRM — Comunicação

- Chat WhatsApp integrado (envio/recebimento em tempo real)
- Sincronização de histórico de mensagens
- Suporte a mídia (imagem, áudio, vídeo, documento, PTT, sticker)
- Favoritos de mensagens
- Notas de conversa
- Respostas rápidas (atalhos com trigger word)
- Labels/etiquetas
- Encaminhamento de mensagens
- Auditoria de conversas (quem enviou o quê)

### CRM — Gestão

- Kanban de conversas (colunas customizáveis, drag & drop)
- Gestão de leads (importação CSV, filtros, atribuição, configuração de colunas)
- Tickets de suporte interno
- Parceiros com contratos digitais (ClickSign)

### Relatório de Comissões (Auditoria)

- Importação de 4 planilhas: Geral, Repasse, Seguros, Relatório (via Ctrl+V paste)
- Motor de cálculo CLT: `extractTableKeyCLT` → `findCLTRate` (SUMIFS-style)
- Motor de cálculo FGTS: `extractTableKeyFGTS` → `findFGTSRate` (SUMIFS-style)
- Regras configuráveis por banco/tabela/prazo/seguro
- Cross-reference entre Relatório + Geral + Repasse + Seguros
- 11 abas: Geral, Repasse, Seguros, Relatório, Resumo, Indicadores, Regras CLT, Regras FGTS, Hist. Importações, Histórico, Divergências
- Indicadores: Acurácia Global, Perda Acumulada, Taxa Média por banco
- Histórico de fechamentos (salvar/expandir/deletar)
- Timezone: São Paulo (America/Sao_Paulo) em todos os cálculos de data

### Integração Corban (NewCorban)

- Dashboard administrativo com KPIs e analytics
- Gestão de propostas (consulta, criação, acompanhamento)
- Fila FGTS com filtros e status
- Cache de assets (bancos, convênios, tabelas)
- Configuração de visibilidade por papel (30 funcionalidades)
- Sincronização automática de status via edge function (pg_cron)
- Snapshot periódico de propostas para analytics
- Mapeamento vendedor LordCred ↔ vendedor Corban
- Notificações de mudança de status
- Páginas do vendedor: propostas e FGTS próprios

### Contratos Digitais (ClickSign)

- Templates de contrato editáveis
- Envio de contratos para assinatura via ClickSign
- Webhook de status de assinatura
- Preview e visualização de contratos

### Operacional

- Dashboard com métricas (mensagens enviadas, chips ativos, taxa de entrega)
- Monitor de chips (separado por tipo: aquecimento vs chat)
- Health check de chips
- Diagnóstico de webhooks
- Fila de mensagens (visualização e gerenciamento)
- Chat interno entre operadores (canais de grupo + DM)
- Logs de auditoria
- Assistência remota
- Credenciais bancárias (armazenamento seguro)
- Relatórios de aquecimento
- Permissões granulares (por cargo + por usuário, via feature_permissions)

---

## Roles e Permissões

| Role Técnica | Nome no Frontend | Acesso |
|---|---|---|
| `master` | Master | Acesso total + SQL/Migração + Exportação |
| `admin` | Administrador | Acesso total exceto SQL/Migração/Exportação |
| `manager` | Gerente | Acesso total exceto Permissões/SQL/Migração/Exportação |
| `support` | Suporte | Operacional + criação de usuários + vê todos sellers/supports |
| `seller` | Vendedor | Leads atribuídos + tickets próprios + chat interno |

> Tabela completa de permissões em [INSTRUCOES.md](./INSTRUCOES.md#matriz-de-permissões-por-papel)

---

## Backlog Conhecido

- [ ] Disparos em massa (broadcasts) com controle de taxa
- [ ] API pública REST para integrações externas
- [ ] Progressão automática de fases de aquecimento
- [ ] Notificações push para mensagens recebidas (service worker)
- [ ] Multi-tenant (múltiplas organizações)
- [ ] Dashboard de métricas customizável
- [ ] Revisão de UX mobile
- [ ] Testes automatizados abrangentes (Vitest)
- [ ] Performance (lazy loading, code splitting)
- [ ] Webhook reverso da NewCorban
- [ ] Relatórios PDF exportáveis

---

## Ver Também

- [ROADMAP.md](./ROADMAP.md) — Fases e prioridades
- [SYSTEM-DESIGN.md](./SYSTEM-DESIGN.md) — Arquitetura técnica
- [DATABASE-SCHEMA.md](./DATABASE-SCHEMA.md) — Schema do banco
- [INSTRUCOES.md](./INSTRUCOES.md) — Manual de uso
- [COMMISSION-REPORTS.md](./COMMISSION-REPORTS.md) — Auditoria de comissões
- [corban.md](./corban.md) — Integração NewCorban
- [SECURITY.md](./SECURITY.md) — Práticas de segurança
- [PENDENCIAS.md](./PENDENCIAS.md) — Changelog
