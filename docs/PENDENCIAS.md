# LordCred — Changelog / Histórico de Mudanças

---

## 2026-03 — Documentação e Organização

- Centralização de toda documentação na pasta `docs/`
- Criação de PRD, ROADMAP, SYSTEM-DESIGN, PENDENCIAS
- Reescrita do README.md com informações reais do projeto

## 2026-03 — Monitor de Chips: Abas por Tipo

- Adicionadas sub-abas "Chat" e "Aquecimento" no Monitor de Chips
- Chips filtrados por `chip_type` (`whatsapp` vs `warming`)
- KPIs globais mantidos no topo

## 2026-03 — Permissões de Suporte Expandidas

- Suporte agora vê todos os vendedores e outros suportes no sistema
- Anteriormente via apenas os que ele próprio criou

## 2026-03 — Limpeza Completa de Evolution API

- Removida edge function `evolution-api`
- Removido código Evolution de: warming-engine, queue-processor, evolution-webhook, Chips.tsx, MasterAdmin.tsx, MigrationSQLTab.tsx
- Provedor agora é exclusivamente UazAPI
- Detalhes completos em [HISTORICO-EVOLUTION-CLEANUP.md](./HISTORICO-EVOLUTION-CLEANUP.md)

## 2026-03 — Consolidação de Abas em Chips.tsx

- Abas "Gerenciamento" e "Health Check" unificadas
- Health check integrado como botão dentro da aba de gerenciamento

## 2026-03 — Kanban: Permissões Granulares

- Suporte e vendedores com acesso controlado ao Kanban
- Configurações de colunas restritas a admin/user

## 2026-02 — Chat WhatsApp: Melhorias

- Suporte a download de mídia via UazAPI
- Reações em mensagens
- Menu de contexto (copiar, encaminhar, favoritar)
- Notas de conversa por contato
- Painel de favoritos

## 2026-02 — Leads e CRM

- Importação de leads via CSV
- Atribuição de leads a vendedores
- Status customizáveis por sistema
- Filtros e busca avançada

## 2026-01 — Base do Sistema

- Autenticação Supabase
- Sistema de roles (admin, user, seller, support)
- Dashboard com gráficos
- Motor de aquecimento
- Fila de mensagens
- Templates

---

## Ver Também

- [ROADMAP.md](./ROADMAP.md) — Visão de futuro
- [PRD.md](./PRD.md) — Requisitos do produto
