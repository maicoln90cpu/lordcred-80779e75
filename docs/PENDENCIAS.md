# LordCred — Changelog / Histórico de Mudanças

---

## 2026-04-14 — Documentação Completa Atualizada

- Atualização de README, PRD, ROADMAP, SYSTEM-DESIGN, INSTRUCOES, PENDENCIAS
- Criação de 6 novos documentos: DATABASE-SCHEMA, SECURITY, CODE-STANDARDS, EDGE-FUNCTIONS, ONBOARDING, ADR
- Cross-references validados entre todos os 15 documentos
- Knowledge Base prompt atualizado com 17 edge functions e 40+ tabelas

## 2026-04-14 — Refatoração Modular (Etapas 1-4)

- **Etapa 1**: Commissions.tsx (900→250 linhas), InternalChat (hook useInternalChat extraído)
- **Etapa 2**: ChatSidebar modularizado (hooks useConversations + useChatActions)
- **Etapa 3**: ChatWindow decomposição (hook useChatMessages), BatchHistoryTab, LeadExportTab
- **Etapa 4**: LeadConfigTab extraído, useRealtimeSubscription genérico criado
- Leads.tsx reduzido de 1365 para ~210 linhas
- 15 hooks customizados no total

## 2026-04 — ClickSign + Meta WhatsApp + Corban Snapshot

- Edge functions: clicksign-api, clicksign-webhook (contratos digitais)
- Edge functions: whatsapp-gateway, meta-webhook (Meta WhatsApp Business API)
- Edge function: corban-snapshot-cron (snapshot periódico de propostas)
- Componentes: ContractTemplateEditor, ContractPreviewDialog, ContractViewerDialog
- Corban: SellerMappingTab, CorbanAnalyticsTab, CorbanNotificationBell
- Tabelas: corban_propostas_snapshot, corban_seller_mapping, corban_notifications, contract_templates, conversation_audit_log

## 2026-03-31 — Auditoria de Documentação

- Atualização completa de todos os documentos: README, PRD, ROADMAP, SYSTEM-DESIGN, INSTRUCOES
- Criação de `docs/COMMISSION-REPORTS.md` (documentação dedicada do sistema de auditoria)
- Alinhamento de roles para 5 papéis: master, admin, manager, support, seller
- Atualização do Knowledge Base prompt

## 2026-03-31 — Tooltip Estável + Resumo Detalhado + Indicadores

- Fix: tooltip em TSHead não deforma mais colunas (TooltipTrigger movido para span interno)
- Resumo: adicionada tabela detalhada com todos os contratos (paginada, 100/página)
- Resumo: removido limite top-10 bancos, agora mostra todos
- Indicadores: reescrito para usar `cr_relatorio` como fonte primária

## 2026-03-30 — Fix Cálculos CLT/FGTS + Regras Corrigidas

- Correção de dados duplicados em `cr_rules_clt`
- Fix: `findCLTRate` agora usa SUMIFS-style (soma todas as regras `*` aplicáveis)
- Fix: `findFGTSRate` corrigido para buscar taxa com wildcard `*` + seguro-específica
- Fix: Mercantil do Brasil usa `valor_liberado / 0.7` para base de cálculo

## 2026-03-29 — Resumo: Fonte Correta + Timezone

- Resumo agora usa `cr_relatorio` como fonte (antes usava `cr_geral`)
- Filtros de data usam `toSaoPauloDate()` com range inclusivo
- Cross-reference com Geral+Repasse+Seguros para comissão recebida

## 2026-03-28 — Import: Fix CPF, Colunas, Tooltip

- Fix: CPF em notação científica (`9.67E+10`) preserva formato original
- Fix: normalização de headers com pontos (`Cód. Contrato` → `cod contrato`)

## 2026-03-27 — Import Ctrl+V para Geral, Repasse, Seguros

- Sistema de paste import (Ctrl+V) para planilhas
- Detecção automática de duplicatas por batch_id
- Preview antes de importar com contagem de registros

## 2026-03-25 — Relatório de Comissões: 8 Abas

- Implementação completa do módulo Commission Reports
- Import via paste para Relatório
- Cálculo de comissão esperada CLT e FGTS

## 2026-03-20 — Integração NewCorban

- Edge functions: corban-api, corban-status-sync
- Dashboard Corban com KPIs
- Gestão de propostas e fila FGTS
- Cache de assets e configuração de visibilidade

## 2026-03-15 — Manager Role + is_privileged()

- Novo role `manager` (Gerente) entre admin e support
- Função `is_privileged()` SECURITY DEFINER consolida RLS

## 2026-03-12 — Feature Permissions Granulares

- Tabela `feature_permissions` com allowed_roles e allowed_user_ids
- Hook `useFeaturePermissions` com cache de 5 minutos + realtime

## 2026-03 — Limpeza Evolution API + Organização

- Remoção completa de Evolution API (consolidação UazAPI)
- Documentação centralizada em `docs/`
- Monitor de Chips com abas por tipo
- Permissões expandidas para Suporte

## 2026-02 — Chat WhatsApp + CRM

- Suporte a download de mídia, reações, menu de contexto
- Notas de conversa, favoritos
- Importação de leads via CSV, atribuição a vendedores

## 2026-01 — Base do Sistema

- Autenticação Supabase, sistema de roles
- Dashboard com gráficos
- Motor de aquecimento e fila de mensagens

---

## Ver Também

- [ROADMAP.md](./ROADMAP.md) — Visão de futuro
- [PRD.md](./PRD.md) — Requisitos do produto
- [COMMISSION-REPORTS.md](./COMMISSION-REPORTS.md) — Auditoria de comissões
- [DATABASE-SCHEMA.md](./DATABASE-SCHEMA.md) — Schema do banco
