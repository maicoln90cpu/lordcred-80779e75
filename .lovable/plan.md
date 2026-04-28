# Plano — V8 Simulador: auto-retry contínuo, realtime no Motivo e UX coerente

## Respostas diretas (perguntas 1, 2, 4, 6)

**1) Por que mostra "Retentar (1)" se há 3 aguardando + 1 falha?**
O contador `Retentar (N)` só conta linhas elegíveis pela função `isRetriableSimulation` (em `V8HistoricoTab.tsx`):
- `failed` com `error_kind` retentável (`temporary_v8` ou `analysis_pending`) → conta.
- `pending` retentável **só conta se `last_attempt_at` > 60s atrás** (dá tempo para o webhook chegar).

Na sua captura as 3 linhas em "aguardando V8" provavelmente acabaram de receber a 1ª tentativa (<60s), então só a 1 `failed` entrou. Funciona como projetado, mas o **rótulo do botão é confuso** — vou renomear para `Retentar agora (N)` e adicionar tooltip explicando o critério, além de exibir um segundo número quando houver `pending` "ainda no cooldown".

**2) Por que "Ver status na V8" só aparece em Nova Simulação?**
Bug de paridade: na aba **Histórico** (`BatchDetail`), a coluna Motivo apenas imprime `getV8ErrorMessageDeduped` sem tratar o caso `kind === 'active_consult'`. Em Nova Simulação isso é tratado e mostra o botão "🔍 Ver status na V8". Vou portar a mesma lógica para o Histórico (mensagem âmbar + botão + dialog).

**4) "1/13 (8%)" — o que significa?**
- Numerador (`done` = 1): simulações já finalizadas (`status` ∈ {`success`, `failed`}).
- Denominador (`total` = 13): total do lote.
- Percentual: `done/total`.
As 12 linhas restantes estão em `pending`/`processing` (V8 ainda não devolveu). Quando uma vira `success` ou `failed`, o contador anda.

**6) Diferença entre "Retentar falhados" e "Reprocessar pendentes"**
- **Retentar falhados** → re-dispara `simulate_one` na `v8-clt-api` para CPFs com falha retentável (`temporary_v8` / `analysis_pending`). É **uma nova consulta** do zero na V8.
- **Reprocessar pendentes** → chama `v8-webhook` com `replay_pending`, que **busca na V8 o resultado de consultas já feitas** que ficaram presas em `pending` (webhook perdido). Não cria consulta nova.

Conclusão: são complementares, mas o nome confunde o usuário não-técnico. Vou:
- Renomear "Reprocessar pendentes" → **"Buscar resultados pendentes"**.
- Adicionar tooltip claro em cada botão.
- Esconder o botão "Buscar resultados pendentes" do **Histórico** se não houver `pending`. Hoje só aparece em Nova Simulação — vou adicionar também ao Histórico para paridade.

---

## O problema central (perguntas 3 e 5)

**Pergunta 3 — "Motivo" só atualiza ao trocar de aba:**
A tabela de detalhe usa `useV8BatchSimulations` que **já tem realtime**, mas o filtro do canal é `batch_id=eq.${batchId}`. Funciona para `UPDATE`. O que provavelmente está falhando: o canal só assina quando o lote está **expandido**. Quando o usuário expande, faz 1 fetch e depois conta com realtime — mas pode estar perdendo updates rápidos entre o fetch e o subscribe (race), e a coluna `Motivo` lê de `s.raw_response`/`s.error_message` que mudam no banco. Vou:
- Garantir `subscribe()` **antes** do fetch inicial e refazer o fetch depois do subscribe ativo (padrão "subscribe-then-fetch" para evitar gap).
- Trocar `*` por `UPDATE` específico para reduzir ruído.
- Adicionar log visual sutil "atualizado há Xs" para o usuário ver que está vivo.
- Verificar se a tabela `v8_simulations` está em `supabase_realtime` com `REPLICA IDENTITY FULL` (consultar via SQL).

**Pergunta 5 — Auto-retry tem que ser automático até resolver:**
Hoje existem **2 motores** de retry, mas nenhum garante "rodar até sucesso ou esgotar 15":
1. **`v8-retry-cron`** roda a cada 1 min via pg_cron — tecnicamente faz o trabalho, mas:
   - O cron só pega linhas com `attempt_count < max_auto_retry_attempts` (ok), porém **não respeita um backoff por linha agressivo o bastante** quando muitas estão presas.
   - Para o usuário parece "parado" porque a UI não mostra que o cron está agendado.
2. **Loop frontend `runAutoRetryLoop`** só roda se `background_retry_enabled = false` (atualmente está `true`, então é ignorado).

**Causa real do "tive que clicar Retentar"**: o cron `v8-retry-cron` provavelmente está rodando, mas:
- Ou não passou 1 minuto desde a última tentativa (cooldown);
- Ou a linha foi para `pending` por webhook assíncrono e o select do cron está pegando, mas levando tempo.

Vou:
1. **Reduzir intervalo do cron** de 1 min para **20 segundos** (ajustar `pg_cron` schedule).
2. **Adicionar painel de status do auto-retry** no card do lote: "Auto-retry ativo · próxima varredura em ~Xs · N aguardando" — assim o usuário **vê** que está rodando.
3. **Disparar manualmente o cron** logo após o lote ser criado (kick-start), em vez de esperar o próximo tick.
4. **Fallback de segurança**: se uma linha ficar >5min sem novo `attempt_count` mesmo com cron rodando, marcar visualmente como "retry preso — clique para forçar".

---

## O que vai mudar (resumo executável)

### Frente A — Realtime do Motivo (pergunta 3)
**Arquivo:** `src/hooks/useV8Batches.ts`
- Em `useV8BatchSimulations`: subscribe → aguarda confirmação → faz fetch inicial. Filtra eventos `UPDATE` em vez de `*`.
- Adicionar estado `lastUpdateAt` exposto para a UI.

**Arquivo:** `src/components/v8/V8HistoricoTab.tsx` e `V8NovaSimulacaoTab.tsx`
- Mostrar pequeno texto "atualizado há Xs" (timer 1s) no header da tabela de progresso.

**SQL (verificação, sem alteração se já estiver ok):**
```sql
-- Confirmar que a tabela está em realtime
SELECT 1 FROM pg_publication_tables
WHERE pubname='supabase_realtime' AND tablename='v8_simulations';
```
Se faltar:
```sql
ALTER TABLE public.v8_simulations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.v8_simulations;
```

### Frente B — Auto-retry contínuo automático (pergunta 5)
**SQL (migração):**
```sql
-- Reduz intervalo do cron de 1min para 20s
SELECT cron.unschedule('v8-retry-cron-every-minute');
SELECT cron.schedule(
  'v8-retry-cron-every-20s',
  '20 seconds',
  $$SELECT net.http_post(
    url:='https://sibfqmzsnftscnlyuwiu.supabase.co/functions/v1/v8-retry-cron',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <ANON>"}'::jsonb,
    body:='{}'::jsonb
  );$$
);
```
Obs.: `pg_cron` não suporta nativamente "20 seconds" — alternativa é manter `* * * * *` e disparar 3x dentro da função (loop interno) OU usar agendamento de 1 min + auto-kick imediato após `create_batch`.

**Edge function `v8-clt-api`:** após `create_batch`, disparar `v8-retry-cron` em background uma vez (kick-start), garantindo que linhas que falham na 1ª passada já entrem na 2ª em segundos, não em 1 min.

**Edge function `v8-retry-cron`:**
- Reduzir `retry_min_backoff_seconds` default de 10 para 5 (configurável).
- Logar contagem de "scheduled vs executed" por execução.

**Arquivo:** `src/components/v8/V8HistoricoTab.tsx` e `V8NovaSimulacaoTab.tsx`
- Adicionar **indicador visual permanente** no card do lote enquanto houver linhas retentáveis:
```text
🔄 Auto-retry ativo — 4 linha(s) sendo reprocessadas pela V8
   Tentativas: 2/15 · próxima varredura em até 1 min
```

### Frente C — Paridade Histórico ↔ Nova Simulação (perguntas 2, 6)
**Arquivo:** `src/components/v8/V8HistoricoTab.tsx`
- Coluna Motivo: portar lógica `active_consult` → mostrar mensagem âmbar + botão "🔍 Ver status na V8" + Dialog (extrair `<StatusDialog>` reutilizável).
- Adicionar botão "Buscar resultados pendentes" no header do `BatchDetail` (espelha Nova Simulação).
- Renomear "Reprocessar pendentes" → **"Buscar resultados pendentes"** em ambos os arquivos.
- Adicionar tooltips explicativos:
  - "Retentar falhados" → "Refaz a consulta do zero para falhas temporárias (rate limit / análise pendente)."
  - "Buscar resultados pendentes" → "Busca na V8 respostas de consultas já enviadas que ainda não chegaram pelo webhook."

### Frente D — Contador "Retentar (N)" coerente (pergunta 1)
**Arquivo:** `src/components/v8/V8HistoricoTab.tsx`
- Renomear botão para **"Retentar agora (N)"**.
- Tooltip: "Conta apenas linhas que já passaram do tempo de espera (60s) e podem ser reenviadas imediatamente. Linhas recentes serão retentadas automaticamente."
- Mostrar abaixo (texto pequeno): `+ M aguardando próximo ciclo` quando houver `pending` retentável dentro do cooldown.

### Frente E — Componente extraído
**Novo arquivo:** `src/components/v8/V8StatusOnV8Dialog.tsx`
- Extrai o Dialog "Ver status na V8" hoje embutido em `V8NovaSimulacaoTab`. Usado pelos dois locais.

---

## Antes vs Depois

```text
ANTES                                             DEPOIS
──────────────────────────────────────────        ───────────────────────────────────────────
"Retentar (1)" mostrado sem explicação            "Retentar agora (1) + 3 aguardando próximo
                                                   ciclo" + tooltip
"Reprocessar pendentes" — usuário não sabe        "Buscar resultados pendentes" + tooltip
o que faz                                          claro

Histórico não tem "Ver status na V8"              Histórico tem botão idêntico ao Nova Sim.

Motivo só atualiza ao trocar de aba               Realtime confiável + indicador "atualizado
                                                   há Xs"

Cron a cada 1 min, sem feedback visual            Cron + kick-start imediato após criar lote
                                                   + indicador "auto-retry ativo · 2/15"

"1/13 (8%)" sem contexto                          Mesma barra + tooltip "1 finalizada de 13;
                                                   12 aguardando V8"
```

---

## Arquivos afetados

- `src/components/v8/V8HistoricoTab.tsx` — paridade UX, contador melhorado, indicador auto-retry
- `src/components/v8/V8NovaSimulacaoTab.tsx` — rename botão, tooltips, indicador auto-retry, usar Dialog extraído
- `src/components/v8/V8StatusOnV8Dialog.tsx` — **novo** componente compartilhado
- `src/hooks/useV8Batches.ts` — subscribe-then-fetch + `lastUpdateAt`
- `supabase/functions/v8-clt-api/index.ts` — kick-start do cron após `create_batch`
- `supabase/functions/v8-retry-cron/index.ts` — log de execução, backoff reduzido
- Migração SQL — verificar realtime publication + ajustar schedule do cron

---

## Vantagens / Desvantagens

**Vantagens**
- Auto-retry passa a ser visível e contínuo, sem cliques manuais.
- Motivo atualiza ao vivo, sem trocar de aba.
- Botões com nomes claros + tooltips eliminam a confusão "Retentar vs Reprocessar".
- Histórico ganha paridade total com Nova Simulação.

**Desvantagens / risco**
- Cron mais frequente (kick-start) = pequeno aumento de invocações da edge function.
- Mostrar "Auto-retry ativo" pode dar falsa sensação de ação se a V8 estiver fora do ar prolongado — mitigado pelo contador de tentativas (X/15) que deixa claro o limite.

---

## Checklist manual

1. Em `/admin/v8-simulador` → **Nova Simulação**, criar um lote teste (3-5 CPFs propositalmente em horário de rate limit).
2. Ver o card "Progresso do Lote" mostrar **"Auto-retry ativo · X/15"** assim que aparecerem falhas temporárias.
3. **Sem trocar de aba**, ver `Tentativas` ir de 1 → 2 → 3... e `Motivo` mudar sozinho. Confirmar timestamp "atualizado há Xs" se atualizando.
4. Em **Histórico**, expandir o mesmo lote. Confirmar que aparece o botão **"🔍 Ver status na V8"** nas linhas com "consulta ativa".
5. Confirmar botão **"Buscar resultados pendentes"** no header do detalhe.
6. Hover sobre **"Retentar agora (N)"**: tooltip explica os critérios.
7. Hover sobre **"Buscar resultados pendentes"**: tooltip explica que busca webhook perdido.
8. Esperar 1-2 minutos sem interagir e ver linhas saindo de "aguardando V8" para "sucesso" / "falha" sozinhas.

## Pendências
- (Futuro) Botão "Parar auto-retry" para casos em que o usuário queira congelar o estado e investigar manualmente.
- (Futuro) Métricas: gráfico no Histórico mostrando "X retentativas até sucesso" por lote.

## Prevenção de regressão
- Teste em `src/hooks/__tests__/useV8Batches.test.ts` (criar) cobrindo o padrão subscribe-then-fetch.
- Teste em `src/components/v8/__tests__/V8HistoricoTab.test.tsx` (criar) garantindo que `active_consult` mostra o botão "Ver status na V8".
- Comentário em `v8-clt-api/index.ts` explicando o kick-start do cron e por quê.
- Documentar no `docs/V8-INTEGRATION.md` os 2 motores de retry e quando cada um age.
