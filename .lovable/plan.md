## Respostas às suas dúvidas (linguagem leiga)

### 1) O auto-retry é de no mínimo 1 minuto mesmo?

**Não.** Na prática roda a cada **20 segundos**, mas com um truque:

- O Supabase só permite agendar cron **no mínimo a cada 1 minuto** (limite da plataforma).
- Para contornar isso, quando o cron `v8-retry-cron-every-minute` dispara (1x por minuto), ele:
  1. Roda a **passada principal** imediatamente (segundo 0).
  2. Agenda **2 sub-passadas extras** para rodar nos segundos **20** e **40** do mesmo minuto.
- Resultado: dentro de 1 minuto rodam **3 ciclos** de retry (0s, 20s, 40s).
- Além disso, quando você cria um lote novo, são agendadas mais 3 chamadas extras em **30s, 60s e 90s** para acelerar a primeira retentativa.

Então o que você vê de fato é: **uma varredura a cada ~20s**, não a cada 60s.

---

### 2) Por que itens com "consulta ativa" não renderizam o resultado e preciso abrir o modal?

**Diagnóstico:** o snapshot inline JÁ existe no código (`V8HistoricoTab` e `V8NovaSimulacaoTab` leem `raw_response.v8_status_snapshot`), mas ele **só aparece quando o poller `v8-active-consult-poller` já rodou e gravou o snapshot**.

O fluxo é:
1. Linha cai em `active_consult` → fica mostrando "Buscando status na V8…" + botão "Ver status na V8".
2. O poller (`v8-active-consult-poller-every-minute`) roda **1x por minuto** e busca o status na V8.
3. Quando o snapshot é gravado, a UI passa a mostrar inline (Status: REJECTED / CONSENT_APPROVED / etc.).

**Problema atual:** o poller pode estar deixando linhas para trás (filtra por `v8_status_snapshot_at` antigo/nulo, mas o limite por execução pode estar baixo) — por isso você vê linhas paradas em "Buscando status na V8… (atualiza em até 1 min)" sem nunca atualizar.

**Correção planejada:**
- Disparar o poller **imediatamente** quando uma linha vira `active_consult` (não esperar o tick do cron).
- Aumentar o limite por execução do poller e agendar sub-passadas (igual ao retry-cron).
- Atualizar `v8_status_snapshot_at` mesmo quando a V8 retorna "não encontrado", para não ficar repolando o mesmo CPF.

---

### 3) O modal "Status da consulta na V8" mostra o payload completo?

**Não.** Hoje o modal (`V8StatusOnV8Dialog`) mostra apenas:
- Status
- Nome
- Criada em
- Detail (opcional)

A V8 retorna **muito mais** no `check_consult_status`: parcelas, valor liberado, valor da parcela, margem, taxa, banco, prazo, motivo de rejeição etc. — tudo está em `data.latest` mas é descartado pela UI.

**Correção planejada:** expandir o modal para mostrar:
- Bloco "Resultado da simulação" (se disponível): valor liberado, parcela, margem, prazo, banco, taxa.
- Bloco "Histórico de consultas" (`data.all`): lista cronológica com status de cada uma.
- Bloco "Payload bruto" colapsável usando `JsonTreeView` (já existe em `src/components/admin/JsonTreeView.tsx`) para inspeção total.

---

### 4) Para que servem "Retentar falhados" e "Buscar resultados pendentes"?

**"Retentar falhados" (botão amarelo/azul):**
> "Refaz a consulta **do zero** na V8 para CPFs que falharam por problema temporário."
- Pega linhas com `status=failed` e tipo de erro `temporary_v8` (instabilidade da V8) ou `analysis_pending` (V8 ainda analisando).
- **Reenvia a simulação** — incrementa a coluna "Tentativas".
- **Não mexe** em `active_consult`, `existing_proposal` nem `invalid_data` (esses precisam de ação humana).
- Use quando: você vê linhas em vermelho com motivo "instável" ou "análise pendente".

**"Buscar resultados pendentes" (botão cinza):**
> "Pergunta para a V8 se ela já tem resposta para consultas que enviamos mas o webhook nunca chegou."
- Não reenvia nada. Apenas chama a V8 e pergunta: *"você terminou a análise daquele CPF que pedi antes?"*
- Atualiza linhas que estão em `pending` há muito tempo (webhook perdido, V8 demorou).
- **Não incrementa "Tentativas"** — é uma consulta de status, não nova simulação.
- Use quando: você vê linhas presas em "aguardando V8" / "em análise" há mais de 2 minutos.

**Resumo:**
| Botão | O que faz | Quando usar |
|---|---|---|
| Retentar falhados | Reenvia simulação | Linha vermelha "instável" |
| Buscar resultados pendentes | Pergunta status | Linha amarela "aguardando" há +2min |

---

### 5) Por que no Histórico tem 3 botões e na Nova Simulação só 2?

**Você está certo, é inconsistente.** Hoje:

- **Histórico** tem 3 botões:
  1. **"Retentar agora (N)"** — no header de cada lote (sem precisar expandir).
  2. **"Retentar falhados (N)"** — dentro do lote expandido.
  3. **"Buscar resultados pendentes"** — dentro do lote expandido.

- **Nova Simulação** tem 2 botões (no card "Progresso do Lote"):
  1. **"Retentar falhados"**
  2. **"Buscar resultados pendentes"**

O **"Retentar agora (N)"** do Histórico e o **"Retentar falhados (N)"** fazem **a mesma coisa** (chamam `v8-retry-cron` com `manual: true`). A diferença é só onde aparecem: o do header é um atalho para não precisar expandir o lote.

**Correção planejada:** padronizar para **2 botões em ambas as telas**, com nomes idênticos:
- "Retentar falhados (N)"
- "Buscar resultados pendentes"

E **remover** o "Retentar agora" duplicado do header (ou transformá-lo em badge clicável que apenas expande o lote e foca no botão correto). Assim você sabe que é a mesma coisa nas duas telas.

---

## Plano de implementação (Etapa única, segura)

### 1. Modal de status V8 — mostrar payload completo
**Arquivo:** `src/components/v8/V8StatusOnV8Dialog.tsx`
- Adicionar bloco "Resultado da simulação" mostrando: valor liberado, parcela, margem, prazo, banco, taxa (quando presentes em `data.latest`).
- Adicionar bloco "Todas as consultas" (lista de `data.all`) com status, data e detail de cada uma.
- Adicionar accordion "Ver dados completos (JSON)" usando `JsonTreeView` para inspeção total.
- Manter compatibilidade com snapshot inline (mesma fonte de dados).

### 2. Render inline mais agressivo em "consulta ativa"
**Arquivos:** `supabase/functions/v8-active-consult-poller/index.ts`, `supabase/functions/v8-clt-api/index.ts`
- Aumentar o limite do poller por execução (de 50 → 200) e adicionar sub-passadas a 20s/40s (igual ao retry-cron).
- Sempre atualizar `v8_status_snapshot_at` mesmo quando a V8 responde "not found", para evitar repolling infinito do mesmo CPF.
- No `v8-clt-api/simulate_one`, quando detectar `active_consult`, **agendar imediatamente** (`EdgeRuntime.waitUntil`) uma chamada ao poller para aquele CPF específico, em vez de esperar o cron.
- **Resultado:** snapshot aparece em 5-10s em vez de até 1 min.

### 3. Padronização de botões entre Histórico e Nova Simulação
**Arquivos:** `src/components/v8/V8HistoricoTab.tsx`, `src/components/v8/V8NovaSimulacaoTab.tsx`
- **Remover** `BatchRetryHeaderButton` do header do lote no Histórico (era duplicado com o botão de dentro).
- **Manter** apenas 2 botões em ambas as telas, com tooltips e textos **idênticos**:
  - "Retentar falhados (N)" — só aparece quando N > 0.
  - "Buscar resultados pendentes" — só aparece quando há pending.
- Substituir o header do lote por um **badge informativo** mostrando "N para retentar" que, ao clicar, expande o lote e rola até o botão.

### 4. Tooltips com explicação leiga (vai além do que tem hoje)
- Tooltip do "Retentar falhados": *"Pede para a V8 fazer a consulta de novo nos CPFs que falharam por instabilidade. Aumenta o número de Tentativas."*
- Tooltip do "Buscar resultados pendentes": *"Pergunta à V8 se ela já tem resposta para consultas que enviamos mas que ainda não chegaram. Não conta como nova tentativa."*

### 5. Documentação
**Arquivo:** `docs/V8-INTEGRATION.md`
- Documentar as 3 perguntas de hoje em uma seção "FAQ operacional".
- Documentar a cadência real do auto-retry (20s, não 60s).
- Documentar para que serve cada botão.

---

## Resumo do que vai mudar (REGRA DE OURO)

**Antes vs Depois:**
- Antes: modal só mostra status/nome → Depois: modal mostra resultado da simulação + histórico + JSON completo.
- Antes: linhas "consulta ativa" demoram até 60s para mostrar snapshot inline → Depois: 5-10s.
- Antes: Histórico tem 3 botões / Nova Simulação 2 → Depois: 2 botões idênticos nos dois lugares.
- Antes: tooltips genéricos → Depois: tooltips em linguagem leiga.

**Pendências (depois desta etapa):**
- Avaliar criar uma aba "Detalhes do CPF" dentro do próprio modal (clicável da tabela), em vez de dialog.
- Considerar diminuir o cron do poller para 30s usando o mesmo truque de sub-passadas (hoje só o retry usa).

**Prevenção de regressão:**
- Tooltip dos botões vira fonte única de verdade — qualquer mudança de comportamento atualiza o tooltip junto.
- Documentação do FAQ no `V8-INTEGRATION.md` evita que a confusão volte.
