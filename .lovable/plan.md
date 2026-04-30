# Por que travou — diagnóstico nos seus dados

Olhei direto no banco o que aconteceu na sua sessão (últimas 6h, seu user). O que eu encontrei:

**Lotes criados / cancelados pré-teste** (Rascunho A, 12:52 → 12:54): 6 lotes `canceled` — você ficou clicando em "Iniciar simulação" e "Cancelar lote" antes do teste real. Isso explica a confusão visual no print.

**Os 3 rascunhos que você queria enfileirar (12:57)**: o sistema só enfileirou **2** (a, b) — não 3.

```
12:57:08.546  lote "a"  status=queued  pos=1  queue_owner=você
12:57:08.922  lote "b"  status=queued  pos=2  queue_owner=você
(rascunho C / "c") — NUNCA foi criado no banco
```

**O que rodou de verdade** (12:59:08 → 12:59:23): apareceu um lote NOVO chamado "a" com `queue_owner=NULL`, `status=completed`, 1 sucesso + 1 falha. Esse é exatamente o lote da sua imagem 574/575 (Vitória ok, Lilian falha).

Conclusão: **3 bugs reais + 1 ação manual sua** que se combinaram:

---

## Bug 1 — Rascunho 3 ("c") foi silenciosamente pulado

`queueAllDrafts` (em `src/lib/v8RunAllDrafts.ts`) pula um rascunho com motivo `'skipped'` quando:
- nome em branco, OU
- tabela não escolhida, OU
- pasteText sem CPFs válidos, OU
- alguma linha com data inválida.

O toast diz `"2 enfileirado(s) · 1 pulado(s)"` em letrinha pequena na descrição — mas **não diz qual** rascunho foi pulado nem **por quê**, e o toast some em 8s. Por isso você não viu.

**Correção**: tornar o relatório explícito, com nome do rascunho e motivo, em um diálogo (não toast) quando houver `skipped > 0`. Ex.: *"Rascunho 3 (c): sem CPFs válidos — verifique se você colou na aba certa."*

---

## Bug 2 — A fila não rodou imediatamente porque havia outro lote ativo

A regra no launcher (`v8-scheduled-launcher`, linhas 56-62) é:

> "Só promove um `queued` se o operador NÃO tem nenhum lote em `processing` ou `scheduled`."

No print 572 você ainda tinha o lote do Rascunho A em `processing` (4/6, com Pedro/Ordenato/Paulo/João sendo retentados). Por isso os enfileirados (a, b) ficaram esperando — era o esperado, mas a UI/diálogo prometeu *"O 1º começa imediatamente"*. Mentira piedosa.

**Correção**: 
- Detectar **antes** de enfileirar se já existe lote ativo desse operador. Se sim, mostrar no diálogo de confirmação: *"Você já tem 1 lote em andamento. Os 3 novos vão entrar na fila e começam quando o atual terminar."* Em vez de prometer "imediatamente".
- Ajustar o texto pós-enfileiramento ("Sequência iniciada") para refletir corretamente.

---

## Bug 3 — Por que a fila travou depois que o lote "a" terminou

Esse é o bug mais sério. O lote do print 574/575 (`b9f88895`, status=completed, 12:59) **não tinha `queue_owner` preenchido** — ele foi criado por outra rota (provavelmente o "Iniciar Simulação" tradicional, não pelo "Executar todos em sequência"). 

Mas mesmo assim, os 2 lotes em fila (a, b com `queue_owner=você`) **não foram promovidos** quando esse acabou. Por quê? Olha o launcher novamente:

```ts
// linha 56-60
const { count: activeCount } = await supabase
  .from("v8_batches")
  .select("id", { count: "exact", head: true })
  .eq("created_by", owner)
  .in("status", ["processing", "scheduled"]);
if ((activeCount ?? 0) > 0) continue;
```

Esse check **inclui qualquer lote do operador**, mesmo os "fora da fila" (`queue_owner=NULL`). Se você fica criando/iniciando lotes manuais paralelos (como aconteceu várias vezes às 12:52-12:54), enquanto **qualquer um** deles estiver `processing`, a fila trava.

E pior: olhei agora (15:00 UTC ~ 12:00 BRT) — os lotes a/b ainda estão em `queued` desde 12:57. O launcher rodou ~120 vezes desde então e nunca os promoveu. Isso significa que tem **algum lote seu travado em `processing` no banco** que o launcher considera "ativo". Vou identificar e destravar na implementação.

**Correção dupla**:
1. **Lógica do launcher**: a checagem de "lote ativo do operador" deve considerar **só lotes recentes** (ex.: `updated_at > now() - interval '1 hour'`). Lotes parados há horas em `processing` viraram zumbis e não devem bloquear a fila.
2. **Watchdog**: marcar como `failed` (ou `completed` se 100% das sims já estão em terminal state) lotes em `processing` parados há > 2h sem atualização. Isso já existe parcialmente no `v8-orphan-reconciler`, mas precisa garantir que cubra esse caso.
3. **Destrava manual agora**: identificar e fechar os zumbis seus para que a/b possam rodar.

---

## Sua dúvida sobre Cancelar Lote

Olhei o código (`v8-clt-api/index.ts` linhas 2620-2660). O comportamento atual é:

- O lote vira `status=canceled`.
- **Apenas as simulações em `pending`** são marcadas como `failed` com `error_kind=canceled`.
- Simulações que já estão em outro estado (ex.: `processing`, "consulta ativa", aguardando webhook) **NÃO são tocadas**.

Resposta direta: **sim, o sistema continua ouvindo os webhooks dos CPFs que estavam em análise**. O webhook chega normalmente e atualiza a `v8_simulations` correspondente. O lote em si já está `canceled`, mas a sim individual pode terminar com `success` ou `failed` mesmo depois.

Isso pode ser bom (não joga fora consulta cara que já foi paga) ou ruim (fica "pingando" na UI). Vou listar isso como melhoria opcional no final.

---

# O que eu vou implementar (4 itens)

### Item 1 — Diálogo de relatório claro pós-enfileiramento

Em `src/components/v8/V8NovaSimulacaoTab.tsx` (`handleRunAllDrafts`):
- Substituir o toast genérico por um **AlertDialog** quando houver `skipped` ou `error`.
- Mostrar lista: ✅ Rascunho 1 (a) — enfileirado pos #1 / ⚠️ Rascunho 3 (c) — pulado: sem CPFs válidos / etc.
- Botão "Entendi" para fechar.

### Item 2 — Pré-check de lote ativo + texto honesto no diálogo de confirmação

Em `handleRunAllDrafts`, antes do `window.confirm`:
- Consultar `v8_batches` do user com `status in ('processing','scheduled')`.
- Adaptar o texto: *"Você já tem 1 lote em andamento (X). Os 3 novos entram na fila e começam quando ele terminar (verificação a cada 1 min)."*
- Se não houver, manter o texto atual.

### Item 3 — Corrigir launcher: ignorar lotes zumbis + destrava manual

Em `supabase/functions/v8-scheduled-launcher/index.ts`:
- Mudar a query de `activeCount` para só considerar lotes com `updated_at > now() - interval '30 minutes'` (zumbis não bloqueiam mais).
- Adicionar log explícito: *"queue blocked for owner X by batch Y (last update: Z)"* para diagnóstico futuro.

Em `supabase/functions/v8-orphan-reconciler/index.ts` (verificar primeiro o que ele já faz):
- Garantir que lotes em `processing` há > 2h sem `pending_count` sejam fechados como `completed` (se tiverem success+failure = total) ou `failed`.

**Ação imediata na migração**: identificar e destravar os zumbis atuais do seu user, para que os lotes a/b enfileirados desde 12:57 possam rodar.

### Item 4 — Tooltip explicando "Cancelar Lote"

Adicionar tooltip/info no botão "Cancelar lote" do `BatchProgressCard` (ou onde estiver):
> *"Cancela apenas as simulações ainda pendentes. CPFs já enviados continuam sendo monitorados pelo webhook — o resultado final ainda pode chegar."*

---

# Prevenção de regressão

- **Teste novo** em `src/lib/__tests__/`: `v8RunAllDrafts.test.ts` cobrindo (a) rascunho com nome em branco vira `skipped` com `reason` legível, (b) rascunho com data inválida idem, (c) summarizeRunAll com mix de queued/skipped/error retorna texto correto.
- **Teste novo** simulando launcher com lote zumbi (mock supabase): garantir que `queue_position=1` é promovido se único `processing` está parado há 1h.
- **Memória**: salvar memória `mem://features/v8-queue-launcher-rules` registrando: "launcher ignora lotes parados >30min ao decidir promover queued; orphan-reconciler fecha zumbis >2h".

---

# Pendências (após sua aprovação)

**Imediatas (faço já):** itens 1 a 4 acima.

**Futuras (pergunto antes):**
- (a) Botão "Cancelar lote E os webhooks pendentes" — versão dura que marca tudo como `canceled` e ignora webhooks chegando depois. Útil quando você quer realmente parar de pagar consultas. Hoje não tem.
- (b) Retomar a fila se o usuário cancelar manualmente todos os lotes "ativos" — disparar o launcher na hora em vez de esperar 1 min.
- (c) Mostrar em `V8RealtimeStatusBar` quando há lote zumbi bloqueando a fila do user (diagnóstico visível).

---

# Checklist manual após implementação

1. Crie 3 rascunhos (A, B, C) com nome + tabela + CPFs válidos em todos.
2. Sem nenhum lote ativo, clique "Executar todos em sequência (3)".
3. Confirme: o diálogo de confirmação deve dizer "1º começa imediatamente; 2 outros entram na fila".
4. Após o 1º terminar, o 2º deve começar **sozinho em até 1 min**.
5. Após o 2º terminar, o 3º idem.
6. **Cenário com lote ativo**: deixe um lote rodando, clique "Executar todos em sequência" — diálogo agora deve avisar "Você já tem 1 lote em andamento, os 3 novos entram na fila".
7. **Cenário rascunho ruim**: faça 1 rascunho sem CPFs e clique enfileirar todos — em vez de toast pequeno, deve abrir diálogo dizendo qual rascunho foi pulado e por quê.
8. **Tooltip cancelar**: passe o mouse no botão "Cancelar lote" e leia a explicação.

Posso começar?
