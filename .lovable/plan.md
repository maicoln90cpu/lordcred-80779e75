

## Correcao definitiva: nome do contato mostrando nome da instancia

### Causa raiz

No webhook (`evolution-webhook/index.ts`, linha 152), a logica de fallback para `contactName` eh:

```
wa_contactName -> chat.name -> senderName -> recipientPhone
```

Quando a mensagem eh **outgoing** (`fromMe = true`), `msg.senderName` contem o nome da **propria instancia** (ex: "Lord Cred"). Se `wa_contactName` e `chat.name` vierem vazios (comum em mensagens enviadas), o sistema usa "Lord Cred" como nome do contato e salva isso na conversa.

A partir dai, o nome errado fica permanente no banco porque o webhook sempre faz upsert com `contact_name`.

### Correcao

**Arquivo: `supabase/functions/evolution-webhook/index.ts`**

1. **Linha 152** — Para mensagens outgoing, NUNCA usar `senderName` como nome do contato (pois eh o nome da instancia). Usar `recipientPhone` como fallback direto:

```typescript
// Para mensagens outgoing, senderName = nome da instância (ex: "Lord Cred"), NÃO usar como contactName
const contactName = safeString(chat?.wa_contactName) 
  || safeString(chat?.name) 
  || (!isFromMe ? senderName : '') 
  || recipientPhone
```

2. **Protecao extra no upsert (linhas 167-181)** — So sobrescrever `contact_name` se o valor novo for um nome real (nao apenas digitos). Se a conversa ja tem um nome salvo e o novo eh so numero, preservar o existente:

```typescript
// Só sobrescrever contact_name se tiver valor real (não apenas dígitos)
const isRealName = contactName && !/^\d+$/.test(contactName)
if (existing && existing.contact_name && !isRealName) {
  // Preservar nome existente — não sobrescrever com número
  delete upsertData.contact_name
}
```

3. **Correcao de dados existentes** — Adicionar logica para detectar e corrigir conversas cujo `contact_name` eh igual ao nome/numero da propria instancia (chip). Comparar `contactName` com `chip.phone_number` formatado e com o nome do business da instancia. Se bater, substituir pelo numero do contato.

**Arquivo: `supabase/functions/sync-history/index.ts`**

4. Mesma protecao: na linha onde define `contactName`, garantir que `chat.name` nao seja o nome da propria instancia comparando com o phone_number do chip.

### Resultado

- Contatos que hoje mostram "Lord Cred" passarao a mostrar o numero formatado (ex: "+55 42 9113-3545") ate que o nome real seja resolvido via `wa_contactName`
- Novas mensagens outgoing nunca mais vao contaminar o `contact_name` com o nome da instancia
- Deploy necessario da edge function `evolution-webhook`

