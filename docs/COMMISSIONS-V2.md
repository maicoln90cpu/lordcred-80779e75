# LordCred — Comissões Parceiros V2 (Sandbox)

> Módulo experimental isolado para validar a **nova fórmula multivariável de Taxas FGTS** sem afetar o módulo V1 em produção.
> Acesso: `/admin/commissions-v2` (visível apenas para admin/master/manager).

---

## Por que existe?

A fórmula antiga de Taxas FGTS (V1) usava apenas 3 colunas (`bank`, `rate_with_insurance`, `rate_no_insurance`) e aplicava taxa única por banco. As novas regras dos parceiros (LOTUS, HUB, FACTA, Paraná) exigem lookup multivariável (banco + tabela + prazo + faixa de valor + seguro + vigência) — mesma lógica que o CLT já usa.

Em vez de alterar V1 e arriscar quebrar produção, foi criado o **V2 como sandbox isolado**. V1 continua funcionando 100%.

---

## Arquitetura

```
┌─────────────────────────────────────┐
│ V1 (/admin/commissions) — produção  │
│  commission_sales                   │
│  commission_rates_fgts (3 colunas)  │
│  commission_rates_clt               │
│  └─ trigger calculate_commission()  │
└─────────────────────────────────────┘
              ↓ (botão "Copiar V1 → V2")
┌─────────────────────────────────────┐
│ V2 (/admin/commissions-v2) — sandbox│
│  commission_sales_v2                │
│  commission_rates_fgts_v2 (8 colunas) ← NOVA estrutura
│  commission_rates_clt_v2            │
│  seller_pix_v2                      │
│  commission_settings_v2             │
│  commission_bonus_tiers_v2          │
│  commission_annual_rewards_v2       │
│  └─ trigger calculate_commission_v2 │
│      ├─ FGTS: nova lógica SUMIFS    │
│      └─ CLT:  mesma lógica do V1    │
└─────────────────────────────────────┘
```

## Tabelas espelho (7)

| V1 | V2 | Diferença |
|---|---|---|
| `commission_sales` | `commission_sales_v2` | Trigger diferente |
| `commission_rates_fgts` (3 cols) | `commission_rates_fgts_v2` (8 cols) | **Estrutura nova** |
| `commission_rates_clt` | `commission_rates_clt_v2` | Idêntica |
| `seller_pix` | `seller_pix_v2` | Idêntica |
| `commission_settings` | `commission_settings_v2` | Idêntica |
| `commission_bonus_tiers` | `commission_bonus_tiers_v2` | Idêntica |
| `commission_annual_rewards` | `commission_annual_rewards_v2` | Idêntica |

---

## Nova fórmula FGTS — `commission_rates_fgts_v2`

```sql
CREATE TABLE commission_rates_fgts_v2 (
  id uuid PRIMARY KEY,
  effective_date date NOT NULL,
  bank text NOT NULL,
  table_key text,           -- LOTUS 1+, HUB Carta na Manga, FACTA GOLD PLUS, etc.
  term_min int NOT NULL,    -- prazo mínimo (anos)
  term_max int NOT NULL,    -- prazo máximo (anos)
  min_value numeric NOT NULL, -- valor mínimo liberado
  max_value numeric NOT NULL, -- valor máximo liberado
  has_insurance boolean DEFAULT false,
  rate numeric NOT NULL,    -- % de comissão
  obs text
);
```

### Trigger `calculate_commission_v2` (lookup)

Para cada venda inserida em `commission_sales_v2`:

1. Se `product = 'FGTS'`: busca em `commission_rates_fgts_v2` por:
   `bank` + `table_key` + (`term BETWEEN term_min AND term_max`) + (`released_value BETWEEN min_value AND max_value`) + `has_insurance` + `effective_date <= sale_date`
2. Se `product = 'CLT'`: lógica idêntica ao V1 (busca em `commission_rates_clt_v2`).
3. Calcula `commission_value = released_value * rate / 100`.
4. Aplica bônus se atingir threshold.

### 28 taxas pré-populadas

- **LOTUS** (1+, 2+, 3+, 4+, 5+) — com e sem seguro.
- **HUB** (Carta na Manga, Premium) — faixas de valor.
- **FACTA GOLD PLUS** — por prazo (1-2, 2-3, 3-5, 5-10 anos).
- **Paraná** — taxa base por prazo.
- **Paraná c/ Seguro** — taxa diferenciada.

---

## Botões de gestão (admin/master)

No topo da aba **Base** do V2:

| Botão | Ação |
|---|---|
| 📋 **Copiar vendas do V1** | `INSERT INTO commission_sales_v2 SELECT ... FROM commission_sales` em batches de 50. Trigger recalcula com nova fórmula. |
| 🗑️ **Limpar V2** | `DELETE FROM commission_sales_v2` (apenas vendas, mantém taxas/PIX). |

Confirmação dupla obrigatória. Toast com contagem de vendas processadas.

---

## Dados sincronizados

Já copiados de V1 para V2 (uma vez via migration):
- ✅ Taxas CLT
- ✅ PIX dos vendedores
- ✅ Settings (semana, bônus, meta mensal)
- ✅ Bonus tiers e annual rewards
- ❌ Taxas FGTS (V2 usa as 28 novas — estrutura diferente)
- ❌ Vendas (sob demanda via botão)

---

## Plano de migração futura V2 → produção

Quando V2 for validado:

1. Backup completo de V1.
2. Renomear tabelas: `commission_sales` → `commission_sales_v1_backup`, `commission_sales_v2` → `commission_sales`.
3. Renomear trigger e atualizar referências.
4. Atualizar rotas: `/admin/commissions-v2` → `/admin/commissions`.
5. Arquivar componentes V1 em `src/components/commissions-archive/`.
6. Manter backup por 90 dias antes de excluir.

---

## Como usar (passo a passo)

1. Acesse **Comissões Parceiros V2 🧪** no menu.
2. Aba **Taxas FGTS** → confira as 28 taxas novas.
3. Aba **Base** → clique **📋 Copiar vendas do V1**.
4. Aba **Extrato** → compare comissão calculada com V1 (abrir lado a lado).
5. Aba **Consolidado** → ver totais por vendedor.
6. Encontrou divergência? Reporte ao dev (não ajuste manualmente em V2).

---

📅 **Atualizado em:** 2026-04-23
🔄 **Atualizar quando:** mudar estrutura de `_v2`, adicionar/remover banco, migrar V2 → produção.

---

## 🆕 Etapa 3 — Hardening & validação (2026-05-04)

### 1. Suite Vitest do trigger
Arquivos:
- `src/lib/commissionTriggerLogic.ts` — espelho TS puro do trigger PG `calculate_commission_v2` (e do V1 para comparação).
- `src/lib/__tests__/commissionTriggerLogic.test.ts` — **15 testes** cobrindo:
  - `extractTableKey` (LOTUS 1+→5+, FACTA GOLD vs GOLD PLUS, Paraná/Parana, null).
  - 3 níveis de fallback (specific → generic → fallback → none).
  - Case-insensitive bank, has_insurance, vigência mais recente.
  - Divergência esperada V1 × V2.

> Se mudar o trigger no banco, **atualize `commissionTriggerLogic.ts`** para manter paridade.

### 2. Relatório side-by-side V1 × V2
Componente: `src/components/commissions-v2/V1V2CompareReport.tsx`
Aba: **"V1 × V2"** (apenas admin) em `/admin/commissions-v2`.

Funcionalidades:
- Carrega últimas N vendas (default 500) de `commission_sales` e `commission_sales_v2` por `id` comum.
- Compara `commission_value` linha a linha + totais.
- Filtra "só divergentes" (default) ou "todas".
- Mostra match level V2 (FB / GEN / OK / ×).
- Exporta XLSX para auditoria offline.

### 3. Indicador `rate_match_level` na UI
Implementado em `ExtratoTab.tsx` e `V1V2CompareReport.tsx`:
- 🟢 **OK** = `specific` — banco + table_key + prazo + valor + seguro casaram (ideal)
- 🔵 **GEN** = `generic` — banco + prazo + valor + seguro casaram (ignora table_key)
- 🟣 **GNV** = `generic_no_value` — banco + prazo + seguro casaram (ignora table_key e faixa de valor)
- 🟡 **FB** = `fallback` — só banco + seguro + data (paridade com V1)
- 🔴 **×** = `none` — nenhuma taxa cadastrada / vigência futura

### Como validar
1. Acesse **/admin/commissions-v2 → V1 × V2**.
2. Clique em **Carregar comparação** (ajuste N se quiser).
3. Δ Total deve ficar **verde** (≤ R$ 0,01) → paridade OK.
4. Se houver linhas amarelas, exporte XLSX e revise as taxas FGTS.
5. Rode `bunx vitest run src/lib/__tests__/commissionTriggerLogic.test.ts` antes de qualquer alteração no trigger.

---

## 🆕 Etapa 4 — Cascata `generic_no_value` + alerta de vigência (2026-05-06)

### Novo nível de fallback no trigger
A função `calculate_commission_v2()` (e o espelho TS `commissionTriggerLogic.ts`) agora segue **4 níveis** em ordem:

```text
1) specific          — bank + table_key + term + value + insurance
2) generic           — bank + term + value + insurance (ignora table_key)
3) generic_no_value  — bank + term + insurance       (ignora table_key e valor)
4) fallback          — bank + insurance + date        (paridade V1)
```

Motivo: bancos como **PARANA BANCO** e **FOCO** frequentemente têm taxas cadastradas só para uma faixa de valor; quando a venda fica fora dessa faixa, antes caía em `none`. O nível `generic_no_value` recupera essas vendas usando a regra do prazo.

> Se você adicionar/remover níveis, atualize **3 lugares**:
> - SQL: `supabase/migrations/...` (trigger `calculate_commission_v2`)
> - TS: `src/lib/commissionTriggerLogic.ts`
> - Tipos: `MatchLevel` em `commissionTriggerLogic.ts` + UI badges em `ExtratoTab` e `V1V2CompareReport`.

### Vitest cobrindo o novo nível
`src/lib/__tests__/commissionTriggerLogic.test.ts` — **19 testes** (4 novos):
- PARANA BANCO sem tabela e valor fora da faixa → `generic_no_value`.
- FOCO CLT sem tabela e valor fora da faixa → `generic_no_value`.
- Precedência: `generic` vence sobre `generic_no_value` quando ambos casam.
- Quando o prazo também não casa, cai corretamente em `fallback`.

### Alerta de vigência futura
Componente: `src/components/commissions-v2/FutureEffectiveDateAlert.tsx`
Renderizado no topo de `/admin/commissions-v2` (somente admin).

Detecta automaticamente taxas V2 cuja `effective_date`:
- é **posterior à data de hoje**, OU
- é **posterior à data da venda mais antiga** marcada como `none` para o mesmo banco/seguro/produto.

Exibe lista priorizada (mais vendas afetadas primeiro) com atalho para abrir as abas **Taxas FGTS** ou **Taxas CLT** e corrigir a vigência. Após ajustar, basta clicar em **Recalcular V2** (aba V1 × V2) para reprocessar.

### Botão "Recalcular V2"
Visível para admin no relatório V1 × V2. Chama a RPC `recalculate_commissions_v2()` e atualiza a comparação automaticamente.

