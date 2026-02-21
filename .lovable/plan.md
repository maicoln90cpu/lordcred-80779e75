

## Correcao do sync-history - 5 Erros Encontrados

### Resultado da Auditoria

A funcao `sync-history` existe e a UazAPI **SIM possui** os endpoints necessarios para buscar historico:

- `POST /chat/find` - Busca chats com filtros (retorna lista de objetos Chat)
- `POST /message/find` - Busca mensagens de um chat (retorna lista de objetos Message com paginacao)

Porem a funcao possui **5 erros criticos** que impedem o funcionamento:

---

### Erro 1: Coluna `last_sync_at` nao existe na tabela `chips`

A funcao tenta ler e gravar `chips.last_sync_at` (linhas 59 e 203), mas essa coluna **nunca foi criada** no banco de dados. Isso causa erro silencioso no SELECT ou no UPDATE.

**Correcao**: Criar a coluna via migration SQL.

### Erro 2: Metodo `getClaims()` nao existe no Supabase JS v2

Linha 42: `userClient.auth.getClaims(token)` - este metodo nao existe no `@supabase/supabase-js@2`. Isso causa um erro imediato e a funcao retorna 401 ou 500 sem fazer nenhum trabalho.

**Correcao**: Substituir por `userClient.auth.getUser()` que e o metodo correto para validar o token.

### Erro 3: Parsing da resposta do `/chat/find` pode falhar

A funcao tenta `chatsResponse?.chats || chatsResponse?.data` mas a UazAPI pode retornar a lista diretamente como array, ou usar a chave `results`. A documentacao mostra que o schema Chat tem campos como `wa_chatid`, `wa_contactName`, etc.

**Correcao**: Adicionar mais fallbacks na extracao do array: `chatsResponse?.results || chatsResponse?.items`.

### Erro 4: Parsing da resposta do `/message/find` pode falhar

Similar ao erro 3 - a funcao tenta `msgData?.messages || msgData?.data` mas a UazAPI retorna "Lista de mensagens encontradas com metadados de paginacao". A chave real pode ser diferente.

**Correcao**: Adicionar fallbacks e logs detalhados para debug: `msgData?.results || msgData?.items`.

### Erro 5: `messageTimestamp` pode estar em segundos vs milissegundos

A documentacao diz `messageTimestamp integer - Timestamp original da mensagem em milissegundos`, mas na pratica a UazAPI pode retornar em segundos. O codigo ja tenta tratar isso (linha 163-164) mas o threshold `10000000000` pode nao ser robusto o suficiente.

**Correcao**: Manter a logica mas adicionar log para debug.

---

### Plano de Correcao

#### 1. Migration SQL - Adicionar coluna `last_sync_at`

```text
ALTER TABLE public.chips ADD COLUMN IF NOT EXISTS last_sync_at timestamptz DEFAULT NULL;
```

#### 2. Reescrever `sync-history/index.ts`

Alteracoes:
- Substituir `getClaims(token)` por `getUser()` para validacao de autenticacao
- Adicionar logs detalhados em cada etapa (fetch chats, parse response, fetch messages, upsert)
- Adicionar fallbacks robustos para extrair arrays de respostas: tentar array direto, depois `results`, `items`, `chats`, `data`, `messages`
- Logar a quantidade de chats/mensagens encontradas em cada passo
- Logar erros de HTTP da UazAPI (status code, body de erro)
- Remover o skip de 5 minutos para permitir sincronizacao manual via botao (ou reduzir para 1 minuto)

#### 3. Atualizar frontend para mostrar resultado detalhado

No `WhatsApp.tsx`, ao receber resposta do sync, mostrar toast com detalhes:
- "X conversas e Y mensagens sincronizadas" em vez de apenas "Sincronizacao concluida"
- Se synced = 0, mostrar "Nenhuma mensagem nova encontrada" ou o motivo real

---

### Detalhes Tecnicos

| # | Arquivo | Alteracao |
|---|---------|-----------|
| 1 | Migration SQL | `ALTER TABLE chips ADD COLUMN last_sync_at` |
| 2 | `sync-history/index.ts` | Corrigir auth (`getUser`), adicionar logs, fallbacks de parsing, remover skip de 5min para sync manual |
| 3 | `WhatsApp.tsx` | Mostrar resultado detalhado do sync no toast |
