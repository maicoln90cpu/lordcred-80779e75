# LordCred — Roadmap

## Fase 1 — Core ✅ Concluída (Jan 2026)

- [x] Autenticação (Supabase Auth)
- [x] Sistema de roles (admin, user, seller, support)
- [x] Dashboard com métricas
- [x] Gestão de chips (criar, conectar, desconectar, deletar)
- [x] Motor de aquecimento (warming-engine)
- [x] Fila de mensagens (queue-processor)
- [x] Templates de mensagens
- [x] Configurações do sistema

## Fase 2 — CRM ✅ Concluída (Fev 2026)

- [x] Chat WhatsApp integrado (envio/recebimento real-time)
- [x] Sincronização de histórico via UazAPI
- [x] Suporte a mídia (imagem, áudio, vídeo, documento, PTT, sticker)
- [x] Kanban de conversas (colunas customizáveis)
- [x] Gestão de leads (importação CSV, atribuição)
- [x] Favoritos, notas, respostas rápidas
- [x] Labels e encaminhamento de mensagens

## Fase 3 — Operacional ✅ Concluída (Mar 2026)

- [x] Monitor de chips (abas separadas: aquecimento vs chat)
- [x] Health check de chips
- [x] Diagnóstico de webhooks
- [x] Chat interno entre operadores
- [x] Tickets de suporte
- [x] Logs de auditoria
- [x] Assistência remota
- [x] Links úteis

## Fase 4 — Polimento e Expansão ✅ Concluída (Mar 2026)

- [x] Limpeza de código Evolution API
- [x] Manager role + hierarquia de 5 roles
- [x] `is_privileged()` SECURITY DEFINER — consolidação RLS
- [x] Feature permissions granulares (por cargo + por usuário)
- [x] Relatório de Comissões: 11 abas completas
- [x] Motor de cálculo CLT/FGTS com SUMIFS-style aggregation
- [x] Integração NewCorban: propostas, FGTS, assets, config, dashboard, analytics
- [x] Sincronização automática de status Corban (pg_cron)
- [x] Snapshot de propostas + analytics
- [x] Mapeamento vendedor LordCred ↔ Corban
- [x] Contratos digitais via ClickSign
- [x] Meta WhatsApp Business API (whatsapp-gateway + meta-webhook)
- [x] Credenciais bancárias
- [x] Relatórios de aquecimento
- [x] Auditoria de conversas

## Fase 4.5 — Refatoração Modular ✅ Concluída (Abr 2026)

- [x] Etapa 1: Decomposição de Commissions (900→250 linhas) + InternalChat (hooks)
- [x] Etapa 2: Modularização de ChatSidebar (useConversations + useChatActions)
- [x] Etapa 3: Decomposição de ChatWindow (useChatMessages) + início Leads
- [x] Etapa 4: Finalização Leads (LeadConfigTab, BatchHistoryTab, LeadExportTab) + useRealtimeSubscription
- [x] Documentação completa atualizada (12 documentos)

## Fase 5 — Escala 📋 Planejado (Q3 2026)

- [x] Disparos em massa (broadcasts) com controle de taxa
- [ ] API pública REST para integrações externas
- [x] Progressão automática de fases de aquecimento
- [ ] Notificações push (service worker)
- [ ] Multi-tenant (múltiplas organizações)
- [ ] Dashboard de métricas customizável
- [ ] Revisão de UX mobile
- [x] Testes automatizados abrangentes (Vitest)
- [ ] Performance (lazy loading, code splitting)
- [ ] Webhook reverso NewCorban

---

## Ver Também

- [PRD.md](./PRD.md) — Requisitos do produto
- [SYSTEM-DESIGN.md](./SYSTEM-DESIGN.md) — Arquitetura técnica
- [DATABASE-SCHEMA.md](./DATABASE-SCHEMA.md) — Schema do banco
- [COMMISSION-REPORTS.md](./COMMISSION-REPORTS.md) — Auditoria de comissões
- [PENDENCIAS.md](./PENDENCIAS.md) — Changelog detalhado
