

## Plano: Corrigir Historico de Conversas Vazio e Mensagens Fora de Ordem

### Problema 1: Conversas nao carregam ao logar (sidebar vazia)

A API `fetch-chats` retorna `{"success":true,"chats":[]}` consistentemente. Apos analise detalhada:

**10 causas identificadas:**

1. **Resposta da UazAPI com estrutura diferente**: O `POST /chat/find` pode retornar os chats em um campo diferente de `chats` ou `data`. O codigo tenta `Array.isArray(data) ? data : (data.chats || data.data || [])` mas a UazAPI pode usar outro nome (ex: `results`, `items`, ou retornar diretamente o array na raiz).

2. **Falta de log de debug no fetch-chats**: Diferente do `fetch-messages` que tem `console.log` mostrando o que a UazAPI retornou, o `fetch-chats` NAO tem nenhum log. Impossivel diagnosticar sem ver a resposta real.

3. **Filtro `wa_chatid` eliminando todos os registros**: O filtro `.filter((c: any) => c.wa_chatid && ...)` pode estar descartando TODOS os chats caso a UazAPI retorne o campo com nome diferente (ex: `chatid`, `jid`, `id`) ou caso o campo esteja vazio para chats nao-grupo.

4. **Parametro `sort: 'desc'` pode ser invalido**: A documentacao da UazAPI nao especifica `sort` como parametro aceito para `/chat/find`. Enviar parametros desconhecidos pode causar erro 400 ou resposta vazia.

5. **Campo `page` pode nao ser suportado pelo `/chat/find`**: A paginacao pode usar campos diferentes (`offset`, `skip`, etc). Se `page` nao for reconhecido, a API pode retornar vazio.

6. **Token do chip invalido ou expirado**: O `getChipToken` busca `instance_token` do banco, mas se o token estiver incorreto ou expirado, a UazAPI retorna array vazio em vez de erro.

7. **Cache do localStorage impedindo re-fetch**: Se o cache tem dados vazios ou corrompidos, e a protecao "nao sobrescrever cache com vazio" impede atualizacao, o usuario fica preso.

8. **`getClaims` falhando silenciosamente**: O `auth.getClaims()` pode estar falhando em versoes mais recentes do Supabase client, causando que a edge function retorne erro 401 antes de chegar ao `fetch-chats`.

9. **`response.json()` falhando**: Se a UazAPI retorna resposta nao-JSON ou vazia, o `response.json()` pode lancar excecao que e capturada pelo `catch` global, retornando erro 500 em vez de chats.

10. **Chip recém-conectado sem historico sincronizado**: Ao conectar um WhatsApp pela primeira vez, a UazAPI pode precisar de tempo para sincronizar o historico de chats. As primeiras chamadas a `/chat/find` retornam vazio ate a sincronizacao completar.

### Problema 2: Mensagens fora de ordem

**Causa identificada**: O `messageTimestamp` no schema da UazAPI esta em **milissegundos** (integer). Porem, a resposta real da API retorna um campo `timestamp` como ISO string. O edge function mapeia `m.messageTimestamp` que pode nao existir na resposta, resultando em timestamp `undefined` que se converte para `Invalid Date`. Alem disso, ha um campo `text` na resposta que ja vem do UazAPI e outro campo `text` que o edge function tenta extrair como `m.text`.

A correcao precisa mapear AMBOS os campos possiveis de timestamp.

---

### Correcoes a Implementar

**1. Adicionar logs de debug ao `fetch-chats` no edge function**

No `supabase/functions/uazapi-api/index.ts`, dentro do case `fetch-chats`:
- Adicionar `console.log` para registrar o corpo exato retornado pela UazAPI
- Logar a quantidade de chats antes e depois do filtro
- Logar o body enviado para a API
- Isso permite diagnosticar o problema real na proxima execucao

**2. Corrigir parsing do `fetch-chats` para aceitar multiplos formatos de resposta**

O edge function precisa:
- Tentar mais variantes: `data.results`, `data.items`, `data.records`
- Fazer o filtro de `wa_chatid` mais flexivel: aceitar tambem `chatid`, `jid`, `remoteJid`
- Remover parametro `sort` que pode nao ser aceito
- Adicionar fallback: se nenhum chat encontrado, buscar da tabela `conversations` no Supabase como backup

**3. Corrigir mapeamento de timestamp nas mensagens**

No case `fetch-messages`:
- Priorizar `m.timestamp` (ISO string que ja vem da API) sobre `m.messageTimestamp`
- Se `m.messageTimestamp` existir (integer milissegundos), converter corretamente
- Garantir que o sort final e por timestamp ascendente (mais antiga primeiro)

```text
Antes:
  timestamp: m.messageTimestamp ? new Date(m.messageTimestamp).toISOString() : new Date().toISOString()

Depois:
  timestamp: m.timestamp || (m.messageTimestamp ? new Date(Number(m.messageTimestamp)).toISOString() : new Date().toISOString())
```

**4. Adicionar fallback para carregar conversas do banco**

Se a UazAPI retornar chats vazios, o edge function deve buscar na tabela `conversations`:
```text
Se normalizedChats.length === 0:
  Buscar conversations do Supabase WHERE chip_id = chipId
  Mapear para o formato ChatContact
  Retornar como fallback
```

**5. Corrigir sort no ChatWindow**

O merge de mensagens do cache + API precisa garantir sort consistente por timestamp ISO. Tambem filtrar mensagens com timestamp invalido (`Invalid Date`).

---

### Detalhes Tecnicos

**Arquivos a modificar:**

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/uazapi-api/index.ts` | Adicionar logs no fetch-chats, corrigir parsing de resposta, corrigir mapeamento de timestamp no fetch-messages, adicionar fallback para conversations |
| `src/components/whatsapp/ChatSidebar.tsx` | Adicionar fallback para buscar conversations do Supabase se API retornar vazio |
| `src/components/whatsapp/ChatWindow.tsx` | Filtrar mensagens com timestamp invalido, garantir sort correto |

**Ordem de implementacao:**
1. Adicionar logs + corrigir parsing no edge function (diagnostico + fix)
2. Corrigir mapeamento de timestamp (mensagens fora de ordem)
3. Adicionar fallback para conversations do Supabase (garantir que algo aparece)
4. Deploy e verificacao dos logs

