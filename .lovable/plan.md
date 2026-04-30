
## Problemas Identificados

### 1. v8-webhook QUEBRADO (URGENTE)
O `v8-webhook` está **completamente fora do ar** desde a última alteração. O erro nos logs:
```
Uncaught SyntaxError: Illegal break statement at index.ts:72:11
```
**Causa**: Na linha 108, foi adicionado um `break;` dentro de um bloco `if/else if` que está dentro de um `try`. O `break` só funciona dentro de `switch` ou `for/while`. Isso impede o boot da função -- **nenhum webhook V8 está sendo processado agora**.

**Correção**: Trocar `break;` por uma estrutura que pule o resto do código (ex: usar `processed = true;` e deixar o fluxo cair naturalmente, sem o `break`). O `processed = true` já está na linha 107, então basta remover o `break` da linha 108.

---

### 2. Mensagens Meta não aparecendo

**Ponto 1 (mensagem recebida não aparece)**: Quando você envia uma mensagem PARA o número 5548996159114 (chip Meta cadastrado), a Meta envia um webhook para `meta-webhook`. Possíveis causas:
- O webhook URL pode não estar configurado no Meta Business Manager apontando para `https://sibfqmzsnftscnlyuwiu.supabase.co/functions/v1/meta-webhook`
- O `verify_token` pode estar incorreto
- Vou verificar os logs do `meta-webhook` para confirmar se está recebendo chamadas

**Ponto 2 (envio de mensagem "pisca e volta")**: O envio via Meta Cloud API **sem template** só funciona dentro da **janela de 24h** (o contato precisa ter enviado uma mensagem primeiro). Fora dessa janela, a Meta exige um template aprovado. O gateway já retorna o erro correto, mas pode estar falhando silenciosamente. Vou verificar o fluxo.

---

### 3. Multi-tenancy e Facebook Login (resposta consultiva)

Isso é uma discussão, não requer código agora.

---

## Plano de Implementação (1 etapa)

### Correção do v8-webhook
- **Arquivo**: `supabase/functions/v8-webhook/index.ts` linha 108
- **Ação**: Remover o `break;` (o `processed = true;` já garante que o fluxo encerre corretamente)

### Diagnóstico Meta webhook
- Verificar logs do `meta-webhook` para confirmar se está recebendo webhooks
- Verificar se o webhook URL está configurado corretamente no Meta Business Manager
- Testar o endpoint com `curl` para garantir que está respondendo

### Resposta sobre multi-tenancy
Responder no chat sobre:
- Facebook Login / Embedded Signup (viabilidade)
- Como funciona a cobrança da Meta para múltiplos WABAs
- O que seria necessário para multi-tenancy real

---

## Detalhes Técnicos

### v8-webhook fix
```typescript
// ANTES (linha 105-108):
if ((currentRow as any).error_kind === "canceled_hard") {
  console.log(`[v8-webhook] skipping canceled_hard sim consult_id=${consultId}`);
  processed = true;
  break;  // <-- ILLEGAL: não está em loop/switch
}

// DEPOIS:
if ((currentRow as any).error_kind === "canceled_hard") {
  console.log(`[v8-webhook] skipping canceled_hard sim consult_id=${consultId}`);
  processed = true;
  // Não faz mais nada -- o else abaixo cuida do resto
} else {
  // ... todo o código que vinha depois do if (linhas 110+)
}
```

### Checklist manual
1. Após deploy, verificar nos logs do `v8-webhook` que o boot error sumiu
2. Enviar uma mensagem de teste para o número Meta e verificar se aparece
3. Verificar no Meta Business Manager que o webhook URL está correto
4. Testar envio de mensagem dentro da janela de 24h
