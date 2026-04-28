## Diagnóstico atual, em linguagem leiga

### 1) Por que fica “Buscando status na V8... atualiza em até 1 min” e não muda?

O problema não é só o front-end. Achei dois pontos no backend:

- O `v8-active-consult-poller` está tentando consultar muitas linhas de uma vez e chamar outra Edge Function (`v8-clt-api`) repetidamente. Nos logs apareceu erro de limite interno:
  - `RateLimitError: Rate limit exceeded for function`
- Além disso, o `v8-clt-api` hoje reconhece como chamada interna apenas o `v8-retry-cron`. O poller de consulta ativa chama com `x-cron-trigger: v8-active-consult-poller`, mas essa origem não está liberada no mesmo fluxo interno.

Resultado prático:

- A linha recebe `v8_status_snapshot_at` atualizado, então parece que o robô tentou buscar.
- Mas o `raw_response.v8_status_snapshot` não é gravado.
- Por isso o front-end continua sem dados para renderizar inline e mostra “buscando status” por vários minutos.

Na varredura do banco agora:

- Existem `98` linhas com `error_kind = active_consult`.
- `0` delas têm `raw_response.v8_status_snapshot` gravado.
- Ou seja: o poller está rodando, mas não está conseguindo salvar o snapshot útil.

### 2) Existiu algum payload com sucesso financeiro liberado, valor e parcela?

Fiz a varredura nas tabelas/payloads disponíveis:

- `v8_simulations`: `8.925` linhas totais.
- `238` linhas estão como `success`, mas elas são principalmente sucesso de consulta/webhook, não sucesso financeiro de simulação.
- `0` linhas têm `released_value > 0`.
- `0` linhas têm `installment_value > 0`.
- `0` tentativas em `v8_simulation_attempts` terminaram como sucesso financeiro.
- `v8_webhook_logs` tem muitos eventos `SUCCESS` de consulta, mas o payload traz campos como:
  - `simulationLimit.valueMin/valueMax`
  - `simulationLimit.installmentsMin/installmentsMax`
  - `availableMarginValue`
  - Não traz `valor liberado final` nem `valor da parcela`.

Conclusão: até agora, pelo que está persistido, não apareceu uma simulação financeira completa com valor liberado e parcela. O que existe é “consulta aprovada / limite disponível”, que é uma etapa anterior.

### 3) A coluna “Margem” é realmente necessária? Ela importa na chamada da API V8?

Hoje existem duas coisas diferentes chamadas de “margem”, o que confunde:

1. `availableMarginValue` da V8
   - É a margem disponível do trabalhador retornada pela V8 na consulta.
   - Exemplo: quanto de margem consignável o cliente tem.
   - Isso vem da V8; não é enviado por nós para simular.

2. `company_margin` / `margem_valor` interna LordCred
   - É uma conta interna: percentual configurado em `v8_margin_config` sobre o valor liberado.
   - Hoje default é 5%.
   - Isso NÃO entra no payload enviado para a V8.
   - Só faria sentido depois que existir `released_value` real.

Payload atual da API V8:

```text
Consulta:
CPF, nome, nascimento, gênero, telefone, provider

Simulação:
consult_id, config_id, número de parcelas, provider
Opcional: valor liberado desejado OU valor da parcela desejada
```

A margem interna não é necessária para a chamada da V8. Ela é apenas cálculo comercial interno. Minha recomendação é renomear/higienizar a UI para não parecer que a margem faz parte da V8.

---

## Plano de correção seguro

### 1. Corrigir o poller de “consulta ativa”

Arquivos:
- `supabase/functions/v8-clt-api/index.ts`
- `supabase/functions/v8-active-consult-poller/index.ts`

O que será feito:

- Liberar `v8-active-consult-poller` como chamada interna autorizada, igual ao `v8-retry-cron`.
- Reduzir o volume por ciclo do poller para evitar estouro de limite da Edge Function.
- Remover ou controlar melhor as subpassadas agressivas quando houver muitas consultas ativas.
- Quando a V8 responder “encontrado”, salvar em `raw_response.v8_status_snapshot`.
- Quando a V8 responder “não encontrado” ou “rate limit”, gravar um estado legível para o front-end não ficar eternamente em “buscando”.

Resultado esperado:

- A linha de consulta ativa deixa de ficar presa.
- O front-end passa a mostrar inline status real como `SUCCESS`, `REJECTED`, `WAITING_CONSENT`, `WAITING_CREDIT_ANALYSIS`, etc.
- Se houver limite da V8/Supabase, aparece mensagem clara: “V8 limitou a busca, nova tentativa automática em X minutos”.

### 2. Persistir o resultado quando o usuário clicar em “Ver status na V8”

Arquivos:
- `src/components/v8/V8StatusOnV8Dialog.tsx`
- `src/components/v8/V8HistoricoTab.tsx`
- `src/components/v8/V8NovaSimulacaoTab.tsx`

O que será feito:

- O botão “Ver status na V8” continuará abrindo o modal.
- Quando a consulta manual retornar dados, além de mostrar no modal, vamos salvar o snapshot naquela linha.
- Assim a própria linha passa a atualizar inline depois do clique.

Resultado esperado:

- Você não precisa depender só do poller automático.
- Se clicar no modal e a V8 responder, a tabela também aprende aquele status.

### 3. Corrigir a mensagem do front-end para não prometer “1 min” quando há rate limit

Arquivos:
- `src/lib/v8ErrorPresentation.ts`
- `src/components/v8/V8HistoricoTab.tsx`
- `src/components/v8/V8NovaSimulacaoTab.tsx`

O que será feito:

- Trocar texto fixo “atualiza em até 1 min” por estado real:
  - “Buscando status...” quando ainda não tentou.
  - “Última busca sem retorno da V8” quando não encontrou.
  - “V8 limitou as consultas, tentando de novo em instantes” quando tiver rate limit.
  - “Clique em Ver status na V8 para consultar manualmente” quando fizer sentido.

Resultado esperado:

- A tela deixa de dar a impressão de que está travada sem explicação.

### 4. Ajustar a varredura de payload financeiro

Arquivos:
- `supabase/functions/v8-clt-api/index.ts`
- `src/components/v8/V8StatusOnV8Dialog.tsx`
- `docs/V8-INTEGRATION.md`

O que será feito:

- Separar visualmente “Consulta aprovada / limite disponível” de “Simulação financeira concluída”.
- No modal, mostrar claramente:
  - Status da consulta.
  - Limite mínimo/máximo retornado pela V8.
  - Margem disponível V8.
  - E só mostrar “Valor liberado / Parcela” quando realmente existir payload financeiro de simulação.

Resultado esperado:

- Uma consulta `SUCCESS` não será confundida com financiamento liberado.
- Se ainda não houver `released_value`/`installment_value`, a UI vai dizer isso claramente.

### 5. Renomear/ajustar a coluna “Margem”

Arquivos:
- `src/components/v8/V8HistoricoTab.tsx`
- `src/components/v8/V8NovaSimulacaoTab.tsx`
- `src/components/v8/V8StatusOnV8Dialog.tsx`
- `src/components/v8/V8ConfigTab.tsx`

O que será feito:

- Renomear a margem interna para algo como “Margem LordCred” ou “Margem empresa”.
- Mostrar `availableMarginValue` como “Margem disponível V8”, quando vier no payload de consulta.
- Deixar claro no texto de ajuda que essa margem não é enviada para a V8.
- Manter o cálculo interno apenas para quando houver valor liberado real.

Resultado esperado:

- Menos confusão operacional.
- A equipe entende o que vem da V8 e o que é cálculo interno.

---

## Antes vs Depois

Antes:
- Consulta ativa fica mostrando “buscando status” por muitos minutos.
- O poller atualiza timestamp, mas não salva snapshot útil.
- Modal/linha confundem consulta aprovada com simulação financeira.
- “Margem” parece ser campo da V8, mas é cálculo interno.

Depois:
- Consulta ativa terá status inline real ou erro claro de rate limit.
- Clique em “Ver status na V8” também salva o snapshot na linha.
- A UI separa “consulta/limite” de “financiamento simulado”.
- Margem interna e margem disponível da V8 ficam com nomes diferentes.

## Melhorias

- Menos tela presa.
- Menos dúvida entre Histórico e Progresso do Lote.
- Menos chamadas agressivas que estouram limite.
- Diagnóstico visual mais honesto quando a V8 limita ou não retorna dados.

## Vantagens e desvantagens

Vantagens:
- Mais estabilidade.
- Menos rate limit.
- Status mais confiável no front-end.
- Dados financeiros só aparecem quando realmente existem.

Desvantagens:
- O poller será menos agressivo por segurança, então em momentos de fila grande pode levar alguns ciclos para atualizar tudo.
- Separar “consulta aprovada” de “simulação financeira” pode mostrar mais estados intermediários, mas evita falsa impressão de sucesso financeiro.

## Checklist manual para validar depois da implementação

1. Abrir `/admin/v8-simulador`.
2. Ir em “Nova Simulação” ou “Histórico”.
3. Abrir um lote com linhas “consulta ativa”.
4. Confirmar se a linha muda para status real ou mensagem clara de limite.
5. Clicar em “Ver status na V8”.
6. Fechar o modal e confirmar se a linha passou a mostrar o snapshot inline.
7. Ir na aba “Consultas”.
8. Buscar pelo período atual e confirmar se consultas `SUCCESS` mostram limite/margem disponível, sem fingir que já têm valor liberado/parcela.
9. Confirmar que a coluna de margem ficou com nome mais claro.

## Pendências após esta correção

- Se a V8 exigir outro endpoint para transformar uma consulta `SUCCESS` em simulação financeira completa, vamos precisar implementar uma etapa específica: “Simular a partir da consulta aprovada”.
- Hoje não encontrei payload financeiro completo persistido; então a próxima melhoria pode ser criar essa ação quando tivermos o fluxo exato validado.

## Prevenção de regressão

- Adicionar logs resumidos no poller: quantas consultas encontrou, quantas salvou snapshot, quantas bateram rate limit.
- Atualizar `docs/V8-INTEGRATION.md` explicando a diferença entre:
  - consulta ativa,
  - consulta aprovada,
  - simulação financeira,
  - operação/proposta.
- Evitar `BATCH_LIMIT` alto em poller que chama Edge Function em loop.
- Não prometer “atualiza em 1 min” se o backend estiver em cooldown/rate limit.