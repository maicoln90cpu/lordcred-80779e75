## Frente 3 — Comissão CLT por faixa de VALOR (REP CLT)

### Contexto (Antes)

Hoje todas as 3 tabelas de regras CLT (V1 parceiros, V2 parceiros, Auditoria) procuram a taxa **só pelo prazo** (term_min/term_max). O REP CLT mudou a regra: agora a comissão também depende da **faixa de valor liberado** (ex.: prazo 6–36, valor R$1.000–5.000 = X%; valor R$5.000–10.000 = Y%).

```
Hoje: banco + tabela + prazo + seguro                  → taxa
Será: banco + tabela + prazo + VALOR + seguro          → taxa
```

### Mudanças (Depois)

#### 1. Banco de dados (migration)

Adicionar 2 colunas em **3 tabelas**, com defaults retrocompatíveis (qualquer linha antiga continua válida pois cobre 0 → 999.999.999):

| Tabela | Colunas novas | Default |
|---|---|---|
| `commission_rates_clt` (V1) | `min_value numeric`, `max_value numeric` | 0 / 999999999 |
| `commission_rates_clt_v2` (V2) | `min_value numeric`, `max_value numeric` | 0 / 999999999 |
| `cr_rules_clt` (Auditoria) | `valor_min numeric`, `valor_max numeric` | 0 / 999999999 |

Índices compostos novos para acelerar o lookup:
- `(bank, table_key, term_min, term_max, min_value, max_value, effective_date)` em V1 e V2
- `(banco, tabela_chave, prazo_min, prazo_max, valor_min, valor_max, data_vigencia)` em auditoria

#### 2. Triggers de cálculo

Atualizar duas funções para incluir o filtro por valor:

- **`calculate_commission()`** (V1) — adicionar `AND min_value <= NEW.released_value AND max_value >= NEW.released_value` no SELECT da CLT (parte específica e parte genérica).
- **`calculate_commission_v2()`** (V2) — idem (mesmo padrão que já existe na CLT V2 do FGTS).

Os defaults garantem que **nada quebra**: qualquer linha existente passa a valer para "qualquer valor".

#### 3. Auditoria (`calculate_commission_audit`)

Atualizar a query interna do bloco CLT para incluir:
```
AND v_valor_calc >= rc.valor_min AND v_valor_calc <= rc.valor_max
```

#### 4. UI — 3 telas idênticas em padrão

**a) `RatesCLTTab.tsx` (V1) — `/admin/commissions`**
- Form: 2 inputs novos "Valor Mín. (R$)" e "Valor Máx. (R$)".
- Tabela: 2 colunas novas "Valor Min" / "Valor Max" (formatadas em BRL).
- Importação Excel: 2 colunas novas no template, parser e preview.
- Export Excel: incluir as 2 colunas.

**b) `RatesCLTTab.tsx` (V2) — `/admin/commissions-v2`**
- Mesmas mudanças (UI idêntica ao V1).

**c) `CRRulesCLT.tsx` (Auditoria) — `/admin/commission-reports` aba Regras CLT**
- Mesmas mudanças com naming PT (`valor_min`/`valor_max`).

#### 5. Tipos & utilitários

- `commissionUtils.ts` (V1 e V2): adicionar `min_value?: number; max_value?: number` no type `RateCLT` e ajustar `findCLTRate()` se existir lookup client-side.
- `src/integrations/supabase/types.ts` será regenerado automaticamente pela migration (não editar manualmente).

#### 6. Documentação

- `docs/COMMISSIONS-V2.md`: documentar a nova lógica + exemplo REP CLT.

### Diagrama de lookup (depois)

```text
Venda CLT chega no trigger
        │
        ▼
SELECT rate
WHERE bank = X
  AND table_key = Y (ou genérico)
  AND has_insurance = Z
  AND term BETWEEN term_min AND term_max
  AND released_value BETWEEN min_value AND max_value   ← NOVO
  AND effective_date <= data_venda
ORDER BY effective_date DESC LIMIT 1
```

### Vantagens
- Suporta REP CLT por faixa de valor sem afetar bancos antigos (defaults 0 → 999.999.999).
- Mesma estrutura nas 3 tabelas — fácil manter.
- Auditoria reflete imediatamente nos relatórios e gráficos.

### Desvantagens / riscos
- 3 telas + 2 triggers + auditoria = mudança ampla. Mitigado por defaults + testes manuais.
- Ordem dos índices precisa ser respeitada para performance (já contemplado).

### Pendências futuras (não nesta entrega)
- FGTS V1 já tem valor; CLT V1 vai ter — paridade total ok.
- Possível UI de "duplicar linha em várias faixas" para acelerar cadastro do REP.

### Checklist manual após deploy
1. Abrir `/admin/commissions-v2` → aba Taxas CLT → conferir colunas "Valor Min/Max" na tabela e no form.
2. Cadastrar 2 taxas REP CLT (ex.: 1.000–5.000 = 3% e 5.000–10.000 = 5%).
3. Lançar uma venda CLT REP de R$ 3.000 → conferir que pegou 3%. Lançar uma de R$ 7.000 → conferir 5%.
4. Repetir em `/admin/commissions` (V1) e `/admin/commission-reports` aba Regras CLT.
5. Conferir que vendas antigas continuam calculando igual (regras sem faixa = abrange tudo).

### Prevenção de regressão
- Defaults amplos garantem retrocompatibilidade.
- Documentação atualizada em `COMMISSIONS-V2.md`.
- Sugestão futura: teste vitest cobrindo `findCLTRate` com faixa de valor.

---

**Pronto para executar?** Confirme e eu rodo a migration + atualizo as 3 telas + triggers + auditoria.