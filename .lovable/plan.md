
# Diagnóstico das 4 dúvidas + correções propostas

Antes de mexer no código, segue o que descobri olhando banco, cron e edge functions. Depois listo o que precisa virar mudança.

---

## 1) Por que `/admin/audit-logs` quebra com "statement timeout"

**Evidências do banco (agora):**
- `audit_logs`: **121.336 linhas**, **104 MB**, registro mais antigo de **13/abr/2026** (15 dias).
- Cron `cleanup-audit-logs-daily` rodando **03:15 UTC todo dia**, apagando logs com mais de **15 dias** (função `cleanup_audit_logs`). Está ativo e funcionando — só que a janela de 15 dias + o volume gerado pelo V8 (103.500 linhas só de `v8_webhook_consult` em 15 dias = ~6.900/dia) faz a tabela viver pesada.
- Mesmo com `PAGE_SIZE=100`, a query atual ordena por `created_at DESC` sem filtro e o Postgres precisa varrer/ordenar JSON pesado → estoura o `statement_timeout` padrão do PostgREST (8s).

**O que está causando o erro hoje:**
Quando você abre a página sem nenhum filtro, o Supabase tenta `SELECT ... ORDER BY created_at DESC LIMIT 100` num conjunto enorme com `details jsonb` grande. Mesmo havendo índice em `created_at`, o `count(*)` exato (que a UI pede para mostrar "0 de N registros") faz scan completo → timeout.

**O que vou fazer:**
1. **Reduzir retenção de 15 → 5 dias** (sua operação não consulta logs antigos; o V8 sozinho gera 100k em 15 dias).
2. **Trocar a contagem exata por contagem aproximada** (`pg_class.reltuples`) na UI — fim do `count: 'exact'` que está derrubando a query.
3. **Aplicar índice parcial por categoria** (`(details->>'category')`) para os filtros de "WhatsApp / Comissões / Simulador" ficarem instantâneos.
4. **Default do filtro = últimas 24h** ao abrir a página (em vez de "tudo"). O usuário pode expandir manualmente.
5. **Migration de housekeeping imediata** rodando `cleanup_audit_logs` agora (apaga ~80k linhas) + `VACUUM` automático fica por conta do Postgres.

---

## 2) Diferença entre **Consultas** e **Propostas**

Segundo a doc oficial da V8 que você me mandou:

| Aba | Endpoint V8 | O que mostra | Status possíveis |
|---|---|---|---|
| **Consultas** | `/private-consignment/consult` | Verificação de **margem disponível** (Dataprev). É a "olhada" antes de fechar negócio. | `WAITING_CONSENT`, `CONSENT_APPROVED`, `WAITING_CONSULT`, `WAITING_CREDIT_ANALYSIS`, `SUCCESS`, `FAILED`, `REJECTED` |
| **Propostas** (operations) | `/private-consignment/operation` | Contrato/operação **já aberta** (CCB gerada, indo para análise/pagamento). | `generating_ccb`, `formalization`, `analysis`, `manual_analysis`, `awaiting_call`, `processing`, `paid`, `canceled`, `awaiting_cancel`, `pending`, `refunded`, `rejected` |

Em linguagem de operação:
- **Consulta** = "esse CPF tem margem? quanto?" — não compromete cliente, não vira contrato.
- **Proposta** = "vamos efetivar o empréstimo desse CPF" — gera CCB, vai pra pagamento.

**O que vou fazer:** adicionar um banner explicativo curto no topo de cada aba (1 linha) com essa distinção, para qualquer usuário novo entender sem perguntar.

---

## 3) Retry "diz que está rodando" mas tentativas não sobem

**O que descobri rodando os números:**

Configuração atual (`v8_settings`):
- `background_retry_enabled = true` ✅
- `max_auto_retry_attempts = 15`
- `retry_min_backoff_seconds = 10`
- `retry_batch_size = 25`

Cron `v8-retry-cron-every-minute` ativo + 2 sub-passes a cada 20s/40s = **3 varreduras por minuto**.

**Últimas execuções (audit_logs):**
- 12:42:58 → scanned=1, eligible=1, ok=1
- 12:36:17 → scanned=5, eligible=1, ok=1
- Antes disso, buracos de 5–6 minutos.

**Distribuição das simulações nas últimas 48h:**
| status | error_kind | qtd |
|---|---|---|
| failed | `null` | **6.784** ← maior bloco |
| pending | `null` | 2.651 |
| failed | `active_consult` | 152 ← **o caso do ALLAN** |
| pending | `temporary_v8` | 15 |
| failed | `invalid_data` | 5 |

**Por que o número não sobe — 3 motivos somados:**

1. **`active_consult` NÃO é retentável** (e está correto não ser — se a V8 já tem consulta ativa, retentar gera o mesmo erro). O cron pula essas 152 linhas de propósito. Dá impressão de "não está fazendo nada" porque elas dominam o que você vê na tela.
2. **`failed` com `error_kind=null` (6.784 linhas)** — também são puladas hoje. Só `temporary_v8` e `analysis_pending` entram. As demais ficam "encalhadas" sem nunca tentar de novo.
3. **A badge do topo conta como "Auto-retry ativo" qualquer linha retentável de lotes recentes**, mesmo quando o motivo real é `active_consult` que NÃO retenta. Por isso parece travado.

**Tempo entre tentativas (hoje):**
- Backoff mínimo: **10s** entre tentativas da MESMA simulação.
- Cron: a cada 20s (com sub-passes).
- Resultado prático: uma simulação retentável é re-disparada em **10–20s**.

**Posso ir mais rápido?** Sim, mas com cuidado — a V8 tem rate-limit por CPF. Recomendação: deixar 10s mesmo (já é o limite confortável).

**O que vou fazer:**
1. **Renomear o badge** de "Auto-retry: X simulações" para algo honesto: separar em duas linhas — "**X em retry ativo**" (kind retentável) vs "**Y aguardando resposta da V8**" (active_consult / pending sem kind).
2. **Mostrar timestamp da última varredura do cron** ao lado da badge ("última varredura: 14s atrás") — assim você vê na hora se o cron parou.
3. **Adicionar coluna "Próxima tentativa em" no Histórico** para linhas retentáveis, calculando `last_attempt_at + 10s`.
4. **NÃO mexer no backoff** — manter 10s. Mexer só se você quiser depois.

---

## 4) ALLAN RODRIGO DE SOUZA — "Status: SUCCESS" mas linha está `failed`

**Evidência do banco:**
```
status:        failed
error_kind:    active_consult
title:         "Já existe uma consulta ativa para este usuário e número de documento"
error_message: "Já existe consulta ativa para este CPF na V8.
                Consulte as operações existentes ou aguarde a análise em andamento."
attempt_count: 1
```

**O que aconteceu (interpretando):**
- Você tentou simular o ALLAN.
- A V8 respondeu: "esse CPF já tem uma consulta ATIVA aberta lá no nosso sistema" (kind = `active_consult`).
- Nossa simulação foi marcada como `failed` (não conseguimos abrir uma nova).
- O componente `V8StatusSnapshot` foi consultar **a consulta antiga que já existe na V8** para mostrar o que ela diz — e ela está com status `SUCCESS` lá no lado da V8.

**Em outras palavras:** "falha" = nossa simulação não rodou. "Status: SUCCESS" = a consulta antiga (de outra hora ou outro vendedor) que bloqueou a nova já tinha terminado com sucesso na V8.

**O problema real é só o texto:** a UI mistura "status da nossa simulação" com "status da consulta ativa da V8" sem deixar claro que são duas coisas diferentes.

**O que vou fazer:**
1. Trocar o label da seção de `Status: SUCCESS` para `Consulta antiga na V8 — Status: SUCCESS (margem já liberada)`.
2. Adicionar um **botão "Aproveitar consulta existente"** na linha — que carrega os dados da consulta antiga (margem, valor) sem gastar nova tentativa. Hoje a V8 retorna esses dados; só não usamos.
3. Adicionar tooltip no badge `failed` desses casos: "Não conseguimos abrir consulta nova porque a V8 ainda tem uma ativa para este CPF — veja os dados da consulta antiga ao lado."

---

## Resumo do que será implementado (em ordem)

1. **Audit logs** — migration baixando retenção para 5 dias + cleanup imediato + UI com filtro padrão 24h + count aproximado + index por categoria.
2. **V8 Consultas vs Propostas** — banners explicativos em cada aba.
3. **Badge de retry honesto** — separar "em retry" de "aguardando V8" + mostrar última varredura.
4. **Histórico — coluna "Próxima tentativa"** para linhas retentáveis.
5. **ALLAN / active_consult** — renomear "Status: SUCCESS" para algo claro + botão de aproveitar consulta existente + tooltip no badge.

Sem mudanças em backend de retry (backoff fica 10s — mexer mais arrisca rate-limit V8).

---

## Antes vs Depois (resumo final que vai acompanhar a implementação)

| Item | Hoje | Depois |
|---|---|---|
| Audit Logs | Timeout ao abrir, 121k linhas, 104 MB | Abre em <1s, retém 5 dias, filtra 24h por padrão |
| Consultas vs Propostas | Sem explicação, gera dúvida | Banner curto explica em cada aba |
| Badge "Auto-retry: 15 em 13" | Confuso, dá impressão de travado | "X em retry ativo · Y aguardando V8 · varredura há Ns" |
| Linha ALLAN | "falha" + "Status: SUCCESS" misturado | "falha (consulta nova bloqueada)" + dados da consulta antiga + botão "aproveitar" |

Posso seguir com a implementação?
