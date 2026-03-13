
Diagnóstico completo (confirmado no código + banco):

1) Causa raiz principal: Realtime do chat interno está “desligado” na prática  
- `public.internal_messages`, `public.internal_channels` e `public.internal_channel_members` NÃO estão na publication `supabase_realtime`.  
- Resultado direto: não chegam eventos `INSERT` no frontend, então:
  - mensagem não aparece instantaneamente no outro navegador;
  - badge não incrementa;
  - toast não dispara;
  - som não toca.

2) Badge/notify hoje dependem 100% de evento realtime  
- `useInternalChatUnread` só incrementa por evento `INSERT`; sem evento, fica sempre 0.

3) Nome do remetente “Usuário” ocorre por fallback frágil no estado de mensagem  
- Em alguns cenários a mensagem entra sem `user_name/user_email` resolvido e permanece assim até refresh.

4) Há risco de comportamento inconsistente por assinaturas duplicadas e sem fallback  
- Layout + página podem assinar eventos diferentes sem estratégia única de reconexão/backup.

Plano de correção (ordem de implementação):

Etapa A — Hotfix de infraestrutura Realtime (prioridade máxima)
- Criar migration idempotente para:
  - adicionar tabelas internas à `supabase_realtime` publication;
  - garantir `REPLICA IDENTITY FULL` em `internal_messages` (manter).
- SQL (idempotente via `DO $$ ... $$` com checagem em `pg_publication_tables`):
  - `ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_messages;`
  - `ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_channels;`
  - `ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_channel_members;`

Etapa B — Tornar badge/toast/som confiáveis em todas as telas
- Refatorar `useInternalChatUnread` para fluxo robusto:
  - manter assinatura realtime única por instância;
  - tratar status de subscribe (`SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT`) com retry;
  - tocar som + toast no mesmo ponto de evento;
  - adicionar fallback de polling curto (ex.: 2–3s) quando canal realtime falhar.
- Manter uso em:
  - `DashboardLayout` (badge sidebar /chat),
  - `WhatsApp` header (badge no ícone de chat interno).

Etapa C — Mensagem instantânea no /chat (sem refresh)
- Em `InternalChat.tsx`:
  - reforçar subscription do canal selecionado com reconexão e deduplicação por `id`;
  - envio otimista com rollback em erro (remover placeholder se insert falhar);
  - atualizar preview de última mensagem imediatamente após envio/recebimento.
- Remover sobreposição de lógica de notificação que possa conflitar com o hook global (evitar duplicidade/inconsistência).

Etapa D — Corrigir exibição de remetente para vendedores
- Em `InternalChat.tsx`:
  - resolver nome no render usando `profilesMap[msg.user_id]` (não só valores “congelados” no momento do insert realtime);
  - fallback obrigatório: `name -> emailPrefix -> 'Usuário'`.
- Após carregar/atualizar perfis, reidratar mensagens já no estado para substituir “Usuário” quando houver dados.

Etapa E — Validação funcional end-to-end (obrigatória)
```text
Cenário 1 (instantâneo):
Admin A envia -> Vendedor B já no /chat (mesmo canal) vê mensagem sem refresh.

Cenário 2 (notificação):
Admin A envia -> Vendedor B em /whatsapp recebe:
- badge no ícone de chat interno,
- toast no canto inferior direito,
- som.

Cenário 3 (sidebar):
Admin/Vendedor em telas com DashboardLayout recebe badge em "Chat Interno".

Cenário 4 (remetente):
Mensagens do admin aparecem com nome/email, nunca “Usuário” (salvo ausência real de dados).
```

Arquivos que serão alterados:
- `supabase/migrations/*_internal_chat_realtime_publication.sql` (novo)
- `src/hooks/useInternalChatUnread.ts`
- `src/pages/admin/InternalChat.tsx`
- `src/components/layout/DashboardLayout.tsx` (ajuste fino de badge, se necessário)
- `src/pages/WhatsApp.tsx` (ajuste fino de badge, se necessário)

Resultado esperado após implementação:
- Chat interno realmente em tempo real;
- badge funcional para admin e vendedor;
- toast e som funcionando;
- mensagem aparecendo instantaneamente no destinatário;
- remetente identificado corretamente.
