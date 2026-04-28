# Plano — Ajustes UX no Simulador V8 CLT

Três correções pequenas e cirúrgicas em `V8HistoricoTab.tsx` e `V8NovaSimulacaoTab.tsx`. Nenhuma migração de banco; tudo é frontend.

---

## 1) Histórico: botão "Retentar" não aparece em lotes "processing"

**Antes:** O `BatchRetryHeaderButton` só conta linhas com `status='failed'` e `kind` retentável. No lote da captura (`processing • 0/5 ok`), 4 das 5 linhas estão `pending` (V8 retornou rate-limit mas a simulação ficou em pending aguardando webhook), e apenas 1 está `failed`. Resultado: o botão some ou aparece com "(1)" quando o usuário esperaria "(5)".

**Depois:** Considerar também `pending` cujo `raw_response` traga um `kind` retentável (`temporary_v8` / `analysis_pending`) **e** que tenham `last_attempt_at` há mais de ~1 minuto (evita retentar enquanto a 1ª tentativa ainda está em voo). Mesma regra aplicada no painel interno (`BatchDetail`) e no botão "Retentar falhados" da Nova Simulação para consistência.

**Arquivos:**
- `src/components/v8/V8HistoricoTab.tsx` — função `loadCount` em `BatchRetryHeaderButton` e filtro `failedRetriable` em `BatchDetail`.
- `src/components/v8/V8NovaSimulacaoTab.tsx` — `handleRetryFailed` e `runAutoRetryLoop` (alinhar critério para `pending` antigo).

---

## 2) Mensagens de erro repetidas na coluna "Motivo / payload"

**Antes (exemplo da captura):**
```
Limite de requisições excedido, tente novamente mais tarde
Erro inesperado na V8
A V8 está com instabilidade ou rate limit. Aguarde 1–2 minutos e use "Retentar"...

A V8 está com instabilidade ou rate limit. Aguarde 1–2 minutos e use "Retentar"...
etapa: consult_status • tipo: temporary_v8

A V8 está com instabilidade ou rate limit. Aguarde 1–2 minutos e use "Retentar"...
```
A mesma frase de orientação aparece 3 vezes (headline + secondary + guidance) porque cada tentativa empilha o mesmo texto no `error_message` e os helpers `getV8ErrorHeadline` / `Secondary` / `Meta.guidance` extraem campos sobrepostos.

**Depois:** Mostrar **apenas a mensagem principal** + linha discreta "etapa • tipo" quando útil. Lógica:
1. Headline = primeira frase não-vazia de `title / detail / message / error` (já existe).
2. Remover renderização de `secondary` e `guidance` no histórico e na nova simulação.
3. Deduplicar headline: se a mensagem foi concatenada N vezes (mesma string repetida com `\n`), exibir só a primeira ocorrência.
4. Manter a linha pequena `etapa: X • tipo: Y` (já é compacta e ajuda no diagnóstico).

Implementação: nova função `getV8ErrorMessageDeduped(rawResponse, errorMessage)` em `src/lib/v8ErrorPresentation.ts` que retorna uma string limpa única.

**Arquivos:**
- `src/lib/v8ErrorPresentation.ts` — nova helper `dedupeLines(text)` + `getV8ErrorMessageDeduped`.
- `src/components/v8/V8HistoricoTab.tsx` (linhas 154-175) — usar a helper, remover blocos `Secondary` e `guidance`.
- `src/components/v8/V8NovaSimulacaoTab.tsx` (linhas 670-740) — mesma simplificação.

---

## 3) Remover "Ver payload bruto" da Nova Simulação e do Histórico

**Antes:** Cada linha mostra um `<details>` "Ver payload bruto" com JSON completo da V8 (visível em image-463). Usuário final não precisa disso.

**Depois:** Remover o bloco `<details>` em ambas as abas. O JSON continua salvo em `v8_simulations.raw_response` e acessível em `/admin/audit-logs` (auditoria) e via SQL — que é o que o usuário pediu.

**Arquivos:**
- `src/components/v8/V8HistoricoTab.tsx` (linhas 176-185) — remover `<details>`.
- `src/components/v8/V8NovaSimulacaoTab.tsx` (linhas 738-748) — remover `<details>`.
- `src/lib/v8ErrorPresentation.ts` — manter `stringifyV8Payload` (ainda usado em logs); apenas parar de chamá-la na UI.

A coluna passa a se chamar **"Motivo"** (era "Motivo / payload").

---

## Antes vs Depois (resumo visual)

```text
ANTES                                          DEPOIS
─────────────────────────────────────          ─────────────────────────────
Status: pending  [sem botão Retentar]          Status: pending  [Retentar (5)]
Motivo / payload:                              Motivo:
  Limite de requisições excedido...              Limite de requisições excedido,
  Erro inesperado na V8                          tente novamente mais tarde
  A V8 está com instabilidade...                 etapa: consult_status • tipo: temporary_v8
  A V8 está com instabilidade...
  etapa: consult_status • tipo: temporary_v8
  A V8 está com instabilidade...
  ▸ Ver payload bruto
```

---

## Vantagens / Desvantagens

**Vantagens:** Interface mais limpa para o vendedor; retentativa funciona para os casos reais (rate limit que ficou em pending); menos exposição de detalhe técnico; uma única fonte de verdade para o JSON (auditoria).

**Desvantagens / risco:** Se o usuário precisava ver o JSON para suporte, agora terá que ir em /admin/audit-logs. Mitigação: o admin já tem acesso lá, e a info essencial (etapa, tipo, mensagem) continua na linha.

---

## Checklist manual de validação

1. Em `/admin/v8-simulador` → Histórico, expandir um lote com falhas `temporary_v8` e confirmar que o botão **Retentar (N)** aparece no header com a contagem certa (incluindo pending antigo).
2. Confirmar que a coluna "Motivo" mostra **uma única linha principal** + linha pequena `etapa • tipo` (sem repetições).
3. Confirmar que **não há mais** botão `▸ Ver payload bruto` em Histórico nem em Nova Simulação.
4. Em `/admin/audit-logs`, confirmar que o JSON bruto continua acessível para um admin.
5. Disparar uma simulação que falhe (CPF inválido) e ver se a mensagem agora é curta e única.

## Pendências
- Nada bloqueante. Eventual próximo passo: botão "Copiar payload" dentro de /admin/audit-logs para suporte (não solicitado agora).

## Prevenção de regressão
- Adicionar teste em `src/lib/__tests__/` para `getV8ErrorMessageDeduped` cobrindo (a) string repetida 3x, (b) string única, (c) raw_response vazio.
- Adicionar teste para o filtro de retentável que inclua status `pending` com kind retentável.
