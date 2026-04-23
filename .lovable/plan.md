

# Plano: Sincronizar V1 → V2 + Validar Nova Fórmula FGTS

## Objetivo
1. Criar botão "Copiar vendas do V1 para V2" para comparação lado a lado
2. Copiar dados das abas **PIX** e **Taxas CLT** do V1 para V2 (uma vez só, agora)
3. Confirmar que TODAS as abas do V2 já usam a nova fórmula FGTS multivariável

---

## Item 1 — Botão "Copiar Vendas V1 → V2"

**Onde:** topo do componente `BaseTab.tsx` do V2 (visível só para Admin/Master)

**Comportamento:**
- Botão laranja "📋 Copiar vendas do V1" com ícone Copy
- Ao clicar abre confirmação: "Isso vai copiar TODAS as vendas existentes do módulo V1 para o V2. As vendas do V2 serão recalculadas com a NOVA fórmula FGTS. Continuar?"
- Faz `INSERT INTO commission_sales_v2 SELECT ... FROM commission_sales` (todos os campos: seller_id, sale_date, bank, product, table_name, released_value, term, has_insurance, etc.)
- O **trigger `calculate_commission_v2`** dispara automaticamente em cada INSERT, recalculando `commission_rate`, `commission_value` e `bonus_value` com a nova fórmula
- Após copiar: mostra toast "X vendas copiadas e recalculadas com nova fórmula"
- **Idempotente:** se clicar de novo, mostra aviso "V2 já tem N vendas. Limpar antes? [Sim/Não/Cancelar]"

**Botão extra "🗑️ Limpar V2"** ao lado: deleta tudo de `commission_sales_v2` (volta ao zero).

---

## Item 2 — Copiar PIX e Taxas CLT (executado AGORA via insert tool)

Como são dados (não estrutura), uso o tool de insert para rodar uma vez:

```sql
-- Copiar todos os PIX
INSERT INTO seller_pix_v2 (seller_id, pix_key, pix_type, holder_name, bank_name)
SELECT seller_id, pix_key, pix_type, holder_name, bank_name FROM seller_pix
ON CONFLICT (seller_id) DO NOTHING;

-- Copiar todas as Taxas CLT
INSERT INTO commission_rates_clt_v2 
  (effective_date, bank, table_key, term_min, term_max, has_insurance, rate, obs)
SELECT effective_date, bank, table_key, term_min, term_max, has_insurance, rate, obs
FROM commission_rates_clt;

-- Copiar configurações gerais (semana, bônus)
INSERT INTO commission_settings_v2 
  (week_start_day, bonus_threshold, bonus_rate, bonus_mode, bonus_fixed_value)
SELECT week_start_day, bonus_threshold, bonus_rate, bonus_mode, bonus_fixed_value
FROM commission_settings LIMIT 1
ON CONFLICT DO NOTHING;

-- Copiar bonus tiers e annual rewards
INSERT INTO commission_bonus_tiers_v2 SELECT ... FROM commission_bonus_tiers;
INSERT INTO commission_annual_rewards_v2 SELECT ... FROM commission_annual_rewards;
```

**Importante:** Taxas FGTS V2 NÃO serão copiadas do V1 (estrutura é diferente — V2 já tem as 28 taxas pré-populadas no formato novo).

---

## Item 3 — Resposta direta sobre paridade de dados

### Após executar os 2 passos acima, as abas do V2 terão:

| Aba V2 | Dados | Comportamento |
|---|---|---|
| **Base** | ✅ Mesmas vendas do V1 (após botão "Copiar") | Trigger V2 recalcula tudo com nova fórmula FGTS |
| **PIX** | ✅ Mesmos PIX do V1 (copiado agora) | Idêntico |
| **Taxas FGTS** | ⚠️ DIFERENTE — 28 taxas novas (LOTUS, HUB, FACTA, Paraná) com 8 colunas | Nova estrutura |
| **Taxas CLT** | ✅ Mesmas taxas do V1 (copiado agora) | Idêntico |
| **Extrato** | ✅ Mesmas vendas, mas comissão FGTS pode mudar | Usa nova fórmula |
| **Consolidado** | ✅ Mesmos totais por vendedor | Reflete nova fórmula FGTS |
| **Indicadores** | ✅ Mesmos KPIs | Reflete nova fórmula FGTS |
| **Metas** | ✅ Mesmas metas | Funciona igual |
| **Hist. Importações** | ❌ VAZIO no V2 | Logs de import são por módulo |

### Sobre a nova fórmula FGTS no V2 — SIM, está aplicada em 100%:

A fórmula nova mora **dentro do trigger `calculate_commission_v2`** que está anexado à tabela `commission_sales_v2`. Toda vez que uma venda é inserida ou atualizada em V2, ela recalcula:

```text
Lookup: bank + table_key + term (min/max) + released_value (min/max) + has_insurance + effective_date
```

**Por isso, TODAS as abas que leem `commission_sales_v2` (Extrato, Consolidado, Indicadores, Metas) automaticamente refletem a nova fórmula.** Não há cálculo no frontend — tudo vem do banco com a comissão já calculada pelo trigger.

### Diferença esperada (exemplos de venda FGTS)

| Cenário | V1 (fórmula antiga) | V2 (fórmula nova) |
|---|---|---|
| Lotus 1+, R$ 500, 3 anos, c/ seguro | Taxa única do banco (ex: 18%) | Taxa específica da tabela LOTUS 1+ → 24% |
| HUB Carta na Manga, R$ 1500, 4 anos | Taxa única (ex: 15%) | Taxa por faixa de valor R$1001-2000 → 18% |
| FACTA GOLD PLUS 2 anos | Taxa única (ex: 16%) | Taxa específica da tabela 2 anos → 20% |
| Paraná c/ seguro, 5 anos | Taxa genérica | Taxa específica seguro → 22% |
| **CLT (qualquer)** | igual ao V2 | **igual ao V1** (sem mudança) |

---

## Arquitetura final

```text
┌─────────────────────────────────────┐
│ V1 (intacto, em produção)          │
│  commission_sales                   │
│  └─ trigger calculate_commission()  │
└─────────────────────────────────────┘
              ↓ (copiar via botão)
┌─────────────────────────────────────┐
│ V2 (sandbox)                        │
│  commission_sales_v2                │
│  └─ trigger calculate_commission_v2 │
│      ├─ FGTS: nova lógica 8 colunas │
│      └─ CLT:  mesma lógica do V1    │
└─────────────────────────────────────┘
```

---

## Vantagens
- Comparação real lado a lado: abrir V1 e V2 e ver diferenças por vendedor/contrato
- Validação ao vivo das 28 novas taxas com vendas reais já existentes
- Reversível: botão "Limpar V2" devolve sandbox ao zero quando quiser

## Desvantagens / Riscos
- Comissões em V2 serão **diferentes** do V1 para vendas FGTS (esse é o objetivo, mas precisa estar claro)
- Se rodar "Copiar" duas vezes sem limpar → vendas duplicadas (bloqueado pelo aviso)
- Taxas FGTS antigas (`commission_rates_fgts`) **não viram** para V2 — V2 usa as 28 novas
- Storage do banco: ~2x das vendas (espelho V1+V2)

## Etapas de execução (após aprovação)

1. **INSERT** copiar PIX, Taxas CLT, settings, bonus tiers, annual rewards do V1 para V2 (uma vez, agora)
2. **Código** adicionar botões "📋 Copiar vendas do V1" e "🗑️ Limpar V2" no `BaseTab.tsx` do V2
3. **Toast** com contagem de vendas copiadas + aviso de recálculo

## Checklist manual (depois)

1. Abrir `/admin/commissions-v2` → aba **PIX** → ver mesmos PIX do V1 ✅
2. Aba **Taxas CLT** → ver mesmas taxas do V1 ✅
3. Aba **Taxas FGTS** → ver as 28 taxas novas (LOTUS/HUB/FACTA/Paraná) ✅
4. Aba **Base** → clicar "📋 Copiar vendas do V1" → confirmar
5. Toast aparece "X vendas copiadas e recalculadas"
6. Aba **Extrato** → ver mesmas vendas, mas comissões FGTS podem ter mudado
7. Aba **Consolidado** → comparar totais por vendedor com V1
8. Abrir V1 lado a lado → identificar contratos com diferença

## Pendências
- **Decidir depois:** se aprovar V2, criar plano de migração definitiva (renomear V2 → produção, descontinuar V1)
- **Opcional futuro:** botão "Comparar V1 vs V2" que mostra tabela com diferenças contrato a contrato

## Prevenção de regressão
- Botão "Copiar" só visível para Admin/Master (não para vendedor)
- Confirmação dupla antes de copiar/limpar
- Banner amarelo permanente no V2 reforçando que é sandbox
- V1 nunca é alterado em nenhuma operação

