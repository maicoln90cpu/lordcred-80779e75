# LordCred — Product Requirements Document

## Visão do Produto

LordCred é uma plataforma de aquecimento inteligente de chips WhatsApp com funcionalidades integradas de CRM de vendas e auditoria de comissões. Permite que equipes comerciais gerenciem chips, aqueçam números de forma gradual e segura, operem vendas via WhatsApp e auditem comissões recebidas vs esperadas.

## Público-Alvo

- Equipes de vendas que utilizam WhatsApp como canal principal
- Operadores de múltiplos números WhatsApp
- Gestores que precisam monitorar performance de equipe
- Auditores de comissões bancárias (CLT e FGTS)

## Stack Técnica

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions, Realtime, RLS)
- **Integração WhatsApp**: UazAPI v2 (uazapiGO)
- **Integração Corban**: NewCorban API (propostas, FGTS, assets)
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
- Respostas rápidas (atalhos com trigger word)
- Labels/etiquetas
- Encaminhamento de mensagens

### CRM — Gestão

- Kanban de conversas (colunas customizáveis, drag & drop)
- Gestão de leads (importação CSV, filtros, atribuição)
- Tickets de suporte interno

### Relatório de Comissões (Auditoria)

- Importação de 4 planilhas: Geral, Repasse, Seguros, Relatório (via Ctrl+V paste)
- Motor de cálculo CLT: `extractTableKeyCLT` → `findCLTRate` (SUMIFS-style)
- Motor de cálculo FGTS: `extractTableKeyFGTS` → `findFGTSRate` (SUMIFS-style)
- Regras configuráveis por banco/tabela/prazo/seguro (cr_rules_clt, cr_rules_fgts)
- Cross-reference: cruzamento entre Relatório + Geral + Repasse + Seguros
- Resumo com filtros de período e resumo por banco
- Tabela detalhada com todos os contratos individuais
- Indicadores: Acurácia Global, Perda Acumulada, Taxa Média por banco
- Histórico de fechamentos (salvar/expandir/deletar)
- Divergências: filtra contratos com |Δ| > R$0.01
- Timezone: São Paulo (America/Sao_Paulo) em todos os cálculos de data

### Integração Corban (NewCorban)

- Dashboard administrativo com KPIs
- Gestão de propostas (consulta, criação, acompanhamento)
- Fila FGTS com filtros e status
- Cache de assets (bancos, convênios, tabelas)
- Configuração de visibilidade por papel (30 funcionalidades)
- Sincronização automática de status via edge function (pg_cron)
- Páginas do vendedor: propostas e FGTS próprios

### Operacional

- Dashboard com métricas (mensagens enviadas, chips ativos, taxa de entrega)
- Monitor de chips (separado por tipo: aquecimento vs chat)
- Health check de chips
- Diagnóstico de webhooks
- Fila de mensagens (visualização e gerenciamento)
- Chat interno entre operadores
- Logs de auditoria
- Assistência remota
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

> Função `is_privileged()` (SECURITY DEFINER) retorna `true` para master, admin, manager.

> Tabela completa de permissões em [INSTRUCOES.md](./INSTRUCOES.md#matriz-de-permissões-por-papel)

---

## Backlog Conhecido

- [ ] Disparos em massa (broadcasts) com controle de taxa
- [ ] API pública REST para integrações externas
- [ ] Progressão automática de fases de aquecimento
- [ ] Notificações push para mensagens recebidas (service worker)
- [ ] Filtros avançados no Kanban
- [ ] Multi-tenant (múltiplas organizações)
- [ ] Dashboard de métricas customizável
- [ ] Revisão de UX mobile
- [ ] Testes automatizados (Vitest)
- [ ] Performance (lazy loading, code splitting)

---

## Ver Também

- [ROADMAP.md](./ROADMAP.md) — Fases e prioridades
- [SYSTEM-DESIGN.md](./SYSTEM-DESIGN.md) — Arquitetura técnica
- [INSTRUCOES.md](./INSTRUCOES.md) — Manual de uso
- [COMMISSION-REPORTS.md](./COMMISSION-REPORTS.md) — Auditoria de comissões
- [corban.md](./corban.md) — Integração NewCorban
- [PENDENCIAS.md](./PENDENCIAS.md) — Changelog
