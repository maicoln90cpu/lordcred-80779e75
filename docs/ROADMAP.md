# LordCred — Roadmap

## Fase 1 — Core ✅ Concluída

- [x] Autenticação (Supabase Auth)
- [x] Sistema de roles (admin, user, seller, support)
- [x] Dashboard com métricas
- [x] Gestão de chips (criar, conectar, desconectar, deletar)
- [x] Motor de aquecimento (warming-engine)
- [x] Fila de mensagens (queue-processor)
- [x] Templates de mensagens
- [x] Configurações do sistema

## Fase 2 — CRM ✅ Concluída

- [x] Chat WhatsApp integrado (envio/recebimento real-time)
- [x] Sincronização de histórico via UazAPI
- [x] Suporte a mídia (imagem, áudio, vídeo, documento, PTT, sticker)
- [x] Kanban de conversas (colunas customizáveis)
- [x] Gestão de leads (importação CSV, atribuição)
- [x] Favoritos, notas, respostas rápidas
- [x] Labels e encaminhamento de mensagens

## Fase 3 — Operacional ✅ Concluída

- [x] Monitor de chips (abas separadas: aquecimento vs chat)
- [x] Health check de chips
- [x] Diagnóstico de webhooks
- [x] Chat interno entre operadores
- [x] Tickets de suporte
- [x] Logs de auditoria
- [x] Assistência remota
- [x] Links úteis

## Fase 4 — Polimento e Expansão ✅ Concluída

- [x] Limpeza de código Evolution API
- [x] Consolidação de abas em Chips.tsx
- [x] Permissões granulares (Kanban, Suporte vê todos sellers)
- [x] Monitor de chips com sub-abas por tipo
- [x] Documentação centralizada em `docs/`
- [x] Manager role + hierarquia de 5 roles
- [x] `is_privileged()` SECURITY DEFINER — consolidação RLS
- [x] Feature permissions granulares (por cargo + por usuário)
- [x] Relatório de Comissões: 8 abas (Geral, Repasse, Seguros, Relatório, Resumo, Indicadores, Regras CLT/FGTS, Histórico)
- [x] Import via Ctrl+V (paste) para Geral, Repasse, Seguros, Relatório
- [x] Motor de cálculo CLT/FGTS com SUMIFS-style aggregation
- [x] Resumo com filtros de período + tabela detalhada
- [x] Indicadores: Acurácia, Perda Acumulada, Taxa Média
- [x] Timezone padronizado (São Paulo) nos cálculos de comissão
- [x] Tooltip estável em tabelas (CRSortUtils)
- [x] Integração NewCorban: propostas, FGTS, assets, config, dashboard
- [x] Páginas seller Corban (propostas + FGTS)
- [x] Sincronização automática de status Corban (pg_cron)

## Fase 5 — Escala 📋 Planejado

- [ ] Disparos em massa (broadcasts) com controle de taxa
- [ ] API pública REST para integrações externas
- [ ] Progressão automática de fases de aquecimento
- [ ] Notificações push (service worker)
- [ ] Multi-tenant (múltiplas organizações)
- [ ] Dashboard de métricas customizável
- [ ] Revisão de UX mobile
- [ ] Testes automatizados (Vitest)
- [ ] Performance (lazy loading, code splitting)

---

## Ver Também

- [PRD.md](./PRD.md) — Requisitos do produto
- [SYSTEM-DESIGN.md](./SYSTEM-DESIGN.md) — Arquitetura técnica
- [COMMISSION-REPORTS.md](./COMMISSION-REPORTS.md) — Auditoria de comissões
- [PENDENCIAS.md](./PENDENCIAS.md) — Changelog detalhado
