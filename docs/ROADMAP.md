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

## Fase 4 — Polimento 🔄 Em Andamento

- [x] Limpeza de código Evolution API
- [x] Consolidação de abas em Chips.tsx
- [x] Permissões granulares (Kanban, Suporte vê todos sellers)
- [x] Monitor de chips com sub-abas por tipo
- [x] Documentação centralizada em `docs/`
- [ ] Revisão de UX mobile
- [ ] Testes automatizados (Vitest)
- [ ] Performance (lazy loading, code splitting)

## Fase 5 — Escala 📋 Planejado

- [ ] Disparos em massa (broadcasts) com controle de taxa
- [ ] Relatórios avançados por vendedor/chip/período
- [ ] API pública REST para integrações externas
- [ ] Progressão automática de fases de aquecimento
- [ ] Notificações push (service worker)
- [ ] Multi-tenant (múltiplas organizações)
- [ ] Dashboard de métricas customizável

---

## Ver Também

- [PRD.md](./PRD.md) — Requisitos do produto
- [SYSTEM-DESIGN.md](./SYSTEM-DESIGN.md) — Arquitetura técnica
- [PENDENCIAS.md](./PENDENCIAS.md) — Changelog detalhado
