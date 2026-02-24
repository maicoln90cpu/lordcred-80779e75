

## Correcao de 2 bugs

### Bug 1: Numeros sem DDI 55 nao enviam mensagem

**Causa**: No edge function `uazapi-api`, o caso `send-chat-message` (linha 475) extrai o numero do JID removendo `@s.whatsapp.net` e caracteres nao-numericos, mas nao verifica se o numero tem o DDI 55. Numeros com apenas DDD+telefone (10-11 digitos, ex: `11999136884`) sao enviados sem o prefixo internacional, e a UazAPI rejeita.

**Solucao**: Adicionar normalizacao no edge function: se o numero resultante tem 10 ou 11 digitos (DDD + telefone brasileiro), prefixar com `55`.

**Arquivo**: `supabase/functions/uazapi-api/index.ts` (linha ~475)

```text
Antes:  const targetNumber = (chatId || phoneNumber || '').split('@')[0].replace(/\D/g, '')
Depois: let targetNumber = (chatId || phoneNumber || '').split('@')[0].replace(/\D/g, '')
        if (targetNumber.length === 10 || targetNumber.length === 11) {
          targetNumber = '55' + targetNumber
        }
```

Aplicar a mesma normalizacao nos casos `send-media` e `send-presence` para consistencia.

---

### Bug 2: Mensagem aparece duplicada na tela ao enviar

**Causa**: Quando o envio tem sucesso (`response.data?.success === true`), o codigo NAO remove a mensagem temporaria (`temp-XXX`). A expectativa era que o handler de realtime (linha 231-239) removesse o temp ao receber o INSERT do banco. Porem, existe uma race condition: se o realtime event chega ANTES do `setSending(false)` mas DEPOIS do React processar o batch de estado, ou se ha latencia no realtime, a mensagem temp e a mensagem real coexistem brevemente. Alem disso, se o realtime event demora mais de 10 segundos, a condicao de timeout (linha 233) deixa o temp no estado permanentemente.

**Solucao**: Ao receber sucesso do envio, remover imediatamente a mensagem temporaria. O realtime handler adicionara a mensagem real do banco logo em seguida.

**Arquivo**: `src/components/whatsapp/ChatWindow.tsx` (apos linha 357)

Adicionar remocao do temp message no caminho de sucesso:

```text
if (!response.data?.success) {
  // ... tratamento de erro existente ...
  setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
} else {
  // Sucesso: remover temp imediatamente, realtime adicionara a mensagem real
  setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
}
```

Isso pode ser simplificado removendo o temp SEMPRE apos a resposta (sucesso ou erro), movendo a remocao para o bloco `finally`.

---

### Resumo de alteracoes

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/uazapi-api/index.ts` | Normalizar numeros com 10-11 digitos adicionando prefixo `55` nos casos `send-chat-message`, `send-media`, `send-presence` |
| `src/components/whatsapp/ChatWindow.tsx` | Remover mensagem temporaria no bloco `finally` do `handleSend` (em vez de apenas no erro) |

