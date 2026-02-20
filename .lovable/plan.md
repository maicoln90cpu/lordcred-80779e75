

## Plano: Corrigir 3 Bugs Criticos no WhatsApp

### Bug 1: Conversas duplicadas (cada mensagem cria um novo chat)

**Causa raiz**: O webhook `handleUazapiMessage` no `evolution-webhook/index.ts` faz:
```text
.select('id').eq('chip_id', chip.id).eq('remote_jid', remoteJid).single()
```
Quando duas mensagens chegam simultaneamente, ambas nao encontram registro existente e ambas fazem INSERT. Nao existe constraint UNIQUE em `(chip_id, remote_jid)` na tabela `conversations`.

**Resultado no banco**: Nilso tem **25 linhas duplicadas** para o mesmo chip+remoteJid. Ju tem 10 duplicatas.

**Correcao**:
1. Adicionar constraint UNIQUE em `(chip_id, remote_jid)` na tabela `conversations` via migracao
2. Antes da migracao, limpar duplicatas mantendo apenas o registro mais recente por `(chip_id, remote_jid)`
3. No webhook, trocar `.single()` por `.maybeSingle()` e usar UPSERT (`onConflict: 'chip_id,remote_jid'`) em vez de INSERT separado

### Bug 2: Sidebar mostra chats de outro chip

**Causa raiz**: No `ChatSidebar.tsx`, quando `fetch-chats` retorna `apiChats.length === 0` (linhas 72-76), o codigo NAO limpa o estado `chats`. Os chats do chip anterior permanecem visiveis.

O fluxo:
1. Usuario seleciona chip 2 -> chats do chip 2 carregam corretamente
2. Usuario troca para chip 1 -> useEffect (linha 27) tenta carregar cache do chip 1
3. Cache do chip 1 esta vazio -> `setChats([])` executa (correto)
4. `fetchChats()` chama API -> API retorna 0 chats da UazAPI -> fallback DB retorna 2 conversas
5. Mas... o `apiChats.length > 0` (2 chats) deveria funcionar. O problema real e que o chip 1 (554898119529) tem apenas 2 conversas no banco mas a sidebar mostra Ju, Nilso etc que pertencem ao chip 2

Investigacao adicional: o `getChipToken` no edge function busca o token pelo `chipId`. Se os dois chips compartilham o mesmo token ou se o chipId esta sendo enviado incorretamente, a API retorna dados do chip errado.

**Correcao**: Forcar `setChats([])` quando `apiChats.length === 0` na linha 73 do `ChatSidebar.tsx`, para garantir que dados antigos sejam limpos mesmo que a API retorne vazio.

### Bug 3: Mensagens fora de contexto dentro do chat

**Causa raiz**: Consequencia direta do Bug 1 e 2. Se o chat selecionado pertence ao chip errado, o `fetch-messages` busca mensagens usando o `remoteJid` correto mas o `chipId` errado, mostrando "sem mensagens" ou mensagens de outra conversa.

---

### Detalhes Tecnicos

**Migracao SQL** (nova migracao):
```text
-- Limpar duplicatas: manter apenas o mais recente por (chip_id, remote_jid)
DELETE FROM conversations 
WHERE id NOT IN (
  SELECT DISTINCT ON (chip_id, remote_jid) id 
  FROM conversations 
  ORDER BY chip_id, remote_jid, last_message_at DESC NULLS LAST
);

-- Adicionar constraint unica
ALTER TABLE conversations 
ADD CONSTRAINT conversations_chip_remote_unique 
UNIQUE (chip_id, remote_jid);
```

**Arquivo: `supabase/functions/evolution-webhook/index.ts`**:
- Trocar a logica de SELECT + INSERT/UPDATE por UPSERT:
  - Usar `adminClient.from('conversations').upsert({ chip_id, remote_jid, ... }, { onConflict: 'chip_id,remote_jid' })`
  - Isso elimina a race condition completamente
- Aplicar o mesmo pattern em `handleUazapiChat`

**Arquivo: `src/components/whatsapp/ChatSidebar.tsx`**:
- Linha 72-76: quando `apiChats.length === 0`, forcar `setChats([])` e limpar cache para o chip
- Isso garante que ao trocar de chip, se o novo chip nao tem conversas, a sidebar fica vazia em vez de mostrar dados do chip anterior

**Arquivo: `supabase/functions/uazapi-api/index.ts`** (fetch-chats DB fallback):
- Adicionar deduplicacao no fallback: agrupar por `remote_jid` e pegar apenas o mais recente (para funcionar mesmo antes da migracao rodar)

---

### Ordem de implementacao

1. Criar migracao SQL para limpar duplicatas e adicionar UNIQUE constraint
2. Corrigir webhook para usar UPSERT (previne futuras duplicatas)
3. Corrigir ChatSidebar para limpar estado quando API retorna vazio
4. Adicionar deduplicacao no fallback do edge function
5. Deploy do edge function

| Arquivo | Alteracao |
|---------|-----------|
| Nova migracao SQL | Limpar duplicatas + UNIQUE constraint |
| `evolution-webhook/index.ts` | UPSERT em vez de SELECT+INSERT |
| `ChatSidebar.tsx` | Forcar limpeza quando API retorna vazio |
| `uazapi-api/index.ts` | Deduplicar no fallback DB |
