
# Plano — Auto-retry V8, status em PT-BR e realtime no Histórico

## Diagnóstico (o que está acontecendo hoje)

Consultei o banco para os 2 CPFs da captura. Conclusões:

**1) Por que um vira `failed` e outro `aguardando V8` para o mesmo erro?**

Para o mesmo lote, mesmo erro de "Limite de requisições excedido":
- CPF `11922952931`: a V8 rejeitou via HTTP imediatamente → `status=failed`, `webhook_status=REJECTED`.
- CPF `98336240144`: a V8 aceitou HTTP 200 mas devolveu o rate limit no webhook depois → `status=pending`, `webhook_status=SUCCESS`.

É **a mesma falha** (rate limit), mas dois caminhos de chegada (HTTP síncrono vs webhook assíncrono) estão criando dois status diferentes na UI. O usuário esperava que ambos fossem tratados igual.

**2) Por que `Tentativas: 1` mesmo com cron rodando há horas?**

- O cron `v8-retry-cron-every-minute` está ativo.
- `v8_settings.max_auto_retry_attempts = 15`, `background_retry_enabled = true`.
- **MAS** o cron tem 2 bugs que travam tudo:
  - **Bug A**: filtra apenas `status='failed'` (linhas em `pending` por rate-limit nunca entram, mesmo "presas" há horas).
  - **Bug B**: nas linhas que conseguiram entrar (`failed`), depois da 1ª retentativa o `raw_response` é sobrescrito **sem o campo `kind`** (banco mostra `raw_kind:NULL` para 8 das 10 linhas). O filtro `RETRIABLE_KINDS.has(kind)` rejeita e a linha nunca mais é processada.

Resultado prático: o cron roda 1.440x por dia mas nunca retenta nada, e o `attempt_count` fica congelado em `1`.

**3) Realtime no Histórico**

`useV8BatchSimulations` (lote expandido) já assina realtime, mas `BatchRetryHeaderButton` (contagem do header) faz apenas um `loadCount` no mount — por isso o número e o estado ficam parados até trocar de aba ou recarregar.

---

## O que vai mudar (3 frentes)

### Frente 1 — Unificar status e destravar o auto-retry

**Edge function `v8-retry-cron`** — duas correções no select:

1. Incluir também simulações `pending` que estão "presas" (sem resposta há mais que `retry_min_backoff_seconds` e classificadas como retentáveis).
2. Persistir `error_kind` numa coluna dedicada (ou usar fallback robusto) para que retentativas seguintes saibam que ainda é "rate limit" mesmo se `raw_response.kind` vier vazio. Já existe a coluna `error_kind` em `v8_simulations` (vista no `useV8Batches.ts` linha 71) — só precisamos passar a gravar e filtrar por ela.

```text
ANTES (cron)                               DEPOIS (cron)
────────────────────────────────────────   ─────────────────────────────────────────
.eq("status", "failed")                    .in("status", ["failed","pending"])
+ filtro por raw_response.kind             + filtro por error_kind (coluna)
                                             OR raw_response.kind como fallback
                                           + para pending: AND last_attempt_at < now()-backoff
```

**Edge function `v8-clt-api`** — quando criar/atualizar uma simulação com erro classificado, gravar `error_kind` na coluna (não só dentro do JSON). Isso resolve o Bug B definitivamente.

**Migração SQL** — backfill: para linhas existentes em `failed/pending` com `raw_response->>kind` preenchido, copiar para `error_kind` (uma vez só):
```sql
UPDATE v8_simulations
SET error_kind = raw_response->>'kind'
WHERE error_kind IS NULL
  AND raw_response->>'kind' IS NOT NULL
  AND status IN ('failed','pending');
```

### Frente 2 — Tradução PT-BR dos status

Hoje os badges mostram `success`, `failed`, `pending`, `processing`, `completed` direto do banco. Vou criar um helper `translateV8Status(status)` em `src/lib/v8ErrorPresentation.ts`:

| Status banco | Label PT-BR (badge) |
|---|---|
| `success` | sucesso |
| `failed` | falha |
| `pending` | aguardando V8 |
| `processing` | processando |
| `completed` | concluído |
| `cancelled` | cancelado |

Aplicar em:
- `V8HistoricoTab.tsx` linha 153 (badge da linha) e linha 224 (badge do lote).
- `V8NovaSimulacaoTab.tsx` (já usa `getSimulationStatusLabel` que tem alguns rótulos PT, mas o fallback `return simulation.status` ainda devolve cru — passa pelo helper).
- `V8ConsultasTab.tsx` se houver badge similar (verificar).

A função `getSimulationStatusLabel` já existente (V8NovaSimulacaoTab.tsx linha 30) será mantida porque ela traduz pelo *kind do erro* (mais rica). Apenas o fallback final passa a chamar `translateV8Status`.

### Frente 3 — Realtime na contagem do botão "Retentar (N)"

`BatchRetryHeaderButton` em `V8HistoricoTab.tsx`: trocar o `useEffect` que só faz `loadCount` no mount por uma assinatura realtime filtrada por `batch_id`, recarregando a contagem a cada UPDATE/INSERT em `v8_simulations`. Padrão idêntico ao já usado em `useV8BatchSimulations` (linha 102-109).

Isso elimina a necessidade de "trocar de janela ou atualizar" — número, status, motivo e tentativas vão atualizando sozinhos enquanto o cron processa.

Bônus pequeno: dentro de `BatchDetail` a tabela já é realtime (via `useV8BatchSimulations`), então as colunas Status / Motivo / Tentativas vão atualizar automaticamente assim que o cron rodar.

---

## Antes vs Depois (resumo)

```text
ANTES                                          DEPOIS
─────────────────────────────────────          ─────────────────────────────
Mesmo erro (rate limit) gera 2 status:         Ambos tratados como retentáveis.
  - 11922952931 → failed                       Ambos voltam ao cron até esgotar
  - 98336240144 → pending (preso)              as 15 tentativas.

Status no badge: "failed", "pending"           Status no badge: "falha",
                                               "aguardando V8" etc. (PT-BR)

Tentativas: 1 (travado há horas)               Tentativas: 1 → 2 → 3 → ... → 15
                                               (cron faz a cada 1 min,
                                               respeitando backoff de 10s+)

Precisa atualizar a página para ver            Atualiza sozinho via realtime
mudança no Motivo / Status / Tentativas        (header e tabela do lote).

Botão "Retentar (N)" só conta no carregar      Contagem realtime; some quando
                                               todas forem reprocessadas.
```

---

## Arquivos afetados

- `supabase/functions/v8-retry-cron/index.ts` — incluir `pending` no select; usar coluna `error_kind` no filtro.
- `supabase/functions/v8-clt-api/index.ts` — gravar `error_kind` ao registrar erro classificado (verificar se já é gravado; se não, adicionar).
- `src/lib/v8ErrorPresentation.ts` — novo helper `translateV8Status`.
- `src/components/v8/V8HistoricoTab.tsx` — usar `translateV8Status` nos badges; adicionar realtime no `BatchRetryHeaderButton`.
- `src/components/v8/V8NovaSimulacaoTab.tsx` — fallback do `getSimulationStatusLabel` chama `translateV8Status`.
- Migração SQL — backfill de `error_kind` para linhas existentes.

---

## Vantagens / Desvantagens

**Vantagens**
- Sem mais "1 tentativa para sempre" — auto-retry de fato roda até as 15.
- Comportamento previsível: rate limit é rate limit, não importa como chegou.
- UI atualiza ao vivo, sem refresh.
- Tradução melhora a clareza para o vendedor.

**Desvantagens / risco**
- O cron passa a tocar mais linhas por execução (incluindo `pending` antigos). Mitigado por `retry_batch_size=25` e backoff já existentes — sem risco de avalanche.
- Se a V8 estiver fora do ar prolongado, as 15 tentativas serão queimadas mais rápido. Mitigação: backoff exponencial já configurado (10s → 120s).

---

## Checklist manual

1. Em `/admin/v8-simulador` → **Histórico**, expandir o lote da captura. Confirmar que ambos os CPFs do exemplo (98336240144 e 11922952931) começam a incrementar `Tentativas` automaticamente nos próximos 1–2 minutos.
2. Confirmar que os badges mostram **"falha" / "aguardando V8" / "sucesso"** em vez de inglês.
3. Sem trocar de aba: ver `Tentativas` ir de 1 → 2 → 3 ... e o `Motivo` atualizando sem refresh.
4. Quando uma simulação enfim suceder, ver o badge mudar para **"sucesso"** sozinho.
5. Botão **"Retentar (N)"** no header: ver o contador diminuir em tempo real conforme o cron processa.
6. Em `/admin/v8-simulador` → **Configurações**, confirmar que `max_auto_retry_attempts=15` continua respeitado (linha não passa de 15).

## Pendências
- (Futuro, não agora) Adicionar coluna na tabela mostrando "próxima tentativa em ~Xs" — útil mas exige timer no front.
- (Futuro) Possível "modo agressivo" que reduz backoff quando o operador está olhando a tela.

## Prevenção de regressão
- Adicionar teste em `src/lib/__tests__/v8ErrorPresentation.test.ts` (criar) cobrindo `translateV8Status` para todos os status do enum.
- Adicionar teste em `src/lib/__tests__/v8ErrorClassification.test.ts` cobrindo o critério novo "pending preso retentável".
- Comentário em `v8-retry-cron/index.ts` documentando por que `pending` precisa entrar no select (rate limit assíncrono via webhook).
