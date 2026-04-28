# V8 Simulador — Etapa 2: Realtime, Auto-retry e Notificações

> Atualizado: 2026-04-28 · Documenta as decisões de arquitetura tomadas na
> Etapa 2 (estabilização do auto-retry e visibilidade em tempo real).

Este arquivo complementa `docs/V8-INTEGRATION.md` cobrindo **somente** os
mecanismos de retry automático, polling e indicadores em tempo real do
`/admin/v8-simulador`.

---

## 1. Limite do `pg_cron` (1 min)

O `pg_cron` do Supabase aceita no máximo **1 execução por minuto** (sintaxe
crontab padrão `* * * * *`). Para o V8 isso é insuficiente — durante os primeiros
60s após criar um lote, várias linhas podem terminar em `pending` por rate-limit
da V8 e ficar 1 minuto inteiro paradas até o próximo tick do cron.

### Workaround: 3 sub-passes a cada 20s

Quando o `v8-retry-cron` é disparado pelo `pg_cron`:

1. Executa a 1ª passada imediatamente.
2. Antes de retornar, agenda 2 disparos extras via `setTimeout(20s)` e
   `setTimeout(40s)`, chamando ele mesmo via HTTP com `sub_pass=1` e `sub_pass=2`.
3. Resultado: dentro de 1 minuto rodam 3 ciclos de retry (0s, 20s, 40s) — efetivamente
   convertendo o cron de 1 min em uma cadência de 20s.

```ts
// supabase/functions/v8-retry-cron/index.ts (resumo)
if (!manualMode && subPass === 0) {
  for (const delaySec of [20, 40]) {
    setTimeout(() => {
      fetch(`${supabaseUrl}/functions/v1/v8-retry-cron`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({ sub_pass: delaySec === 20 ? 1 : 2 }),
      });
    }, delaySec * 1000);
  }
}
```

### Kick-start ao criar lote

Para não esperar o próximo tick do cron, `v8-clt-api/create_batch` agenda 3
chamadas extras ao `v8-retry-cron` em `30s`, `60s` e `90s` via
`EdgeRuntime.waitUntil`. Assim a 1ª retentativa acontece em ~30s — 2x mais
rápido que o cron sozinho.

---

## 2. Poller de "consulta ativa" (`v8-active-consult-poller`)

Quando a V8 retorna `active_consult` (CPF já tem consulta em andamento),
não conseguimos disparar nova simulação — só consultar status. Esse poller
roda a cada 1 min via `pg_cron` e:

1. Busca todas as `v8_simulations` com `error_kind='active_consult'` e
   `v8_status_snapshot_at` antigo (ou nulo).
2. Para cada CPF, chama `check_consult_status` na V8.
3. Salva o snapshot (status atual: `REJECTED`, `CONSENT_APPROVED`, etc.) em
   `raw_response.v8_status_snapshot` + atualiza `v8_status_snapshot_at`.

A UI (`V8HistoricoTab` e `V8NovaSimulacaoTab`) lê esse snapshot e renderiza
inline, sem precisar abrir modal. Realtime no `v8_simulations` faz o status
aparecer automaticamente em ~1 min.

---

## 3. `error_kind='analysis_pending'` por padrão

Toda nova linha em `v8_simulations` é criada com
`error_kind='analysis_pending'` em `v8-clt-api.actionCreateBatch`. Isso garante
que, mesmo que a 1ª chamada `simulate_one` jamais rode (browser fechado,
timeout de rede, refresh), o cron já considera a linha elegível para retry —
ela não fica "órfã" no banco.

Quando o webhook chega com sucesso real, `error_kind` é sobrescrito para
`null` (sucesso) ou para o kind correto (`active_consult`, `existing_proposal`,
`invalid_data`, `temporary_v8`, etc.).

---

## 4. Indicadores de UI em tempo real

| Componente | Onde | Função |
|---|---|---|
| `V8RealtimeStatusBar` | topo de `/admin/v8-simulador` | Conexão WS (🟢 live / 🟡 polling 10s / 🔴 offline) + agregado "Auto-retry: X simulações em N lotes" |
| `AutoRetryIndicator` | dentro de cada lote | Banner amarelo enquanto há linhas elegíveis para retry |
| `RealtimeFreshness` | dentro de cada lote | "atualizado há Xs" — confirma que o WS está vivo |
| `AnimatedCountBadge` | header de cada lote no Histórico | Pulsa quando `success_count`/`failure_count` muda em tempo real |
| Snapshot inline | coluna "Motivo" | Mostra `Status: REJECTED/CONSENT_APPROVED` direto na tabela, sem modal |

### Fallback de polling

`V8RealtimeStatusBar` observa o status do canal Supabase Realtime. Se cair
(`CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED`), inicia automaticamente um
`setInterval(10_000)` que recarrega o agregado — usuário não fica sem dados.
Quando o WS reconecta (`SUBSCRIBED`), o polling é desligado.

---

## 5. Notificação sonora opcional

Configurável em **Configurações > Auto-retry > "Tocar som ao concluir lote"**
(coluna `v8_settings.sound_on_complete`).

Implementação em `src/lib/v8Sound.ts`:

- Usa **Web Audio API** (sem assets de áudio).
- Beep duplo "✓✓" (880Hz → 1320Hz) para sucesso; "↘↘" (440Hz → 330Hz) para falha.
- Disparado por `V8RealtimeStatusBar` quando detecta transição
  `status != 'completed' → 'completed'` em qualquer `v8_batches`.
- Falhas silenciosas (browser bloqueou autoplay, etc.) — nunca quebra a UI.

---

## 6. Checklist de prevenção de regressão

- [ ] `v8-retry-cron` deve sempre agendar `sub_pass=1` e `sub_pass=2` na execução
      principal (cron). Manual = só roda 1 passada.
- [ ] `actionCreateBatch` em `v8-clt-api` deve sempre setar
      `error_kind='analysis_pending'` na inserção inicial.
- [ ] `v8-active-consult-poller` precisa estar registrado no `pg_cron`
      (`v8-active-consult-poller-every-min`).
- [ ] `v8_simulations` e `v8_batches` devem estar na publicação
      `supabase_realtime` com `REPLICA IDENTITY FULL`.
- [ ] `V8RealtimeStatusBar` precisa estar montado em
      `src/pages/admin/V8Simulador.tsx`.

