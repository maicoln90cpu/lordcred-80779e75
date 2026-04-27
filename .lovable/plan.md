## Resposta às 2 perguntas

### 1) Comissões V2 — divergências NÃO foram zeradas
Você está certo. A migration anterior corrigiu parte, mas deixou 21 problemas estruturais. O relatório atualizado está em `comissoes-v2-divergencias-v2.xlsx` (anexo acima).

**Resumo dos buracos encontrados:**

| Item | Planilha | DB hoje | Problema |
|---|---|---|---|
| LOTUS FGTS | 13 linhas | 4 | Faltam 9 variantes (1R+/2R+/3R+/4R+, "Com Seguro" 1+/2+/3+/4+, SEM TAC) |
| PARANA FGTS | 2 linhas | 11 | Foi explodido em 11 linhas (1 por prazo) — a planilha quer só 2 (sem seguro 4%, com seguro 6.5%) |
| HUB FGTS | 8 linhas | 9 | 4 linhas legadas "Faixa R$ 500/1000/2000/+" precisam sair |
| FACTA CLT | 10 linhas | 2 | Faltam NOVO GOLD 2/3/4 (12-18, 24, 35-48) e NOVO SMART |
| Banco C6 CLT | 21 linhas | 40 | 11 grupos têm 2 linhas duplicadas idênticas |
| HUB CLT | 3 linhas | 9 | Banco gravado com 2 nomes diferentes ("HUB" e "Hub Credito") — trigger confunde |
| Happy/Qualibank/ZiliCred | — | — | Sobram 4 linhas extras |

### 2) Performance — está correto ✅
Verifiquei a RPC `get_performance_stats_v2` (usada na linha 161 de `Performance.tsx`):
- **Contatado**: filtra por `contacted_at` (momento em que o lead saiu de pendente) ✅
- **Aprovado**: filtra por `contacted_at` E `status=APROVADO` ✅
- **Pendente** e **Total**: filtram por `created_at` (intencional — pendente nunca tem `contacted_at`)

Conclusão: a página de Performance já filtra pelo momento em que o vendedor chamou o cliente. Nenhuma alteração necessária aqui.

---

## Plano de correção (Comissões V2)

Vou rodar **uma única migration idempotente** com 4 etapas, com backup antes:

### Etapa 1 — Backup
```sql
CREATE TABLE commission_rates_fgts_v2_backup_20260427b AS SELECT * FROM commission_rates_fgts_v2;
CREATE TABLE commission_rates_clt_v2_backup_20260427b AS SELECT * FROM commission_rates_clt_v2;
```

### Etapa 2 — FGTS
- **PARANA BANCO**: `DELETE` das 11 linhas → `INSERT` 2 linhas oficiais (term 0-999, sem/com seguro)
- **HUB CARTA NA MANGA**: `DELETE` das 4 linhas legadas (termos 1-5 com faixa R$ 500/1000/2000)
- **LOTUS**: `INSERT` 9 variantes faltantes (1R+, 2R+, 3R+, 4R+, 1+/2+/3+/4+ Com Seguro, SEM TAC)

### Etapa 3 — CLT
- **HUB ↔ Hub Credito**: `UPDATE bank='HUB'` em tudo + `DELETE` duplicatas (manter `MIN(id)` por grupo)
- **Banco C6**: `DELETE` duplicatas via CTE `ROW_NUMBER() OVER (PARTITION BY bank, table_key, term_min, term_max, has_insurance ORDER BY id) > 1`
- **FACTA**: `INSERT` 10 linhas (NOVO GOLD 2/3/4 nas 3 faixas + NOVO SMART)
- **Happy/Qualibank/ZiliCred**: `DELETE` duplicatas via mesma CTE

### Etapa 4 — Validação automática
Query final que retorna a contagem por banco (igual à da auditoria) para confirmar que bate com a planilha (FGTS=31, CLT=66).

---

## Perguntas antes de executar

1. **PARANA BANCO**: confirmo o achatamento para 2 linhas únicas (perdendo a granularidade por prazo que está hoje)?
2. **HUB → Hub Credito**: vou consolidar tudo em **"HUB"** (nome único). OK?
3. **Banco C6 duplicatas**: posso usar critério `MIN(id)` para escolher qual manter? (o rate é idêntico nas 11 duplicatas, então não há perda)

## Vantagens / Desvantagens

**Vantagens:**
- Trigger `calculate_commission_v2` passa a achar a taxa correta sem ambiguidade
- Bate 100% com a planilha-fonte (31 FGTS + 66 CLT)
- Backup permite rollback total em 1 comando

**Desvantagens:**
- Vendas V2 já calculadas com taxa antiga não são recalculadas automaticamente (precisaria rodar UPDATE depois — posso incluir se quiser)

## Checklist manual após aplicar
1. Abrir `/admin/commissions-v2` → aba Taxas FGTS → filtrar LOTUS → ver 13 linhas
2. Filtrar PARANA → ver 2 linhas (4% e 6.5%)
3. Aba Taxas CLT → filtrar Banco C6 → ver 21 linhas (sem duplicatas)
4. Filtrar HUB → ver 3 linhas (Sonho/Foco/Cartada) e zero "Hub Credito"
5. Filtrar FACTA → ver 10 linhas

## Pendências futuras (não-bloqueantes)
- Recalcular vendas V2 já lançadas com taxa antiga (rodar gatilho de UPDATE)
- Adicionar UNIQUE INDEX em `(bank, table_key, term_min, term_max, has_insurance, min_value, max_value, effective_date)` para impedir duplicatas no futuro

## Prevenção de regressão
- Backup automático em `_backup_20260427b` antes de qualquer mudança
- Query de validação por banco no final da migration
- Sugiro adicionar UNIQUE INDEX (item da pendência) para prevenir duplicatas futuras

**Aprova o plano com as 3 confirmações acima? Posso já incluir a UNIQUE INDEX e o recalculo das vendas V2 no mesmo pacote, se quiser.**