## O que será feito

Três frentes independentes, todas com migrations e código testáveis em separado.

---

### Frente 1 — Migration de correção `commission_rates_v2`

Estratégia segura em 3 passos dentro de **uma única migration transacional**:

1. **Backup automático**: cria tabela `commission_rates_clt_v2_backup_20260427` e `commission_rates_fgts_v2_backup_20260427` com cópia integral antes de qualquer mudança (permite reverter em segundos se preciso).
2. **DELETE seletivo das duplicatas** (33 grupos CLT) usando a chave (`bank`, `table_key`, `term_min`, `term_max`, `has_insurance`).
3. **INSERT da linha oficial** com a taxa da planilha.
4. **UPDATE da divergência** PARANA BANCO FGTS (14% → 4%).
5. **INSERT das 31 faltantes** (28 CLT + 3 FGTS).

#### Resoluções de conflito (taxa oficial = planilha)

| Banco / Tabela | Prazo | Seg | Taxa oficial |
|---|---|---|---|
| Banco C6 / — | 18m | Não | 2.2% |
| Banco C6 / — | 24m | Não | 2.5% |
| Banco C6 / — | 36–48m | Não | 2.7% |
| Banco C6 / 4 Parcela | 12m | Sim | 2.2% |
| Banco C6 / 4 Parcela | 18m | Sim | 2.6% |
| Banco C6 / 4 Parcela | 36m | Sim | 3.1% |
| Happy / — | 18m Não / Sim | — | 1.0 / 1.8 |
| Happy / — | 24m Não / Sim | — | 1.4 / 2.25 |
| Happy / — | 36m Não / Sim | — | 2.0 / 3.6 |
| MERCANTIL / — | 0–999m | Sim | 4.5% |
| Prata Digital / — | 6m / 12m / 24–36m | Não | 2.75 / 3.25 / 5.0 |
| Presença Bank / — | 6 / 12 / 24 / 36m | Não | 3.25 / 4.25 / 4.5 / 4.75 |
| V8 Bank / — | 24m / 36m | Não | 3.75 / 4.25 |
| ZiliCred / — | 0–999m | Sim | 2.9% |
| FACTA / — | 6–20m / 24–48m | Não | **3.3 / 3.8** (menor das duas; planilha não tem "FACTA genérico", mantenho conservador) |

#### Faltantes a inserir (CLT)
V8 Bank 6–10 (2.5%), 12–18 (3.0%), 24 (3.75%), 36 (4.25%) — sem seguro, sem table_key.
HUB CLT: SONHO (3.25%), FOCO (2.5%), CARTADA (2.25%) — com table_key.
C6 6/9 todos: 1.5%; 12/18/24/36–48 Normal (sem table_key).
C6 4P/6P/9P 12/18/24/36/48 com seguro (com table_key `4 Parcela`, `6 Parcela`, `9 Parcela`).

#### Faltantes a inserir (FGTS)
- PARANA C/ SEGURO 6.5% (`has_insurance=true`).
- HUB Carta na Manga FGTS faixa R$ 0,01–250 = 20.5%, 251–999.999,99 = 17% (registrar como banco "HUB" + table_key "CARTA NA MANGA" + faixa de valor).

---

### Frente 2 — Performance: filtrar por `contacted_at` em vez de `created_at`

#### Backend
- Criar `get_performance_stats_v2(_date_from, _date_to)` (mantém v1 intacta para não quebrar nada). Diferenças:
  - `total` continua contando todos os leads atribuídos ao vendedor (sem filtro de data — base ativa).
  - `contacted` / `approved` / `pending` filtram por **`contacted_at` BETWEEN _date_from..._date_to**.
  - Mensagens (`msg_stats`) continuam por `created_at` (são imutáveis, faz sentido).
- Criar `get_lead_status_distribution_v2` filtrando por `contacted_at`.
- Manter `get_avg_response_time` como está (já usa contacted_at para o cálculo).

#### Frontend
- `Performance.tsx` chama as `_v2`.
- KPI "Pendentes" passa a significar "leads ainda pendentes hoje", e "Contatados/Aprovados" passa a ser "movidos no período X".

---

### Frente 3 — Performance: filtro personalizado com hora

#### Frontend
- No bloco "Personalizado" (linha 307–333 de `Performance.tsx`), adicionar dois `<Input type="time">` ao lado de cada `Calendar` (defaults `00:00` para início e `23:59` para fim).
- `computeDateRange` aplica essas horas ao `Date` antes de converter para ISO.
- Atalho extra: botão "Última hora" para 1 clique.

---

## Arquivos afetados

- 1 migration nova: `correct_commission_rates_v2_and_performance_v2.sql` (ou duas separadas se preferir)
- `src/pages/admin/Performance.tsx` (filtros + chamadas RPC)
- Sem mudança em V1 nem em telas operacionais

---

## Detalhes técnicos

- Migration em `BEGIN; ... COMMIT;` implícito via Supabase. Backup criado com `CREATE TABLE ... AS SELECT *` (rápido, mesmo schema).
- Para reverter: `TRUNCATE commission_rates_clt_v2; INSERT INTO commission_rates_clt_v2 SELECT * FROM commission_rates_clt_v2_backup_20260427;`.
- RLS dos backups: herda nada — adiciono RLS bloqueado para qualquer não-master, evitando vazamento.
- `get_performance_stats_v2` é SECURITY DEFINER + STABLE (igual à v1).
- Filtro de hora: `customDateFromTime: string` (HH:MM), aplicado com `setHours(parseInt(h), parseInt(m), 0, 0)` antes do `.toISOString()`.

---

## Pontos de atenção que você precisa confirmar

1. **FACTA sem tabela** (6–20m e 24–48m): a planilha não tem "FACTA — genérico". Vou usar 3.3% e 3.8% (menor de cada conflito). Se preferir as maiores, troco.
2. **HUB FGTS Carta na Manga até/acima R$ 250**: vou inserir como `bank='HUB'` + `table_key='CARTA NA MANGA'` + `min_value/max_value` de 0.01–250 e 251–999999.99. Se já existirem entradas HUB diferentes, o INSERT pode duplicar — antes do INSERT faço `DELETE` de qualquer linha HUB+CARTA NA MANGA preexistente para limpar.
3. **"Pendentes" no KPI** com filtro por contato: ficará alto (todos os leads atribuídos sem contato ainda). É isso que você quer? Confirma e sigo.

Posso aplicar tudo?