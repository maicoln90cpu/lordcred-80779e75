
Problema real (reformulado):
O contador de não lidas está “oscilando” (ex.: 1 mensagem real, badge sobe para 4 e depois cai para 2) por combinação de inconsistência backend + sincronização frontend com estratégias diferentes de cálculo.

Arquivos isolados onde o erro nasce:
- `supabase/functions/evolution-webhook/index.ts`
- `supabase/functions/uazapi-api/index.ts`
- `supabase/functions/instance-maintenance/index.ts`
- `src/pages/WhatsApp.tsx`
- `src/components/whatsapp/ChatSidebar.tsx`
- `src/components/whatsapp/ChatWindow.tsx`

Evidências encontradas:
1) No webhook, há duas fontes competindo pelo `unread_count`:
- `messages` incrementa (`+1`) em `handleUazapiMessage`.
- `chats` sobrescreve com `wa_unreadCount` em `handleUazapiChat`.
Isso permite saltos (1→4→2) quando a UazAPI manda snapshots variáveis.

2) Logs mostram eventos `chats` duplicados/repetidos no mesmo segundo para o mesmo chat (inclusive múltiplas vezes).

3) `check-status` auto-configura webhook toda vez (`uazapi-api`) e `instance-maintenance` também reconfigura; isso aumenta risco de múltiplas entregas do mesmo evento.

4) Frontend usa caminhos diferentes:
- chip inativo: `WhatsApp.tsx` (watcher global + soma no banco)
- chip ativo: `ChatSidebar.tsx` recalcula por lista carregada + updates otimistas
Isso gera diferenças visuais e quedas bruscas ao trocar de chip.

5) `ChatWindow.tsx` marca como lido ao abrir chat, mas mensagens que chegam enquanto chat já está aberto podem continuar incrementando até próxima ação de leitura/sincronização.

Do I know what the issue is?
Sim. O núcleo é: concorrência de fontes de unread + eventos duplicados + sincronizações frontend não unificadas.

Plano de correção (definitivo):
1) Unificar regra de `unread_count` no backend
- `messages` vira fonte principal para incremento.
- `chats` NÃO sobrescreve livremente; usar apenas para correção controlada (principalmente redução/zeramento), com guardas anti-spike.

2) Blindar contra duplicidade de eventos `chats`
- Ignorar updates idênticos em janela curta (mesmo `chip_id`, `wa_chatid`, `wa_lastMsgTimestamp`, `wa_unreadCount`).
- Só fazer update quando houver mudança material.

3) Parar re-registro agressivo de webhook
- Remover auto-configuração de webhook de `check-status`.
- Em manutenção, validar configuração atual antes de regravar.
- Manter configuração somente em pontos de conexão/reconexão.

4) Unificar contagem no frontend
- `unreadCounts` sempre por agregação absoluta no banco (não por lista carregada).
- `ChatSidebar` deixa de publicar total derivado de página local.
- Remover dupla atualização otimista (hoje existe no sidebar e no parent).

5) Leitura consistente no chat ativo
- Ao receber mensagem em conversa aberta, disparar `mark-read` com debounce e manter badge zerado localmente.
- Cobrir `remoteJid`/`alternateJid` para evitar zerar conversa errada.

6) Correção de dados já “sujos”
- Criar rotina de ressincronização de unread por chip (snapshot da UazAPI `chat/find` → update controlado em `conversations`), para limpar contadores históricos inflados.

Limitações reais da UazAPI (e o que não tem 100% de garantia):
- Eventos `chats` podem chegar repetidos e com snapshots transitórios; isso é limitação da origem.
- Sem evento de “read receipt” granular e confiável por mensagem em todos os cenários/dispositivos, a leitura perfeita em tempo real depende de heurística.
- Solução prática: modelo híbrido robusto (incremento local por `messages` + reconciliação controlada por `chats`), que elimina variações visíveis indevidas.

Validação após implementação:
- Cenário 1: ficar no chip A, receber 1 msg no chip B → badge do B sobe exatamente 1.
- Cenário 2: trocar para chip B sem abrir conversa → badge mantém valor correto (sem queda artificial).
- Cenário 3: abrir conversa com não lidas → badge zera em tempo curto e estável.
- Cenário 4: repetir com rajada de mensagens e com troca rápida de chips.
- Teste end-to-end obrigatório com logs do `evolution-webhook` e valores de `conversations.unread_count` lado a lado.
