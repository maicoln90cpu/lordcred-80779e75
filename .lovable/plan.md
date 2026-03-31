## Plano: Relatórios Comissões + Hist. Importações + Personalizações Parceiros

Dividido em 4 etapas:

---

### ✅ Etapa 1 — Infraestrutura (CONCLUÍDA)
- Migration SQL: 8 tabelas novas (`import_batches`, `cr_geral`, `cr_repasse`, `cr_seguros`, `cr_rules_fgts`, `cr_rules_clt`, `cr_historico_gestao`, `cr_historico_detalhado`)
- `commission_sales.batch_id` adicionado
- `commission_settings.bonus_threshold` e `bonus_rate` adicionados
- Feature permission `commission_reports` criada
- Rota `/admin/commission-reports` registrada em App.tsx
- Menu lateral: "Relat. Comissões" no grupo Equipe
- Mapeamento de permissão em `useFeaturePermissions.ts`
- Página skeleton com 10 abas (placeholders)

### 🔲 Etapa 2 — Importação de Dados
- Abas Geral, Repasse, Seguros: upload Excel + mapeamento de colunas + tabela com busca
- Aba Hist. Importações (em CommissionReports): lista lotes + deletar
- Aba Hist. Importações (em Commissions/Parceiros): lista lotes + deletar + batch_id na importação Base

### ✅ Etapa 3 — Regras + Cálculos (CONCLUÍDA)
- Abas Regras FGTS e Regras CLT: CRUD inline
- Aba Relatório: tabela calculada cruzando Geral + Repasse + Seguros + Regras (colunas P-X)
- Aba Resumo: cards de totais + filtro de período + botão salvar histórico
- Aba Divergências: tabela filtrada de contratos com diferença != 0

### 🔲 Etapa 4 — Histórico + Personalizações Parceiros
- Aba Histórico: lista de fechamentos salvos com expand para detalhado
- Em Commissions.tsx: aba Configurações com dia de pagamento, meta mensal, bônus por produção
- Testes e ajustes finais
