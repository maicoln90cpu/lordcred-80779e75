

## Plano: Bidirecionalidade completa + Desativar sync historico

### Parte 1: Desativar sync-history (puxar apenas ultimas 24h)

Modificar a edge function `sync-history` para limitar mensagens sincronizadas a apenas 24 horas antes da implantacao do sistema, em vez dos 10 dias atuais.

**Arquivo**: `supabase/functions/sync-history/index.ts`

- Alterar `tenDaysAgo` para `oneDayAgo` (24 horas): `Date.now() - 24 * 60 * 60 * 1000`
- Isso efetivamente "desativa" a sincronizacao massiva mantendo apenas mensagens muito recentes

Alem disso, remover o auto-trigger de sync ao selecionar chip no frontend:

**Arquivo**: `src/pages/WhatsApp.tsx`

- Na funcao `handleSelectChip`, comentar/remover a chamada `runStagedSync(id)` (linha 135)
- O sync so sera executado via botao manual "Sincronizar mensagens"

### Parte 2: Bidirecionalidade completa de todas as acoes

Atualmente ja sao bidirecionais:
- Mark as read (plataforma -> WhatsApp via `/chat/read` + DB)
- Envio de mensagens (plataforma -> WhatsApp + webhook volta)
- Status updates (WhatsApp -> plataforma via webhook `messages_update`)
- Unread count (WhatsApp -> plataforma via webhook `chats`)

Acoes que precisam de bidirecionalidade adicional:

#### 2a. Deletar mensagem - atualizar DB local

**Arquivo**: `src/components/whatsapp/ChatWindow.tsx`

Atualmente `confirmDelete` chama `uazapi-api` com `action: 'delete-message'` mas nao remove do banco local. Adicionar:
- Apos sucesso do delete na UazAPI, fazer `DELETE` ou `UPDATE` no `message_history` para marcar como deletada
- Atualizar o state local `setMessages` para remover a mensagem

#### 2b. Editar mensagem - atualizar DB local

**Arquivo**: `src/components/whatsapp/ChatWindow.tsx`

Atualmente `confirmEdit` chama UazAPI mas nao atualiza `message_history`. Adicionar:
- Apos sucesso, fazer `UPDATE` em `message_history` com novo `message_content`
- O state local ja esta sendo atualizado (linha 416-418)

#### 2c. Reagir a mensagem - nenhuma acao adicional necessaria

As reacoes sao enviadas a UazAPI e nao tem storage local. Funciona corretamente.

#### 2d. Arquivar/desarquivar - ja e 100% local

Arquivamento e local no banco `conversations.is_archived`. Nao precisa de acao UazAPI.

#### 2e. Fixar/desafixar - ja e 100% local

Fixacao e local no banco `conversations.is_pinned`. Nao precisa de acao UazAPI.

#### 2f. Webhook: processar delecao e edicao vindas do WhatsApp

**Arquivo**: `supabase/functions/evolution-webhook/index.ts`

A UazAPI pode enviar eventos de `messages_update` com estados especiais para edicao/delecao. Adicionar tratamento:
- Se o estado indicar delecao (ex: `revoked`, `deleted`), marcar mensagem como deletada no `message_history`
- Se o payload contiver texto editado, atualizar `message_content` no `message_history`

### Parte 3: Adicionar RLS policy para UPDATE em message_history

Atualmente `message_history` nao permite UPDATE pelo usuario. Precisamos adicionar uma migration:

```sql
CREATE POLICY "Users can update their own messages"
  ON public.message_history
  FOR UPDATE
  USING (chip_id IN (SELECT id FROM chips WHERE user_id = auth.uid()))
  WITH CHECK (chip_id IN (SELECT id FROM chips WHERE user_id = auth.uid()));
```

### Resumo das alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `sync-history/index.ts` | Limitar a 24h, nao 10 dias |
| `WhatsApp.tsx` | Remover auto-sync ao selecionar chip |
| `ChatWindow.tsx` | Delete e edit atualizarem `message_history` no banco |
| `evolution-webhook/index.ts` | Processar delecao/edicao vindas do WhatsApp |
| Migration SQL | RLS policy UPDATE em `message_history` |

### Secao tecnica

A RLS policy de UPDATE e necessaria porque o `ChatWindow.tsx` usa o `supabase` client (anon key) para atualizar mensagens. Sem essa policy, o update sera bloqueado silenciosamente.

Para o delete de mensagens, em vez de DELETE fisico (que tambem precisaria de policy), faremos UPDATE do `message_content` para `'[Mensagem apagada]'` e `status` para `'deleted'`, reutilizando a mesma policy de UPDATE.

