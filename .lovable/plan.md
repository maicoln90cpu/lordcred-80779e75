

# Plano: Inserir Novas Taxas CLT do Banco C6 (Vigência 07/04/2026)

## Análise da Planilha vs Sistema Atual

### O que a planilha traz (22 registros)

A planilha contém exclusivamente taxas do **Banco C6 (CLT)** com uma nova estrutura de seguro mais granular:

```text
PLANILHA NOVA (vigência 07/04/2026)
═══════════════════════════════════════════════════════════════
Prazo  | Normal (s/seg) | SEG 4P  | SEG 6P (NOVO) | SEG 9P (NOVO)
───────┼────────────────┼─────────┼───────────────┼──────────────
6      | 1.50% (Todos)  |   —     |      —        |     —
9      | 1.50% (Todos)  |   —     |      —        |     —
12     | 2.00%          | 2.20%   | 2.20%         | 2.40%
18     | 2.20%          | 2.60%   | 2.70%         | 2.90%
24     | 2.50%          | 2.90%   | 3.00%         | 3.20%
36     | 2.70%          | 3.10%   | 3.20%         | 3.40%
48     | 2.70%          | 3.40%   | 3.50%         | 3.60%
```

### Comparação com Sistema Atual (vigência 2026-03-24)

```text
SISTEMA ATUAL → NOVO
═══════════════════════════════════════════════════════
NORMAL (sem seguro):
  6m:  1.50% → 1.50% (igual)
  9m:  NÃO EXISTIA → 1.50% (NOVO prazo)
  12m: 2.00% → 2.00% (igual)
  18m: 2.25% → 2.20% (REDUZIU 0.05pp)
  24m: 2.50% → 2.50% (igual)
  36m: 2.75% → 2.70% (REDUZIU 0.05pp)
  48m: 2.75% → 2.70% (REDUZIU 0.05pp)

SEGURO 4 Parcelas:
  12m: 2.15% → 2.20% (AUMENTOU 0.05pp)
  18m: 2.65% → 2.60% (REDUZIU 0.05pp)
  24m: 2.90% → 2.90% (igual)
  36m: 3.15% → 3.10% (REDUZIU 0.05pp)
  48m: 3.40% → 3.40% (igual)

SEGURO 6 Parcelas: INTEIRAMENTE NOVO (5 registros)
SEGURO 9 Parcelas: INTEIRAMENTE NOVO (5 registros)

SEGURO 2 Parcelas: EXISTIA, NÃO ESTÁ NA PLANILHA (mantido como está)
```

### Resumo de mudanças:
- **7 registros "Normal"** (sem seguro) — 2 iguais, 3 reduziram, 1 novo prazo (9m), 1 novo prazo equivalente
- **5 registros "4 Parcela"** — 1 aumentou, 2 reduziram, 2 iguais
- **5 registros "6 Parcela"** — todos novos
- **5 registros "9 Parcela"** — todos novos
- **"2 Parcela"** — NÃO mencionado na planilha (serão mantidos como estão)
- **Total de novos registros a inserir: 22**

## Mapeamento para o Banco de Dados

Tabela `commission_rates_clt`:
- `bank`: "Banco C6"
- `effective_date`: "2026-04-07" (hoje)
- `has_insurance`: false para Normal/Todos, true para SEG 4P/6P/9P
- `table_key`: NULL para Normal, "4 Parcela"/"6 Parcela"/"9 Parcela" para os com seguro
- `term_min`/`term_max`: prazo exato (6,9,12,18,24,36,48)
- `rate`: taxa em %
- `obs`: "Normal" / "4 parcelas" / "6 parcelas" / "9 parcelas" / "Todos"

Para prazo "36 ao 48 Normal" da planilha: criar 2 registros (term_min=36 term_max=36 e term_min=48 term_max=48, ambos 2.70%) OU um registro com term_min=36 term_max=48.

## Dados Exatos para Inserção (22 registros)

```text
# NORMAL (sem seguro) — has_insurance=false, table_key=NULL
1.  6,  6,  1.50%, obs="Todos"
2.  9,  9,  1.50%, obs="Todos"
3. 12, 12,  2.00%, obs="Normal"
4. 18, 18,  2.20%, obs="Normal"
5. 24, 24,  2.50%, obs="Normal"
6. 36, 48,  2.70%, obs="Normal 36-48"

# SEGURO 4 PARCELAS — has_insurance=true, table_key="4 Parcela"
7.  12, 12, 2.20%, obs="4 parcelas"
8.  18, 18, 2.60%, obs="4 parcelas"
9.  24, 24, 2.90%, obs="4 parcelas"
10. 36, 36, 3.10%, obs="4 parcelas"
11. 48, 48, 3.40%, obs="4 parcelas"

# SEGURO 6 PARCELAS — has_insurance=true, table_key="6 Parcela"
12. 12, 12, 2.20%, obs="6 parcelas"
13. 18, 18, 2.70%, obs="6 parcelas"
14. 24, 24, 3.00%, obs="6 parcelas"
15. 36, 36, 3.20%, obs="6 parcelas"
16. 48, 48, 3.50%, obs="6 parcelas"

# SEGURO 9 PARCELAS — has_insurance=true, table_key="9 Parcela"
17. 12, 12, 2.40%, obs="9 parcelas"
18. 18, 18, 2.90%, obs="9 parcelas"
19. 24, 24, 3.20%, obs="9 parcelas"
20. 36, 36, 3.40%, obs="9 parcelas"
21. 48, 48, 3.60%, obs="9 parcelas"
```

Total: **21 registros** (36-48 Normal agrupado em 1).

## Impacto no Trigger `calculate_commission`

O trigger já reconhece `table_key` "4 Parcela" via pattern matching `%4 PARCELA%`. Precisamos garantir que "6 Parcela" e "9 Parcela" também sejam reconhecidos. Atualmente o trigger tem:

```sql
ELSIF _table_name_upper LIKE '%4 PARCELA%' ... THEN _table_key := '4 Parcela';
ELSIF _table_name_upper LIKE '%2 PARCELA%' ... THEN _table_key := '2 Parcela';
```

Precisamos adicionar:
```sql
ELSIF _table_name_upper LIKE '%6 PARCELA%' ... THEN _table_key := '6 Parcela';
ELSIF _table_name_upper LIKE '%9 PARCELA%' ... THEN _table_key := '9 Parcela';
```

## Plano de Execução

### Etapa 1 — Inserir os 21 registros via INSERT
- Inserir na tabela `commission_rates_clt` com `effective_date = '2026-04-07'`
- As taxas antigas (vigência 2026-03-24) ficam preservadas para auditoria histórica

### Etapa 2 — Atualizar Trigger
- Migration para recriar o trigger `calculate_commission` com suporte a "6 Parcela" e "9 Parcela"

### Etapa 3 — Relatório final
- Consultar todos os registros inseridos e apresentar tabela comparativa confirmando os valores

