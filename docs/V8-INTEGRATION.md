# V8 Integração — Documentação Consolidada

> **LordCred × V8 Digital — Crédito Privado CLT (Crédito do Trabalhador)**
> Última atualização: 2026-04-24
> Status: Em validação operacional (rota `/admin/v8-simulador`).

Este documento consolida o material técnico interno da V8 (PDF resumo + manual
detalhado) com o que **realmente está implementado** no LordCred. Quando houver
divergência entre o material da V8 e a implementação, esta documentação prevalece
e o ponto é marcado como **⚠️ divergência verificada**.

---

## 1. Visão Geral

| Item | Detalhe |
|---|---|
| Produto | Crédito Privado CLT (Crédito do Trabalhador) |
| Provedor / Averbador | `QI` (fixo em todos os endpoints) |
| API Base | `https://bff.v8sistema.com` |
| Auth (OAuth2 Password Grant) | `https://auth.v8sistema.com/oauth/token` ⚠️ |
| Validade do token | 86.400s (24h) — cache em memória, renovação 5min antes |
| Rota no LordCred | `/admin/v8-simulador` |
| Edge Function | `v8-clt-api` |
| Acesso | Todos os roles (master, admin, manager, support, seller) |

**⚠️ Divergência verificada (Auth URL):** o PDF resumido e o manual detalhado da
V8 indicam `https://api.v8digital.com/oauth/token`. Em testes práticos durante
H2.1–H2.5, esse host **retornava 503/falha de DNS**, e a integração só
estabilizou apontando para `https://auth.v8sistema.com/oauth/token` (mesmo
padrão Auth0 do BFF). Mantemos o host atual e revalidamos sempre que a V8
publicar uma atualização. Se um dia o host oficial voltar, basta trocar a
constante `V8_AUTH_URL` em `supabase/functions/v8-clt-api/index.ts`.

---

## 2. Contexto de Negócio

Antes da integração, simulações eram feitas em uma planilha Google Sheets +
Apps Script. Cada CPF era processado individualmente, sem persistência, sem
rastreabilidade e sem possibilidade de auditoria.

Com a integração:
1. Operador cola **vários CPFs** em uma única tela.
2. Edge Function dispara consultas em lote (3 simultâneos).
3. Resultados são salvos em `v8_simulations` com histórico permanente.
4. Realtime atualiza a tela conforme cada CPF termina.
5. Sistema calcula a **margem da empresa** (taxa banco vs. taxa cobrada do
   cliente) em cima do `released_value`.

---

## 3. Autenticação V8 (OAuth2 Password Grant)

### Endpoint
```
POST https://auth.v8sistema.com/oauth/token
Content-Type: application/x-www-form-urlencoded
```

### Parâmetros

| Campo | Valor | Observação |
|---|---|---|
| `grant_type` | `password` | Fixo |
| `username` | `<email>` | Secret `V8_USERNAME` |
| `password` | `<senha>` | Secret `V8_PASSWORD` |
| `audience` | `<audience>` | Secret `V8_AUDIENCE` |
| `scope` | `offline_access` | Fixo |
| `client_id` | `<client_id>` | Secret `V8_CLIENT_ID` |

### Resposta

```json
{
  "access_token": "eyJhbGciOi...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "scope": "offline_access"
}
```

### Estratégia de cache

Token guardado **em memória** dentro do isolate Deno. Renovado
automaticamente quando faltam <5min para expirar. Nunca exposto ao frontend.

---

## 4. Endpoints utilizados

### 4.1 GET configs (tabelas de taxa)

```
GET https://bff.v8sistema.com/private-consignment/simulation/configs
```

Resposta esperada (forma plana — observada em produção):
```json
[
  { "id": "uuid", "slug": "tabela-x", "monthly_interest_rate": "1.99",
    "number_of_installments": ["6","12","18","24","36","48","60","72","84","96"] }
]
```

⚠️ O manual da V8 mostra `{ "configs": [...] }`. A função
`actionGetConfigs` aceita **as duas formas** (objeto ou array plano) — vide
`actionGetConfigs` em `v8-clt-api/index.ts`.

### 4.2 POST consult (gera termo de consentimento)

```
POST https://bff.v8sistema.com/private-consignment/consult
```

Body construído pelo helper `buildConsultBody()` (puro, testável):

```json
{
  "borrowerDocumentNumber": "63513785321",
  "gender": "male",
  "birthDate": "2001-01-01",
  "signerName": "WANDERSON MONTEIRO SILVA",
  "signerEmail": "63513785321@lordcred.temp",
  "signerPhone": {
    "phoneNumber": "999999999",
    "countryCode": "55",
    "areaCode": "11"
  },
  "provider": "QI"
}
```

**Regras de normalização** (helpers exportados em `v8-clt-api/index.ts`):

| Helper | Comportamento |
|---|---|
| `normalizeBirthDate` | Aceita `dd/mm/aaaa`, `aaaa-mm-dd`, retorna ISO `YYYY-MM-DD` |
| `normalizeGender` | `M`/`masc`/`male` → `male`; `F`/`fem`/`female` → `female`; default `male` |
| `normalizePhone` | Remove máscara, separa `areaCode` (2 díg.) + `phoneNumber` (8–9 díg.). Fallback `11`/`999999999` quando ausente |

⚠️ O manual da V8 chama o campo de telefone de `number`. **Em produção a V8
aceita apenas `phoneNumber`** (senão devolve 400 com `"signerPhone.phoneNumber must be a string"`).

### 4.3 POST authorize (autoriza o termo)

```
POST https://bff.v8sistema.com/private-consignment/consult/{consult_id}/authorize
```

Sem body. Retorna `200` com texto `"Successful response"`. No LordCred é
disparado automaticamente após o consult, pois o consentimento operacional é
gerido pela empresa.

### 4.4 POST simulation (cria simulação)

```
POST https://bff.v8sistema.com/private-consignment/simulation
{
  "consult_id": "...",
  "config_id": "...",
  "number_of_installments": 24,
  "provider": "QI"
}
```

Resposta — campos relevantes:

| Campo V8 | Coluna em `v8_simulations` | Significado |
|---|---|---|
| `id_simulation` | `v8_simulation_id` | ID externo, usado para criar proposta futura |
| `disbursement_option.final_disbursement_amount` | `released_value` | Valor líquido ao cliente |
| `installment_value` | `installment_value` | Parcela mensal |
| `operation_amount` | `operation_amount` | Soma total das parcelas |
| `monthly_interest_rate` | `monthly_rate` | Taxa ao mês |
| `disbursement_option.first_due_date` | `first_due_date` | 1º vencimento |

⚠️ O PDF resumo cita `simulation_id`. O manual detalhado e a resposta real da
V8 usam `id_simulation`. O parser local aceita ambos.

### 4.5 POST operation (criar proposta — futuro)

Documentado pela V8 em `POST /private-consignment/operation`. **Ainda não
implementado** no LordCred. Será habilitado quando a etapa de formalização
ClickSign + V8 for fechada (ver Roadmap).

### 4.6 POST cancel (cancelar operação — futuro)

```
POST /operation/{idOperation}/cancel
{ "cancel_reason": "", "cancel_description": "", "provider": "QI" }
```

Não usado hoje. Será exposto junto com a tela de gestão de propostas V8.

---

## 5. Webhooks V8 (IMPLEMENTADO — alinhado à doc oficial abr/2026)

Recebidos por `supabase/functions/v8-webhook/index.ts`. Endpoints registrados via action `register_webhooks`:

```
POST /user/webhook/private-consignment/consult    → ?type=consult
POST /user/webhook/private-consignment/operation  → ?type=operation
```

### Tipos de evento (vocabulário oficial)

| `payload.type` | Tratamento |
|---|---|
| `webhook.test` | Handshake — atualiza `v8_webhook_registrations.last_test_received_at` |
| `webhook.registered` | Confirmação — `last_confirm_received_at` + `last_status=success` |
| `private.consignment.consult.updated` | Upsert em `v8_simulations` por `consultId` |
| `private.consignment.operation.created` | Upsert em `v8_operations_local` por `operationId` |
| `private.consignment.operation.updated` | idem |

### Status oficiais de CONSULTA → mapa interno

| Status V8 | Interno LordCred | Significado |
|---|---|---|
| `WAITING_CONSENT` | `pending` | Aguardando autorização do termo |
| `CONSENT_APPROVED` | `pending` ⚠️ | Termo autorizado — V8 vai consultar Dataprev. **NÃO é resultado final** (corrigido em 2026-04-28; antes era erradamente `success`) |
| `WAITING_CONSULT` | `pending` | Aguardando Dataprev |
| `WAITING_CREDIT_ANALYSIS` | `pending` | Aguardando análise de crédito |
| `SUCCESS` | `success` | Terminal positivo — único que promove (e ainda exige `released_value`+`installment_value`) |
| `FAILED` / `REJECTED` | `failed` | Terminal negativo |

### Campos extras capturados em SUCCESS (novo — abr/2026)

A doc oficial diz que em `SUCCESS` chegam: `availableMarginValue`, `admissionDateMonthsDifference`, `simulationLimit.{monthMin,monthMax,installmentsMin,installmentsMax,valueMin,valueMax}`. Agora persistimos em colunas dedicadas em `v8_simulations`:

| Coluna | Origem doc | UI |
|---|---|---|
| `margem_valor` | `availableMarginValue` | Coluna "💰 Margem Disp." + bloco verde no modal |
| `admission_months_diff` | `admissionDateMonthsDifference` | Bloco "📐 Limites de simulação V8" no modal |
| `sim_month_min` / `sim_month_max` | `simulationLimit.month*` | idem |
| `sim_installments_min/max` | `simulationLimit.installments*` | idem |
| `sim_value_min/max` | `simulationLimit.value*` | idem |

### Status oficiais de OPERAÇÃO

`generating_ccb`, `formalization`, `analysis`, `manual_analysis`, `awaiting_call`, `processing`, `paid`, `canceled`, `awaiting_cancel`, `pending`, `refunded`, `rejected`. Validados por `isKnownOperationStatus()` — status fora dessa lista grava `process_error: unknown_operation_status:X` para investigação (sem bloquear upsert).

### Fonte única da verdade

`supabase/functions/_shared/v8Status.ts` exporta as listas oficiais (`V8_CONSULT_STATUSES`, `V8_OPERATION_STATUSES`), o mapeamento (`mapV8ConsultStatus`) e o extrator (`extractConsultExtras`). Glossário UI em `src/components/v8/V8StatusGlossary.tsx` usa o mesmo vocabulário. Cobertura: `supabase/functions/_shared/v8Status_test.ts`.

---

## 6. Banco de dados (tabelas criadas)

| Tabela | Função |
|---|---|
| `v8_batches` | Cabeçalho do lote (nome, config, parcelas, totais) |
| `v8_simulations` | Resultado por CPF (status, valores, erro). Coluna `v8_simulation_id` adicionada na H2.8 |
| `v8_configs_cache` | Cache local das tabelas V8 (atualizado pelo botão "Atualizar tabelas V8") |
| `v8_margin_config` | Margem percentual da empresa (default 5%) |

Todas com RLS habilitada — apenas usuários autenticados leem/escrevem; lotes
são vinculados ao `created_by` para escopo por usuário/admin.

---

## 7. Edge Function — `v8-clt-api`

Actions implementadas:

| Action | Uso |
|---|---|
| `get_configs` | Atualiza `v8_configs_cache` a partir do GET configs |
| `create_batch` | Cria `v8_batches` + linhas em `v8_simulations` (status `pending`) |
| `simulate_one` | Executa consult → authorize → simulation para 1 CPF |
| `list_batches` | Lista lotes do usuário corrente |

Helpers puros exportados (cobertos por `payload_test.ts`):
- `buildConsultBody`
- `normalizeBirthDate`, `normalizeGender`, `normalizePhone`
- `v8FetchWithRetry` — retry exponencial (3 tentativas, 500ms / 1500ms) para
  respostas 5xx do upstream V8/Auth0.

Logging: cada ação grava em `audit_logs` com `category: 'simulator'`, contendo
`request_summary` + `response_summary` (status + body truncado) — útil para
postmortem quando a V8 está instável.

---

## 8. Frontend — `/admin/v8-simulador`

3 abas:
1. **Nova Simulação** — `V8NovaSimulacaoTab.tsx` (cola dados, escolhe tabela e
   parcelas, dispara o lote, mostra progresso em tempo real).
2. **Histórico** — `V8HistoricoTab.tsx` (lista lotes anteriores).
3. **Configurações** — `V8ConfigTab.tsx` (margem da empresa, refresh tabelas).

### Parser de colagem (`src/lib/v8Parser.ts`)

Aceita **3 formatos** por linha — em qualquer ordem após o CPF:

1. **Tokens separados** por espaço, tab, `;` ou `,`:
   ```
   12345678901 João da Silva 15/03/1985 M 11999998888
   12345678901;Maria Souza;1990-08-06;F;(11) 98888-7777
   ```
2. **Concatenado** (NOME+CPF+DATA, sem separadores), comum em exports de ERP:
   ```
   DANIEL ALYSSON BARBOSA DA SILVA1044251247308/05/1992
   ```
3. **CPF puro** *(removido da UI mas suportado pelo parser para compatibilidade)*

Tokens reconhecidos automaticamente:
- CPF (11 dígitos contíguos, com ou sem máscara)
- Data (`dd/mm/aaaa` ou `yyyy-mm-dd`)
- Gênero (`M`/`F`/`masculino`/`feminino`/`male`/`female`)
- Telefone (10–11 dígitos contíguos)
- Nome (resto)

Cobertura de testes: `src/lib/__tests__/v8Parser.test.ts` (13 casos).

---

## 9. Segurança

- Credenciais V8 ficam em **Supabase Secrets** (`V8_CLIENT_ID`, `V8_USERNAME`,
  `V8_PASSWORD`, `V8_AUDIENCE`). Nunca no código nem no frontend.
- Token JWT só vive no isolate Deno; nunca volta para o navegador.
- RLS bloqueia leitura/escrita anônima em todas as tabelas `v8_*`.
- Edge function valida `auth.getUser(token)` antes de qualquer chamada V8.

---

## 10. Tratamento de erros

| Cenário | Comportamento |
|---|---|
| 4xx da V8 (payload inválido, CPF fora de cobertura, gênero faltando) | Linha vai para `status='failed'` com `error_message` legível |
| 5xx da V8 (instabilidade upstream) | `v8FetchWithRetry` faz até 3 tentativas (backoff 500ms/1500ms). Persiste se todas falharem |
| Token expirado | Renovação automática transparente |
| Linha sem data de nascimento | Marcada como `failed` com mensagem "Data de nascimento obrigatória" |

Status agregados do lote são derivados em tempo real no frontend
(`pending` / `success` / `failed`).

---

## 11. Limitações conhecidas

- Não há captura de webhook ainda — status pós-simulação depende de re-consulta
  manual.
- Margem da empresa é única e linear (5% default). Roadmap prevê tabelas por
  banco/parceiro.
- Criação de proposta (`/operation`) e cancelamento ainda não estão na UI.

---

## 12. Roadmap

- [ ] H3.1 — Edge function `v8-webhook` para receber consult/operation.
- [ ] H3.2 — Persistir `consult_id`, `raw_response` e `margem_valor` em
      `v8_simulations`.
- [ ] H3.3 — Tela de Proposta V8 + integração ClickSign para formalização.
- [ ] H3.4 — Margem por banco/parceiro/configuração.
- [ ] H3.5 — Cancelamento de operação a partir do histórico.

---

## Anexo — Comparativo entre fontes V8

| Tópico | PDF resumo (`clt_v8.pdf`) | Manual detalhado (`v8-integracao-2.md`) | LordCred (real) |
|---|---|---|---|
| Auth URL | `api.v8digital.com` | `api.v8digital.com` | `auth.v8sistema.com` ⚠️ |
| Telefone | — | `phoneNumber` (no body do consult) | `phoneNumber` ✅ |
| ID da simulação | `simulation_id` | `id_simulation` | aceita ambos |
| Configs | — | `{ configs: [...] }` | aceita objeto **ou** array plano |
| Cancelamento | documentado | — | não implementado |
| Webhooks | listados | listados | não implementado |

---

## FAQ Operacional (linguagem leiga)

### O auto-retry é de no mínimo 1 minuto?

**Não.** Roda a cada **~20 segundos** efetivos. O cron do Supabase tem
limite mínimo de 1 min, então cada execução agenda mais 2 sub-passadas
(em 20s e 40s do mesmo minuto). Resultado: 3 ciclos por minuto.

### Por que linhas com "consulta ativa" demoram para mostrar o resultado?

A função `v8-active-consult-poller` busca o status na V8 e grava o snapshot
em `raw_response.v8_status_snapshot`. Quando o snapshot existe, a UI mostra
inline (sem precisar abrir o modal). O snapshot aparece em **5-10s** depois
que a linha vira `active_consult` (graças ao disparo imediato do poller via
`EdgeRuntime.waitUntil` em `v8-clt-api`). Se o WebSocket cair, a UI faz
polling de 10s como fallback.

### O modal "Ver status na V8" mostra tudo?

Sim. Ele exibe:
- **Resumo** (status, nome, criada em, motivo).
- **Resultado da simulação** (valor liberado, parcela, margem, taxa, banco) — quando a V8 já calculou.
- **Histórico** de todas as consultas para o CPF (`data.all`).
- **Payload bruto (JSON)** colapsável, com `JsonTreeView`, para inspeção total.

### Para que servem os botões "Retentar falhados" e "Buscar resultados pendentes"?

| Botão | O que faz | Quando usar |
|---|---|---|
| **Retentar falhados (N)** | Reenvia a simulação do zero. Aumenta "Tentativas". Pega só `temporary_v8` e `analysis_pending`. | Linhas vermelhas com motivo "instável" ou "análise pendente". |
| **Buscar resultados pendentes** | Pergunta à V8 se já existe resposta para consultas que enviamos mas o webhook nunca chegou. Não conta como nova tentativa. | Linhas amarelas em "aguardando V8" há +2 min. |

Esses dois botões aparecem **idênticos** na Nova Simulação e no Histórico
(paridade total). No header dos lotes do Histórico há apenas um **badge
informativo** ("N p/ retentar") — clicar nele não dispara nada, é só
indicador visual; a ação fica no botão dentro do lote expandido.


---

## FAQ Operacional — Estado, Pagamentos e Margem (atualização)

### Diferença entre "consulta", "simulação" e "operação"

A V8 (Crédito do Trabalhador) tem **3 etapas distintas** que muitas vezes
são confundidas:

| Etapa | O que é | Onde aparece no LordCred |
|---|---|---|
| **Consulta** (`/private-consignment/consult`) | Verifica se o trabalhador é elegível, retorna **margem disponível**, **limite mínimo/máximo de valor** e **prazo aceito**. | Coluna "Status" da tabela. Status SUCCESS / REJECTED / WAITING_*. |
| **Simulação** (`/private-consignment/simulation`) | Calcula **valor liberado real**, **parcela**, **taxa** com base na consulta aprovada e na tabela escolhida. | Colunas "Liberado", "Parcela" — aparecem apenas após a simulação financeira concluir. |
| **Operação** (`/private-consignment/operation`) | Cria a proposta efetiva (CCB / contrato). | Aba "Consultas" → "Propostas" e tabela `v8_operations_local`. |

Uma linha pode ter **consulta SUCCESS** sem nunca ter **valor liberado**.
Isso significa apenas que o cliente é elegível, ainda não simulamos um
contrato real para ele.

### A "Margem" da tela é enviada para a V8?

**Não.** Existem dois conceitos diferentes com o mesmo nome:

1. **`availableMarginValue`** — vem da V8 no webhook de consulta. É a
   margem consignável disponível do trabalhador. É só leitura.
2. **Margem LordCred** (`company_margin` / `margem_valor`) — é cálculo
   **interno** com o percentual configurado em `v8_margin_config`
   (default 5%). É aplicado sobre o `released_value` retornado pela V8.
   **Não vai no payload da simulação V8.** Só é usado para mostrar
   quanto a empresa cobra acima do valor liberado.

A coluna na tabela é rotulada como **"Margem LordCred"** justamente
para deixar essa diferença explícita.

### Por que linhas em "consulta ativa" às vezes ficam paradas?

O poller `v8-active-consult-poller` faz uma chamada para a V8 por linha,
através da Edge Function `v8-clt-api`. Quando há muitas consultas ativas
ao mesmo tempo, podemos bater no **limite por função do Supabase Edge
Runtime** ou no **rate limit da V8** (HTTP 429 / "Limite de requisições
excedido"). Nesse caso:

- A linha mostra a mensagem clara: *"V8 limitou as consultas. Nova
  tentativa automática em instantes."*
- O `v8_status_snapshot_at` **não é avançado**, então o próximo ciclo
  do cron tentará a mesma linha novamente.
- O usuário também pode forçar manualmente clicando em **"Ver status na
  V8"**: o resultado é gravado direto na linha (não precisa esperar o
  poller).

### Por que aparece "Sem retorno da V8 nessa busca"?

Quando o poller pergunta à V8 e a V8 responde `success` mas sem dados,
gravamos uma marcação amigável. A linha mostra essa frase + botão
"Ver status na V8" para o operador forçar nova consulta manual.


---

## Margem Disponível vs Margem LordCred

Dois conceitos com o mesmo nome — **não confundir**:

| Conceito | Origem | Significado | Onde aparece na UI |
|---|---|---|---|
| **Margem Disponível** (`availableMarginValue`) | V8 (webhook + check_consult_status) | Valor LIVRE mensal que o trabalhador tem para comprometer com nova operação consignada CLT. É a info que o operador usa para qualificar o lead. | Coluna "💰 Margem Disp." (verde) na Nova Simulação e Histórico. Bloco em destaque no topo do modal "Ver status na V8". |
| **Margem LordCred** (`company_margin` / `margem_valor`) — *atenção: o nome da coluna do banco `margem_valor` é usado para a margem da V8, NÃO para a interna* | Cálculo interno LordCred | 5% sobre o `released_value` (configurável). Não é enviado à V8. Indica o quanto a empresa cobra acima do valor liberado. | Coluna "Margem LordCred" nas tabelas e linha "Margem LordCred" no modal. |

⚠️ **Atenção semântica**: a coluna `v8_simulations.margem_valor` armazena o
`availableMarginValue` (margem do TRABALHADOR), não a margem da empresa.
A margem da empresa fica em `company_margin`.

### Onde a margem disponível é extraída

Helper puro: `src/lib/v8MarginExtractor.ts → extractAvailableMargin()`. Tenta
caminhos conhecidos do payload V8 nesta ordem:

1. `availableMarginValue` (raiz — formato webhook)
2. `available_margin_value` (snake_case)
3. `availableMargin`, `marginValue` (aliases)
4. `result.availableMarginValue`, `data.availableMarginValue`, `consult.result.availableMarginValue`
5. `latest.availableMarginValue`, `v8_status_snapshot.latest.availableMarginValue` (snapshot do poller)

Mantenha esta lista sincronizada com:
- `supabase/functions/v8-webhook/index.ts` (extração no webhook)
- `supabase/functions/v8-active-consult-poller/index.ts` (extração no snapshot)

Cobertura: `src/lib/__tests__/v8MarginExtractor.test.ts` (10 testes).

---

## Glossário de Status V8 (UI)

Componente: `src/components/v8/V8StatusGlossary.tsx`. Aparece como um botão
"O que cada status significa?" no header das três abas (Nova Simulação,
Consultas, Histórico).

| Status | Significado | Próxima ação |
|---|---|---|
| `WAITING_CONSENT` | Termo criado, aguardando autorização interna. | Aguardar (sistema autoriza sozinho). |
| `CONSENT_APPROVED` | Termo autorizado, V8 consultando o averbador. | Aguardar resultado. |
| `SUCCESS` | Consulta concluída com margem disponível. | Trabalhar lead / rodar simulação. |
| `REJECTED` | Cliente sem margem ou inelegível. | Descartar lead. |
| `WAITING_*` (outros) | Etapas intermediárias da V8. | Aguardar. |
| `temporary_v8` | Instabilidade ou rate limit da V8. | Botão "Retentar falhados". |
| `analysis_pending` | V8 ainda processando do lado dela. | Aguardar / "Buscar resultados pendentes". |
| `active_consult` | Já existe consulta ativa para o CPF. | Sistema busca status sozinho; manualmente "Ver status na V8". |
