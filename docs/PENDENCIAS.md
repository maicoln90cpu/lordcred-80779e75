# LordCred — Changelog / Histórico de Mudanças

---

## 2026-03-31 — Auditoria de Documentação

- Atualização completa de todos os documentos: README, PRD, ROADMAP, SYSTEM-DESIGN, INSTRUCOES
- Criação de `docs/COMMISSION-REPORTS.md` (documentação dedicada do sistema de auditoria)
- Alinhamento de roles para 5 papéis: master, admin, manager, support, seller
- Limpeza de `.lovable/plan.md` (conteúdo obsoleto)
- Atualização do Knowledge Base prompt

## 2026-03-31 — Tooltip Estável + Resumo Detalhado + Indicadores

- Fix: tooltip em TSHead não deforma mais colunas (TooltipTrigger movido para span interno)
- Resumo: adicionada tabela detalhada com todos os contratos (paginada, 100/página)
- Resumo: removido limite top-10 bancos, agora mostra todos
- Resumo: card informativo sobre Histórico e Divergências
- Indicadores: reescrito para usar `cr_relatorio` como fonte primária
- Indicadores: mesmas funções `findCLTRate`/`findFGTSRate` do Relatório

## 2026-03-30 — Fix Cálculos CLT/FGTS + Regras Corrigidas

- Correção de dados duplicados em `cr_rules_clt` (remoção de registros com data 2026-03-24)
- Inserção dos dados corretos de regras CLT conforme planilha original
- Fix: `findCLTRate` agora usa SUMIFS-style (soma todas as regras `*` aplicáveis)
- Fix: `findFGTSRate` corrigido para buscar taxa com wildcard `*` + seguro-específica
- Fix: Mercantil do Brasil usa `valor_liberado / 0.7` para base de cálculo
- Fix: C6 Bank CLT diferencia "Seguro 2 Parcelas" vs "4 Parcelas" via tabela_chave
- Scroll horizontal em todas as tabelas de comissão

## 2026-03-29 — Resumo: Fonte Correta + Timezone

- Resumo agora usa `cr_relatorio` como fonte (antes usava `cr_geral`)
- Filtros de data usam `toSaoPauloDate()` com range inclusivo
- Cross-reference com Geral+Repasse+Seguros para comissão recebida
- Comissão esperada calculada com mesma lógica do Relatório
- Fix timezone: datas boundary agora incluem dia inteiro (00:00 a 23:59 SP)

## 2026-03-28 — Import: Fix CPF, Colunas, Tooltip

- Fix: CPF em notação científica (`9.67E+10`) agora preserva formato original
- Fix: Geral/Repasse importando `cod_contrato`, `prod_liq`, `prod_bruta` corretamente
- Fix: Repasse importando coluna `Favorecido Codigo-Nome`
- Fix: normalização de headers com pontos (`Cód. Contrato` → `cod contrato`)
- Fix: tooltip em colunas não deforma layout

## 2026-03-27 — Import Ctrl+V para Geral, Repasse, Seguros

- Sistema de paste import (Ctrl+V) para planilhas
- Detecção automática de duplicatas por batch_id
- Preview antes de importar com contagem de registros
- Histórico de importações com botão de exclusão
- Fix: deleção em cascata (batch + registros)
- Fix: Repasse sem coluna `cms_rep` (removida do payload)
- Fix: Seguros headerless parsing (dados sem cabeçalho)

## 2026-03-25 — Relatório de Comissões: 8 Abas

- Implementação completa do módulo Commission Reports
- 8 abas: Geral, Repasse, Seguros, Relatório, Resumo, Indicadores, Regras CLT, Regras FGTS, Histórico
- Import via paste para Relatório
- Cálculo de comissão esperada CLT e FGTS
- Cross-reference entre Relatório e Geral/Repasse/Seguros
- Resumo por banco com totais
- Histórico de fechamentos (salvar/expandir/deletar)

## 2026-03-20 — Integração NewCorban

- Edge function `corban-api`: proxy autenticado para NewCorban
- Edge function `corban-status-sync`: sincronização automática via pg_cron
- Dashboard Corban com KPIs
- Gestão de propostas (consulta, criação)
- Fila FGTS com filtros
- Cache de assets (bancos, convênios, tabelas)
- Configuração de visibilidade por papel (30 funcionalidades)
- Páginas do vendedor: propostas e FGTS próprios

## 2026-03-15 — Manager Role + is_privileged()

- Novo role `manager` (Gerente) entre admin e support
- Gerente tem privilégios admin exceto página de Permissões
- Função `is_privileged()` SECURITY DEFINER consolida RLS
- ~60 políticas RLS reduzidas para ~30 unificadas

## 2026-03-12 — Feature Permissions Granulares

- Tabela `feature_permissions` com allowed_roles e allowed_user_ids
- Aba "Por Cargo" e "Por Usuário" na página de Permissões
- Realtime: alterações refletidas imediatamente no menu lateral
- Hook `useFeaturePermissions` com cache de 5 minutos

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
- [COMMISSION-REPORTS.md](./COMMISSION-REPORTS.md) — Auditoria de comissões
