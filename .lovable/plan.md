
# Plano — Correção dos 4 problemas do V8 Simulador

## Diagnóstico (linguagem leiga)

### Problema 1 — Botão "Buscar propostas" pisca/aperta sozinho e seção "Consultas ativas" pisca
**Causa real:** A aba **Consultas** tem uma "escuta em tempo real" da tabela `v8_simulations` (linha 188 de `V8ConsultasTab.tsx`). Como a barra superior mostra "**102 aguardando V8 · 12 lotes ativos · varredura há 13s**", essa tabela está sendo atualizada DEZENAS de vezes por segundo pelo cron de retry. Cada update dispara uma nova chamada `loadConsults()` à V8, que coloca o botão em estado "loading" (animação de loader) — dando impressão de que ele se aperta sozinho. A seção pisca pelo mesmo motivo (re-render constante).

### Problema 2 — `CONSENT_APPROVED` significa que a V8 vai calcular?
**Resposta:** Sim, mas só quando você pedir. `CONSENT_APPROVED` significa "o trabalhador autorizou a consulta de margem na Dataprev e a V8 já tem o valor liberado mensal disponível". O **cálculo de parcela** (simulação propriamente dita: quanto o cliente recebe, parcela, taxa) é uma chamada SEPARADA `/simulation` que precisa ser disparada por nós. Hoje o código já faz isso quando o toggle está ligado (auto-simulate) ou quando o usuário clica em "Simular selecionados".

### Problema 3 — Toggle "Simular automaticamente após consulta" desligado: o que acontece?
**Estado atual:** Quando desligado, o sistema só chama `/consult` e `/authorize`. Os webhooks chegam e gravam `availableMarginValue` (margem disponível). **Nada mais acontece automaticamente.** Para gerar parcela/valor liberado, é preciso clicar no botão "**Simular selecionados**" (canto superior direito do bloco "Progresso do Lote"). Hoje não está claro pro usuário que essa é a ação obrigatória — não há nenhum aviso visual indicando "este lote tem X consultas aguardando simulação manual".

### Problema 4 — Tabelas Consultas e Propostas mostram R$ 0,00 mesmo quando o "Ver detalhes" mostra os valores
**Causa real (confirmada nos logs do banco):** A V8 retorna na **listagem** (`/operation`) um JSON com os campos `issueAmount: null`, `installmentFaceValue: null`, `numberOfInstallments: null` — ela não preenche esses 3 campos na lista. O código tem um "enriquecimento" que, para cada linha incompleta, busca o detalhe individual (`/operation/{id}`) que SIM tem esses dados.

**Mas o filtro que decide quem precisa de enriquecimento usa `op?.id`** (linha 326 de `v8-clt-api/index.ts`). Acontece que o item já vem mapeado da V8 com o nome `operationId` (não `id`). Resultado: `op?.id` é sempre undefined, o filtro retorna lista vazia, **nenhum enriquecimento acontece**, e os 3 campos ficam `null` para sempre — virando "R$ 0,00" e "—" na tela.

---

## Correções

### Fix #1 — Realtime sem spam (Consultas)
Em `src/components/v8/V8ConsultasTab.tsx`:
- Adicionar **debounce de 2 segundos** ao `loadConsults` disparado pelo realtime (acumula múltiplos eventos e só recarrega 1 vez).
- Filtrar a subscription para reagir só a UPDATEs em linhas com `error_kind='active_consult'` (que são o que essa seção mostra), ignorando o ruído dos demais.
- Não recarregar enquanto o usuário já estiver com `loading=true` (evita sobreposição).

### Fix #2 — Documentar CONSENT_APPROVED no glossário
Em `src/components/v8/V8StatusGlossary.tsx`: adicionar entrada explicando que `CONSENT_APPROVED` = autorização concedida, mas a parcela só aparece após `/simulation` rodar (manual via "Simular selecionados" ou automático via toggle).

### Fix #3 — Aviso visual quando há linhas aguardando simulação manual
Em `src/components/v8/V8NovaSimulacaoTab.tsx`:
- Adicionar **banner amarelo dentro do bloco "Progresso do Lote"** quando o toggle está desligado E existem linhas com `status='success'` + `simulate_status='not_started'`: "⚠️ X consulta(s) com margem aprovada aguardando simulação. Clique em 'Simular selecionados' para calcular parcela e valor liberado."
- Tornar o botão **"Simular selecionados" pulsante (animate-pulse)** quando existirem candidatos, chamando atenção visual.

### Fix #4 — Enriquecimento que de fato roda (BUG CRÍTICO)
Em `supabase/functions/v8-clt-api/index.ts`, função `actionListOperations`:
- Trocar `op?.id` por `op?.operationId ?? op?.id` no filtro `needsEnrichment` (linha 326).
- Trocar `op.id` por `op.operationId ?? op.id` no loop do worker (linhas 339, 354).
- Garantir que `enrichedById` use a mesma chave que está sendo lida no map final.
- Adicionar log: `console.log('[list_operations] enrichment:', preNormalized.length, '→', toEnrich.length, 'detalhes buscados')` para auditoria.

Após o fix, em uma listagem com 50 linhas que vêm sem esses 3 campos, o código vai disparar até 50 chamadas paralelas (concorrência 8) ao `/operation/{id}` da V8 e popular Valor bruto, Parcela e Nº parcelas em todas elas — exatamente como o "Ver detalhes" já mostra.

---

## Detalhes técnicos

| Arquivo | Mudança |
|---|---|
| `supabase/functions/v8-clt-api/index.ts` (linhas 326, 339, 354) | `op?.id` → `op?.operationId ?? op?.id` (3 ocorrências) + log de enriquecimento |
| `src/components/v8/V8ConsultasTab.tsx` (linhas 188-215) | Debounce 2s + filtro de evento + check de loading no handler de realtime |
| `src/components/v8/V8NovaSimulacaoTab.tsx` (linhas 700-770 e bloco "Progresso do Lote") | Banner de aviso + animate-pulse no botão "Simular selecionados" |
| `src/components/v8/V8StatusGlossary.tsx` | Adicionar item `CONSENT_APPROVED` com explicação |

Não toca em: schema do banco, edge functions de webhook, retry cron, settings.

---

## Antes vs Depois

| Item | Antes | Depois |
|---|---|---|
| Tabela Consultas/Propostas | Valor bruto / Parcela / Nº parcelas em zero | Valores reais idênticos ao "Ver detalhes" |
| Botão "Buscar propostas" | Pisca constantemente (loader animando sozinho) | Estável; recarrega no máximo 1x a cada 2s |
| Seção "Consultas ativas" | Pisca a cada update de simulação | Atualiza suavemente, sem flicker |
| Toggle desligado | Usuário fica perdido sem entender que precisa clicar manual | Banner amarelo + botão pulsante explicam o passo |
| Glossário | Não fala de CONSENT_APPROVED | Explica que é autorização ≠ cálculo |

## Vantagens / Desvantagens

**Vantagens:** corrige o problema raiz das tabelas zeradas (1 linha de código), elimina N chamadas/seg desnecessárias à V8 (economia de quota), torna o fluxo manual evidente.
**Desvantagens:** o enriquecimento adiciona ~1-3s de latência na listagem (até 200 chamadas extras à V8 com concorrência 8) — aceitável porque hoje a tela está inutilizável.

## Checklist manual de validação

1. Aba **Consultas** → "Buscar propostas" → confirmar que **Valor bruto, Parcela e Nº parcelas** aparecem preenchidos (não mais R$ 0,00 / —).
2. Aba **Propostas** → mesma validação.
3. Comparar 1 linha com o modal "Ver detalhes" — valores devem bater.
4. Aba **Consultas** com lote ativo rodando → confirmar que botão "Buscar propostas" **não fica piscando** e seção "Consultas ativas" **não pisca**.
5. Aba **Nova Simulação** → criar lote, deixar toggle desligado → confirmar **banner amarelo aparece** com contagem e **botão "Simular selecionados" pulsa**.
6. Clicar "Simular selecionados" → confirmar que parcela/valor liberado aparecem nas linhas.
7. Hover no glossário "?" → confirmar que **CONSENT_APPROVED** está documentado.

## Pendências (futuro)

- Cache do enriquecimento por 30 min em `v8_operations_local` para evitar re-buscar detalhes que já foram buscados (otimização — hoje cada listagem refaz tudo).
- Indicador visual em tempo real (spinner discreto) enquanto enriquecimento está rodando.

## Prevenção de regressão

- Adicionar **teste vitest** em `src/lib/__tests__/` que monta um payload V8 sintético com `operationId` (sem `id`) e valida que o filtro de enriquecimento marca a linha como elegível.
- Adicionar comentário em destaque no `actionListOperations` avisando que a V8 usa `operationId` (camelCase), não `id` — para não regredir.
- Manter o log `[list_operations] enrichment: X → Y detalhes buscados` para que qualquer regressão futura seja visível em audit_logs imediatamente.
