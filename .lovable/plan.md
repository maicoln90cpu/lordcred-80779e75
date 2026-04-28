
# Plano — Auditoria completa dos payloads V8

## Objetivo (em linguagem leiga)
Hoje a tela de **Logs de Auditoria** registra apenas **resumos** dos eventos da V8 (CPF mascarado, status, kind, total). Quando algo dá errado — ou quando você quer entender exatamente o que a V8 devolveu — você precisa abrir o modal "Status na V8" ou ir direto na tabela `v8_webhook_logs` para ver o JSON cru.

A meta deste plano é garantir que **todo evento V8** (chamadas que saem daqui pra V8 + webhooks que a V8 manda pra cá + ciclos automáticos do poller e do retry-cron) deixe um registro em `audit_logs` com **o payload completo de request e response**, sem truncar e sem perder nenhum campo.

---

## Diagnóstico do que existe hoje

### O que JÁ é auditado
| Origem | Ação | O que grava |
|---|---|---|
| `v8-clt-api` `simulate_one` | `v8_simulate_one` | Resumo + `data` + `raw` (parcial) |
| `v8-clt-api` `get_configs` | `v8_get_configs` | Lista completa |
| `v8-clt-api` `create_batch` | `v8_create_batch` | Resumo (sem rows) |
| `v8-clt-api` `register_webhooks` | `v8_register_webhooks` | Response completo |
| `v8-clt-api` `list_operations` / `list_consults` / `get_operation` / `check_consult_status` | sim, mas só **sumário** (sem `data`, sem `raw`) |
| `v8-webhook` (eventos reais) | `v8_webhook_<eventType>` | Resumo + `payload_keys` (não o payload!) |

### O que NÃO é auditado
| Origem | Problema |
|---|---|
| `v8-active-consult-poller` | **Zero** chamadas a `writeAuditLog`. Snapshot vai só pra `v8_simulations.raw_response` |
| `v8-retry-cron` | **Zero** auditoria — só atualiza linhas |
| `v8-clt-api` `list_batches` | Sem auditoria |
| `v8-clt-api` `get_webhook_status` | Sem auditoria |
| Webhook V8 | Payload completo só em `v8_webhook_logs.payload` (JSON, sem ligação clara com `audit_logs`) |
| `simulate_one` | `request_payload` é **reconstruído** com placeholder `<consult_id>`. O body real enviado pra V8 (consult, authorize, simulate, status) **não é capturado** |

---

## O que vai mudar

### 1. Helper compartilhado para "payload completo"
Criar `supabase/functions/_shared/v8AuditPayload.ts` com helper `truncateForAudit(value, maxBytes)` que:
- Serializa o JSON.
- Se exceder ~256KB (limite seguro pra coluna `jsonb`), guarda os primeiros 250KB em `details.payload_truncated_preview` e marca `details.payload_truncated = true` + `details.payload_full_size_bytes = N`.
- Senão, grava `details.payload_full = <objeto>`.

Isso garante que payloads gigantes da V8 (operação completa com 60 parcelas) não estourem `audit_logs` mas continuem rastreáveis.

### 2. `v8-clt-api` — capturar request/response brutos
Para **toda chamada `v8Fetch()`** (consult, authorize, simulate, status, list_consults, list_operations, get_operation):
- Guardar em variáveis locais o `body` enviado, o `status HTTP`, e o **JSON cru** retornado.
- Anexar em `details.v8_http_calls = [{ step, url, method, request_body, http_status, response_body, duration_ms }, ...]`.

Isso é o ganho principal: hoje o operador vê "kind=active_consult", mas não vê o JSON exato que a V8 mandou. Com isso, vê.

### 3. Adicionar auditoria nas ações que faltam
- `list_batches` → `v8_list_batches` (com `count` + `data` truncado).
- `get_webhook_status` → `v8_get_webhook_status` (com registrations + last_log).

### 4. `v8-active-consult-poller` — auditar cada ciclo
Adicionar 1 entrada por ciclo:
- `action: "v8_poller_cycle"`, `category: "simulator"`.
- `details`: `{ scanned, updated, not_found, rate_limited, failed, manual, simulation_ids: [...], v8_http_calls: [...] }`.

E 1 entrada por simulação atualizada quando o snapshot muda de status (com `payload_full = json.data`).

### 5. `v8-retry-cron` — auditar cada execução
Adicionar 1 entrada por ciclo:
- `action: "v8_retry_cron_cycle"`.
- `details`: `{ trigger_source, batch_id, total_eligible, retried, skipped_cooloff, max_attempts_reached, results: [{ simulation_id, attempt, kind, success }] }`.

### 6. `v8-webhook` — gravar payload bruto no audit
Hoje o webhook grava `payload_keys`. Vai passar a gravar o **payload completo** (com truncamento) e os `headers seguros` (sem auth).

### 7. Promover ações `list_*` a auditoria completa
Em `list_operations`, `list_consults`, `get_operation`, `check_consult_status` — passar a incluir `payload_full = result.data` (com truncamento).

### 8. Tela de Logs de Auditoria (frontend)
- Ajustar `JsonTreeView` para destacar visualmente blocos `payload_full`, `v8_http_calls`, `payload_truncated_preview`.
- Adicionar **filtro rápido por categoria "simulator"** + filtro por sub-ação (`v8_simulate_one`, `v8_webhook_*`, `v8_poller_cycle`, `v8_retry_cron_cycle`).
- Botão **"Copiar payload completo"** no modal de detalhe (já existe parcialmente, validar que cobre `payload_full` e `v8_http_calls`).

### 9. Documentação
Anexar seção em `docs/V8-INTEGRATION.md`:
- Tabela com cada ação V8 e o que aparece no audit.
- Como filtrar / interpretar `v8_http_calls`.
- Política de truncamento (250KB).

---

## Detalhes técnicos

**Arquivos a criar**
- `supabase/functions/_shared/v8AuditPayload.ts` — helper de truncamento.

**Arquivos a editar**
- `supabase/functions/v8-clt-api/index.ts` — capturar request/response em todas as `v8Fetch`; adicionar auditoria em `list_batches`, `get_webhook_status`; expandir `details` de `simulate_one`, `list_operations`, `list_consults`, `get_operation`, `check_consult_status` com `payload_full`.
- `supabase/functions/v8-webhook/index.ts` — incluir `payload_full` (com truncamento) e `headers_safe` no audit.
- `supabase/functions/v8-active-consult-poller/index.ts` — adicionar `writeAuditLog` por ciclo + por simulação atualizada.
- `supabase/functions/v8-retry-cron/index.ts` — adicionar `writeAuditLog` por ciclo + por tentativa.
- `src/components/audit/JsonTreeView.tsx` (ou equivalente) — destaque visual para blocos especiais.
- `src/pages/admin/AuditLogs.tsx` (ou equivalente) — filtro por sub-ação.
- `docs/V8-INTEGRATION.md` — seção "Auditoria de payloads".

**Sem migrações** — tudo cabe nas colunas existentes de `audit_logs.details (jsonb)`. O índice já existe (`audit_logs_action_idx`).

---

## Antes vs Depois (preview)

**Hoje** (audit `v8_simulate_one`):
```
{ category: "simulator", success: false, kind: "active_consult",
  step: "consult_status", cpf_masked: "***1234", error: "..." }
```

**Depois**:
```
{ category: "simulator", success: false, kind: "active_consult", step: "consult_status",
  cpf_masked: "***1234",
  v8_http_calls: [
    { step: "consult", method: "POST", url: ".../private-consignment/consult",
      request_body: { documentNumber: "***", ... }, http_status: 201, response_body: {...}, duration_ms: 412 },
    { step: "consult_status", method: "GET", url: ".../consult?...", http_status: 200,
      response_body: { ..., availableMarginValue: 1234.56, ... }, duration_ms: 280 }
  ],
  payload_full: { ...resultado completo... }
}
```

---

## Vantagens
- Diagnóstico de falhas V8 sem precisar abrir modal nem inspecionar `v8_simulations.raw_response` no SQL Editor.
- Replay confiável: dá pra reproduzir qualquer chamada porque o request bruto está salvo.
- Suporte a auditoria regulatória/compliance — um único lugar (`audit_logs`) tem 100% do histórico V8.

## Desvantagens
- `audit_logs` cresce mais rápido (estimativa: +30% a +60% de tamanho por linha V8). Mitigação: a política `cleanup_audit_logs` já remove > 15 dias.
- Pequeno overhead (5–15ms) por chamada para serializar e medir.

## Checklist manual (após implementação)
1. Rodar uma simulação CLT em `/admin/v8-simulador` → abrir `/admin/audit-logs` → filtrar por `v8_simulate_one` → expandir → confirmar que `v8_http_calls` aparece com request e response brutos.
2. Esperar 1 minuto → confirmar entrada `v8_poller_cycle` e `v8_retry_cron_cycle`.
3. Forçar uma falha (CPF inválido) → conferir que `payload_full` traz a resposta de erro completa da V8.
4. Disparar manualmente `register_webhooks` → confirmar audit com response completo.
5. Conferir que payload > 250KB aparece como `payload_truncated_preview` + tamanho informado.

## Pendências (futuro, não agora)
- Página dedicada **"Auditoria V8"** com timeline visual por CPF.
- Botão "Replay" que reenvia o `request_body` salvo (útil em incidentes).
- Exportar em CSV/JSON o histórico V8 filtrado.

## Prevenção de regressão
- Adicionar teste Vitest em `src/lib/__tests__/v8AuditPayload.test.ts` cobrindo: payload pequeno passa intacto, payload grande é truncado com aviso, payload nulo não quebra.
- Adicionar teste Deno em `supabase/functions/v8-clt-api/audit_test.ts` validando que `v8_http_calls` é preenchido em todas as ações principais.
- Comentário no topo de `auditLog.ts` reforçando: "qualquer nova ação V8 deve gravar `request_payload` + `response_payload` completos".
