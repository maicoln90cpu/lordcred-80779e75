# LordCred — CHANGELOG

> Versionamento oficial seguindo [Keep a Changelog](https://keepachangelog.com) e [SemVer](https://semver.org).
> Para histórico interno detalhado, ver [PENDENCIAS.md](./PENDENCIAS.md).

---

## [2.3.0] — 2026-04-23

### Added
- **4 novas feature keys** sincronizadas em `feature_permissions` e `master_feature_toggles`: `broadcasts`, `commissions_v2`, `v8_simulador`, `integrations`.
- Tooltips descritivos para os 4 novos módulos em `/admin/permissions`.

### Changed
- **Reagrupamento de permissões/módulos** alinhado ao menu lateral:
  - `v8_simulador`, `bank_credentials`, `contract_template` → **Financeiro**
  - `webhooks` → **Operações**
  - `audit_logs`, `permissions` → **Ferramentas**
  - `users` → **Equipe**
  - `integrations` → **Administração**
- **`/whatsapp` botão "+"**: agora abre `ChipConnectDialog` direto para todos os perfis (Master, Admin, Gerente, Suporte, Vendedor) em vez de redirecionar Master/Admin/Gerente/Suporte para `/chips`.
- Rótulos padronizados entre `feature_permissions` e `master_feature_toggles`.

---

## [2.2.0] — 2026-04-23


### Added
- **Módulo Simulador V8 CLT** (`/admin/v8-simulador`) — integração com a V8 Digital (Crédito do Trabalhador) para simulações em lote.
- 3 novas tabelas: `v8_configs_cache`, `v8_simulations`, `v8_batches` (RLS por vendedor + privilegiados).
- Edge function `v8-clt-api` (totalizando **19 edge functions**) com cache de token OAuth (24h, refresh 5min antes), fluxo 3-passos (Consult → Authorize → Simulate), processamento paralelo (3 workers) e progresso via Realtime.
- 4 novos secrets: `V8_CLIENT_ID`, `V8_USERNAME`, `V8_PASSWORD`, `V8_AUDIENCE`.
- Frontend modular: `pages/admin/V8Simulador.tsx`, `components/v8/*`, `hooks/useV8Configs`, `hooks/useV8Batches`, `lib/v8Parser.ts` (parser TSV/CSV de CPFs).
- Item "Simulador V8 CLT" no grupo Financeiro da sidebar.

### Notes
- Banner "🧪 Integração em validação" exibido na tela enquanto o módulo é testado com dados reais.

---

## [2.1.0] — 2026-04-23

### Added
- **Módulo "Comissões Parceiros V2"** (sandbox isolado em `/admin/commissions-v2`) com 7 tabelas espelho `_v2`.
- **Nova estrutura de Taxas FGTS** (`commission_rates_fgts_v2`): 8 colunas (bank, table_key, term_min, term_max, min_value, max_value, has_insurance, rate) — paridade com CLT.
- **28 taxas FGTS pré-populadas**: LOTUS, HUB, FACTA (GOLD PLUS), Paraná e Paraná c/ Seguro.
- Trigger `calculate_commission_v2`: lookup multivariável (banco + tabela + prazo + faixa de valor + seguro + vigência).
- Botões "📋 Copiar vendas do V1 → V2" e "🗑️ Limpar V2" no `BaseTab` do V2 (admin/master).
- **Tela editável de credenciais Meta WhatsApp** (5 campos: app_id, app_secret, waba_id, phone_number_id, webhook_verify_token).
- Documento [COMMISSIONS-V2.md](./COMMISSIONS-V2.md).
- Documento [META-WHATSAPP-SETUP.md](./META-WHATSAPP-SETUP.md).
- Documento [KNOWLEDGE.md](./KNOWLEDGE.md) (resumo para Knowledge oficial).
- Documento [memocopy.md](./memocopy.md) (backup da memória).
- Edge function `broadcast-sender` (totalizando 18 edge functions).

### Changed
- Edge functions `meta-webhook` e `whatsapp-gateway` passam a ler credenciais do **banco primeiro**, com fallback para `Deno.env`.
- `mem://index.md` reorganizado: Regra de Ouro (protocolo de 6 itens) movida para o topo do Core.
- Documentação atualizada: README, PRD, ROADMAP, SYSTEM-DESIGN, DATABASE-SCHEMA, SECURITY, EDGE-FUNCTIONS, ONBOARDING, ADR, INSTRUCOES, PENDENCIAS.
- PDF `uazapiGO_openapi_documentacao.pdf` movido da raiz para `docs/`.

### Notes
- V1 (`/admin/commissions`) **permanece intocado** e em produção.
- Migração V2 → produção será planejada após validação completa.

---

## [2.0.0] — 2026-04-14

### Added
- Refatoração modular completa (4 etapas): Commissions, ChatSidebar, ChatWindow, Leads.
- 15 hooks customizados extraídos.
- Hook genérico `useRealtimeSubscription`.
- 6 documentos novos: DATABASE-SCHEMA, SECURITY, CODE-STANDARDS, EDGE-FUNCTIONS, ONBOARDING, ADR.

### Changed
- Commissions.tsx: 900 → 250 linhas.
- Leads.tsx: 1365 → 210 linhas.

---

## [1.5.0] — 2026-04

### Added
- ClickSign (contratos digitais): `clicksign-api`, `clicksign-webhook`, templates editáveis.
- Meta WhatsApp Business API: `whatsapp-gateway`, `meta-webhook`.
- Corban snapshot: `corban-snapshot-cron` + `corban_propostas_snapshot`.
- Componentes: ContractTemplateEditor, SellerMappingTab, CorbanAnalyticsTab.

---

## [1.4.0] — 2026-03

### Added
- Relatório de Comissões (Audit) com 11 abas e cálculo SUMIFS-style CLT/FGTS.
- Integração NewCorban (propostas, FGTS, assets, dashboard).
- Manager role + hierarquia consolidada de 5 papéis.
- `is_privileged()` SECURITY DEFINER.
- Feature permissions granulares.

### Changed
- Mercantil do Brasil usa `valor_liberado / 0.7` para base de cálculo.

### Removed
- Todo código legado de Evolution API (mantido apenas o nome `evolution-webhook` por compat).

---

## [1.0.0] — 2026-01

### Added
- MVP: autenticação, chips, warming-engine, queue-processor, dashboard, templates.

---

📅 **Atualizado em:** 2026-04-23 (v2.2.0 — Simulador V8 CLT)
🔄 **Atualizar quando:** lançar nova versão minor/major, adicionar/remover edge function, alterar schema.
