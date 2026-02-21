

## Correcao de 5 Problemas Criticos - Diagnostico dos Logs

### Diagnostico Completo

#### Problema Raiz 1: UNIQUE CONSTRAINT faltando (causa de 0 mensagens sincronizadas)
Os logs mostram claramente o erro:
```
Upsert error for 5511999136884@s.whatsapp.net: there is no unique or exclusion constraint matching the ON CONFLICT specification
```
A migration anterior criou um **indice parcial** (`CREATE UNIQUE INDEX ... WHERE message_id IS NOT NULL`) mas o Supabase JS `upsert({ onConflict: 'chip_id,message_id' })` requer uma **UNIQUE CONSTRAINT real** na tabela, nao apenas um indice parcial. Resultado: **TODAS as mensagens do sync-history falham no upsert**, zero mensagens sincronizadas.

#### Problema Raiz 2: Conversas validas arquivadas incorretamente (116 arquivadas)
A logica de orfaos compara as conversas do banco contra apenas 50 chats retornados pelo `/chat/find`. Qualquer conversa que existe no banco mas nao esta nos 50 primeiros chats e marcada como arquivada. Com 150+ conversas no banco e apenas 50 retornadas, ~100 conversas validas foram arquivadas erroneamente.

#### Problema Raiz 3: Grupos deletados (COMPRA E VENDA) nao arquivados
Esses grupos ESTAO nos 50 chats retornados pela UazAPI (a UazAPI mantem o historico mesmo apos o usuario sair). O campo `wa_isGroup_member: false` indica que o usuario nao esta mais no grupo, mas a logica atual ignora esse campo.

#### Problema Raiz 4: mark-read falhando ("Missing number in payload")
Os logs de rede mostram:
```
Response: {"success":true,"data":{"error":"Missing number in payload"}}
```
O codigo envia `{ chatid: chatId }` para `/chat/read`, mas a UazAPI espera `{ number: chatId }`. Sem mark-read funcionando, o `unread_count` nunca e resetado na UazAPI.

#### Problema Raiz 5: Badge +99 incorreto
Combinacao dos problemas 2 e 4: o `unread_count` nunca e zerado (mark-read falha) e o sync importa contagens altas da UazAPI sem correcao.

---

### Plano de Correcao

#### 1. Migration SQL: Criar UNIQUE CONSTRAINT real

Remover o indice parcial e criar uma constraint UNIQUE real em `(chip_id, message_id)`.

```text
-- Drop the partial index that doesn't work with upsert
DROP INDEX IF EXISTS idx_message_history_chip_msgid;

-- Create a real UNIQUE constraint
ALTER TABLE public.message_history 
  ADD CONSTRAINT message_history_chip_message_unique 
  UNIQUE (chip_id, message_id);
```

Nota: mensagens com `message_id = NULL` nao serao afetadas pela constraint (NULLs sao sempre unicos em PostgreSQL).

#### 2. sync-history: Corrigir logica de orfaos

- Aumentar o limite de `/chat/find` para 200 (ou nao limitar) para capturar mais chats
- Antes de arquivar, verificar se a conversa tem atividade recente (ultimos 7 dias) - se sim, NAO arquivar mesmo que nao esteja na lista
- Para grupos: verificar `wa_isGroup_member === false` e marcar como arquivado

#### 3. sync-history: Detectar grupos que o usuario saiu

Ao processar cada chat da UazAPI, verificar:
- Se `wa_isGroup === true` E `wa_isGroup_member === false` -> marcar como `is_archived = true`
- Nao fazer upsert como conversa ativa

#### 4. uazapi-api: Corrigir mark-read

Mudar o body de `{ chatid: chatId }` para `{ number: chatId }` conforme esperado pela UazAPI.

#### 5. Desarquivar conversas validas

A migration deve desarquivar conversas que foram arquivadas erroneamente na ultima sincronizacao.

---

### Detalhes Tecnicos

| # | Arquivo | Alteracao |
|---|---------|-----------|
| 1 | Migration SQL | DROP partial index, ADD UNIQUE constraint, desarquivar conversas |
| 2 | `sync-history/index.ts` | Aumentar limit para 200, corrigir logica orfaos com verificacao de atividade recente, detectar grupos que o usuario saiu |
| 3 | `uazapi-api/index.ts` | Corrigir mark-read: `chatid` -> `number` |
| 4 | Deploy edge functions | Redeployar sync-history e uazapi-api |

