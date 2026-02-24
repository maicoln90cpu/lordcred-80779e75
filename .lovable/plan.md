
## Normalizar DDI 55 em todos os pontos de entrada

### Problema
Tres locais criam conversas ou enviam mensagens sem normalizar o numero com DDI 55:

1. **`send-message`** no edge function (envio avulso) - usa `phoneNumber` direto sem prefixar 55
2. **`handleStartNewChat`** no `WhatsApp.tsx` - cria JID com numero sem DDI
3. **`handleStartNewChat`** no `ChatSidebar.tsx` - mesma situacao

### Alteracoes

**1. `supabase/functions/uazapi-api/index.ts` — caso `send-message` (linha ~266)**

Adicionar normalizacao antes do envio:
```
let normalizedPhone = phoneNumber.replace(/\D/g, '')
if (normalizedPhone.length === 10 || normalizedPhone.length === 11) {
  normalizedPhone = '55' + normalizedPhone
}
```
Usar `normalizedPhone` no body do fetch em vez de `phoneNumber`.

**2. `src/pages/WhatsApp.tsx` — `handleStartNewChat` (linha ~199)**

Apos extrair `digits`, normalizar:
```
let normalized = digits;
if (normalized.length === 10 || normalized.length === 11) {
  normalized = '55' + normalized;
}
const jid = `${normalized}@s.whatsapp.net`;
```
Usar `normalized` tambem no `contact_phone` e demais campos.

**3. `src/components/whatsapp/ChatSidebar.tsx` — `handleStartNewChat` (linha ~1071)**

Mesma normalizacao:
```
let normalized = phoneNumber.replace(/\D/g, '');
if (normalized.length === 10 || normalized.length === 11) {
  normalized = '55' + normalized;
}
const jid = `${normalized}@s.whatsapp.net`;
```

### Resumo

| Arquivo | Local | Alteracao |
|---|---|---|
| `uazapi-api/index.ts` | caso `send-message` | Prefixar 55 em numeros com 10-11 digitos |
| `WhatsApp.tsx` | `handleStartNewChat` | Normalizar digits antes de criar JID |
| `ChatSidebar.tsx` | `handleStartNewChat` | Normalizar phoneNumber antes de criar JID |

Isso garante que todo numero brasileiro sem DDI seja tratado como 55+DDD+telefone em todos os fluxos do sistema.
