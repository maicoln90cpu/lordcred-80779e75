# Guia rápido — Códigos de status HTTP

Toda integração externa (V8, UazAPI, Meta, ClickSign, NewCorban) responde com
um número de 3 dígitos chamado **status HTTP**. Esse número diz se a chamada
deu certo, se você mandou algo errado, ou se o servidor do parceiro caiu.

Pense em uma loja:
- **2xx** — você pediu, a loja entregou. Sucesso.
- **3xx** — a loja te mandou pra outro endereço. Redirecionamento.
- **4xx** — você fez algo errado no pedido (faltou nome, cartão recusado, loja não atende esse CEP).
- **5xx** — a loja teve um problema interno (caixa caiu, sistema fora do ar). Você não fez nada de errado.

---

## 2xx — Sucesso

| Código | Nome | Significado prático |
|---|---|---|
| **200** | OK | Pediu, recebeu. Padrão de sucesso. |
| **201** | Created | Criou um recurso novo (ex.: nova simulação V8). |
| **202** | Accepted | Aceitou o pedido, vai processar depois (típico em filas). |
| **204** | No Content | Sucesso, mas não devolveu corpo (ex.: DELETE bem sucedido). |

> **Ação:** nada a fazer. O sistema seguiu em frente.

---

## 3xx — Redirecionamento

| Código | Nome | Significado prático |
|---|---|---|
| 301 | Moved Permanently | URL antiga, use a nova daqui pra frente. |
| 302 / 307 | Found / Temporary Redirect | Use outra URL desta vez. |
| 304 | Not Modified | Nada mudou desde a última consulta (cache). |

> **Ação:** raramente exigem intervenção — `fetch` segue o redirect automaticamente.

---

## 4xx — Erro do cliente (você mandou algo errado)

| Código | Nome | Causa típica no LordCred |
|---|---|---|
| **400** | Bad Request | Payload mal formado. Ex.: `signerPhone.phoneNumber` faltando, data fora do formato. |
| **401** | Unauthorized | Token expirou, credencial errada, falta `Authorization`. |
| **403** | Forbidden | Token válido, mas sem permissão pra esse recurso. |
| **404** | Not Found | URL ou ID não existe (ex.: `consult_id` apagado). |
| **409** | Conflict | Já existe um registro com esse identificador. |
| **422** | Unprocessable Entity | Payload válido mas regra de negócio rejeitou (ex.: CPF fora de cobertura). |
| **429** | Too Many Requests | Você passou do rate limit. Espere e tente menos vezes por minuto. |

> **Ação:** olhar o body da resposta — quase sempre o parceiro diz **qual campo**
> está errado. O LordCred grava esse texto no `audit_logs.details.response_summary`
> e mostra na coluna "Erro" do histórico.

---

## 5xx — Erro do servidor (problema do parceiro)

| Código | Nome | Significado prático |
|---|---|---|
| **500** | Internal Server Error | O servidor do parceiro quebrou processando seu pedido. Genérico. |
| **502** | Bad Gateway | Há um proxy/CDN no caminho e o servidor real não respondeu. |
| **503** | Service Unavailable | O serviço está fora do ar ou sobrecarregado. **Tente novamente em alguns segundos.** |
| **504** | Gateway Timeout | O proxy esperou demais por uma resposta interna e desistiu. |
| **507** | Insufficient Storage | Falta espaço no servidor (raro). |

> **Ação:** **NÃO é problema do LordCred** — é instabilidade do parceiro
> (V8/Auth0/UazAPI/ClickSign). O sistema já trata isso com `v8FetchWithRetry`
> (até 3 tentativas com backoff exponencial 500ms / 1500ms). Se persistir,
> esperar 5–10min e tentar de novo. Se durar mais que 30min, abrir chamado com
> o parceiro citando data/hora exata para que eles cruzem com o log deles.

---

## Como ver o status no LordCred

1. **Logs de Auditoria** (`/admin/audit-logs`) — coluna **Status** mostra o
   código retornado em cada chamada V8/UazAPI/etc.
2. **Diagnóstico de Webhooks** (`/admin/webhook-diagnostics`) — agrupa entregas
   recebidas por código e por hora.
3. **Console do navegador** (F12 → Network) — útil em tempo de
   desenvolvimento.

---

## Resumo de 1 linha

> **2xx = ok • 3xx = mudou de endereço • 4xx = você errou • 5xx = eles erraram.**
