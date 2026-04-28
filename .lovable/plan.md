
## Comparação: Doc oficial V8 × nossa implementação

### ✅ O que JÁ está correto
- **Endpoints de registro** (`POST /user/webhook/private-consignment/consult` e `/operation`) — idênticos.
- **Body de registro** (`{ "url": "..." }`) — idêntico.
- **Handshake** `webhook.test` → `webhook.registered` — tratado e grava em `v8_webhook_registrations`.
- **Resposta HTTP 2xx** sempre — atendido (responde 200 mesmo em erro para não duplicar).
- **`availableMarginValue`** — capturado e persistido em `v8_simulations.margem_valor`.
- **`type: private.consignment.consult.updated`** — reconhecido (matching por `payload.type` contendo "operation" senão consult).
- **`type: private.consignment.operation.created/updated`** — reconhecido e gravado em `v8_operations_local`.
- **Status `WAITING_CONSENT`, `CONSENT_APPROVED`, `WAITING_CONSULT`, `WAITING_CREDIT_ANALYSIS`, `SUCCESS`, `FAILED`, `REJECTED`** — todos mapeados em `mapV8StatusToInternal`.

### ⚠️ Divergências encontradas (nossa implementação vs. doc oficial)

#### D1 — `CONSENT_APPROVED` mapeado como `success` (BUG)
Hoje `mapV8StatusToInternal` retorna `success` para `CONSENT_APPROVED`. Pela doc oficial, **`CONSENT_APPROVED` é estado intermediário** (consentimento aprovado, ainda aguarda Dataprev). Só `SUCCESS` é estado terminal positivo.

**Impacto real**: o guard atual exige `released_value` + `installment_value` para promover a `success`, então hoje o bug é **mascarado** (CONSENT_APPROVED nunca tem esses campos no webhook → fica bloqueado e cai em "noop"). Mesmo assim a classificação semântica está errada e gera ruído em logs e auditoria.

**Correção**: mapear `CONSENT_APPROVED` como `pending` (etapa intermediária).

#### D2 — Status de operação (proposta) NÃO são reconhecidos como vocabulário oficial
A doc lista 11 status finitos para operações: `generating_ccb, formalization, analysis, manual_analysis, awaiting_call, processing, paid, canceled, awaiting_cancel, pending, refunded, rejected`. Hoje gravamos em `v8_operations_local.status` o valor cru sem validar / sem glossário, e a UI não tem legenda desses estados (o glossário cobre só consulta).

**Correção**: 
- Adicionar constante `V8_OPERATION_STATUSES` no edge function (validação + audit log marca status desconhecido).
- Estender `V8StatusGlossary` com seção "Status de Operação (Proposta)" mostrando os 11 status com tradução leiga.

#### D3 — Campos extras do payload de consulta SUCCESS não são persistidos
A doc detalha que em `SUCCESS` chegam: `availableMarginValue`, `admissionDateMonthsDifference`, `simulationLimit { monthMin, monthMax, installmentsMin, installmentsMax, valueMin, valueMax }`. Hoje só capturamos `availableMarginValue`. O resto fica enterrado em `raw_response` (jsonb) — operador não vê limite mínimo/máximo de prazo e valor da V8.

**Correção**:
- Persistir em colunas dedicadas (migration nova): `admission_months_diff int`, `sim_month_min int`, `sim_month_max int`, `sim_installments_min int`, `sim_installments_max int`, `sim_value_min numeric`, `sim_value_max numeric`.
- Webhook handler popula essas colunas quando vierem.
- UI: mostrar no modal "Ver status na V8" um bloco "Limites V8" (mês mín/máx, parcelas mín/máx, valor mín/máx) — útil para o operador escolher tabela/parcelas dentro do permitido.

#### D4 — Glossário desatualizado
`V8StatusGlossary.tsx` mostra `CONSENT_APPROVED` com "V8 está consultando o averbador" — texto OK, mas não inclui `WAITING_CONSULT` nem `WAITING_CREDIT_ANALYSIS` explicitamente (estão sob "WAITING_*"). A doc oficial detalha cada um.

**Correção**: detalhar cada `WAITING_*` separadamente (consentimento, Dataprev, análise de crédito) em vez de agrupar.

#### D5 — Doc interna `docs/V8-INTEGRATION.md` cita seção 5 "Webhooks (futuro)" e item de roadmap H3.1/H3.2 como "não implementado" — está DESATUALIZADA (já implementamos).

**Correção**: reescrever seção 5 com tabela completa de tipos, payloads e status oficiais; remover H3.1/H3.2 do roadmap.

### ❌ Item da doc que NÃO usamos (intencionalmente — informativo)
A doc mostra um payload "exemplo de falha" com `type: "balance.status.received.success"` — esse é um exemplo confuso da própria doc V8 (parece ser de outro produto, BMS/balance). Não vamos tratar.

---

## Mudanças propostas (5 itens)

### 1. `supabase/functions/v8-webhook/index.ts`
- Trocar `CONSENT_APPROVED` para retornar `"pending"` em `mapV8StatusToInternal` (corrige D1).
- Após o `mapV8StatusToInternal`, extrair `admissionDateMonthsDifference` e `simulationLimit.*` e incluir em `safeUpdates` quando presentes (D3).
- Validar `status` de operação contra lista oficial; se desconhecido, gravar `process_error: "unknown_operation_status: X"` em `v8_webhook_logs` mas ainda fazer upsert (D2 — defensivo).

### 2. Migration nova
```sql
ALTER TABLE v8_simulations
  ADD COLUMN IF NOT EXISTS admission_months_diff int,
  ADD COLUMN IF NOT EXISTS sim_month_min int,
  ADD COLUMN IF NOT EXISTS sim_month_max int,
  ADD COLUMN IF NOT EXISTS sim_installments_min int,
  ADD COLUMN IF NOT EXISTS sim_installments_max int,
  ADD COLUMN IF NOT EXISTS sim_value_min numeric(14,2),
  ADD COLUMN IF NOT EXISTS sim_value_max numeric(14,2);
```

### 3. `src/components/v8/V8StatusGlossary.tsx`
- Detalhar `WAITING_CONSENT`, `CONSENT_APPROVED`, `WAITING_CONSULT`, `WAITING_CREDIT_ANALYSIS` cada um com explicação leiga (D1, D4).
- Adicionar segunda seção "📄 Status de Proposta (Operação V8)" com os 11 status oficiais traduzidos.

### 4. `src/components/v8/V8StatusOnV8Dialog.tsx`
- Acrescentar bloco "Limites de Simulação V8" abaixo do bloco da Margem Disponível, mostrando: prazo (mín–máx meses), parcelas (mín–máx), valor (mín–máx R$). Renderizar só quando houver dados (D3).

### 5. `docs/V8-INTEGRATION.md`
- Reescrever Seção 5 (Webhooks) com:
  - Tabela completa de tipos (`webhook.test`, `webhook.registered`, `private.consignment.consult.updated`, `private.consignment.operation.created`, `private.consignment.operation.updated`).
  - Lista oficial de status de consulta e operação com link para o glossário do app.
  - Quadro "doc oficial vs LordCred" igual ao que já existe para auth.
- Remover/atualizar H3.1 e H3.2 do roadmap (já entregues).
- Atualizar tabela de colunas de `v8_simulations` com os campos novos.

### 6. Testes
- Adicionar caso em `src/lib/__tests__/v8WebhookGuard.test.ts` (ou criar `v8WebhookStatusMap.test.ts`) garantindo:
  - `CONSENT_APPROVED` → `pending` (não `success`).
  - `SUCCESS` → `success`.
  - `REJECTED`/`FAILED` → `failed`.
  - `WAITING_*` → `pending`.

---

## Protocolo de Resposta (será cumprido na implementação)

1. **Antes vs Depois** — incluído.
2. **Melhorias** — UI mostra limites operacionais V8; status oficiais no glossário; semântica correta de CONSENT_APPROVED.
3. **Vantagens/Desvantagens** — vantagens: rastreio fiel à doc oficial, operador vê limites de prazo/valor antes de simular. Desvantagem: migration adiciona 7 colunas (sem breaking change).
4. **Checklist manual** — registrar webhooks novamente; aguardar próxima consulta SUCCESS; verificar colunas no Supabase + bloco no modal.
5. **Pendências** — futuro: validar payload via Zod no edge para falhar cedo em payloads malformados.
6. **Prevenção de regressão** — testes unitários cobrem mapeamento de status; constantes `V8_OPERATION_STATUSES` e `V8_CONSULT_STATUSES` exportadas evitam string mágica.
