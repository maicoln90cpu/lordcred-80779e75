
Objetivo: corrigir 3 frentes com segurança: (1) badge por chat individual no interno, (2) regras/visão de templates para vendedor e admin, (3) auto-scroll de drag no Kanban pela borda.

### 1) Diagnóstico do badge (mínimo 5 causas prováveis)
1. **Estado duplicado do unread**: `useInternalChatUnread` é instanciado em **WhatsApp**, **DashboardLayout** e **InternalChat**, gerando estados diferentes (header/sidebar vs lista de chats).
2. **Sem persistência de leitura**: unread atual é só em memória (`unreadMap`), então ao trocar rota/recarregar pode perder ou divergir.
3. **Race de membership**: mensagem pode chegar antes de `channelIdsRef` ser carregado (`refreshChannels`), e o evento é descartado.
4. **Conflito de lógica de “lido”**: `markAsRead` roda ao mudar `selectedChannel` via `useEffect`, não exclusivamente no clique explícito do chat.
5. **Conflito entre hooks/Realtime**: canais Realtime com nomes fixos e múltiplas instâncias podem competir/remover inscrição.
6. **Conflito de renderização**: badge por canal depende de `unreadByChannel[ch.id]`; se a instância que renderiza a lista não for a mesma que contou unread, a badge do item não aparece mesmo com total no header/sidebar.

### 2) Plano de implementação

#### Etapa A — Badge por canal confiável (persistente + clique explícito)
**Arquivos**:  
- `supabase/migrations/*` (nova migration)  
- `src/hooks/useInternalChatUnread.ts` (ou provider global)  
- `src/pages/admin/InternalChat.tsx`  
- `src/components/layout/DashboardLayout.tsx`  
- `src/pages/WhatsApp.tsx`  
- `src/App.tsx` (se usar provider único)

**Mudanças**:
1. Adicionar `last_read_at` em `internal_channel_members`.
2. Criar RPC `get_internal_unread_counts()` (SECURITY DEFINER) para calcular unread por canal no servidor.
3. Reidratar unread no mount (não depender só de evento realtime).
4. Tornar “marcar como lido” **apenas no clique do canal** (remover marcação automática no efeito de seleção).
5. Unificar fonte de verdade do unread (provider único no app ou hook singleton) para evitar divergência header/sidebar/lista.

#### Etapa B — Templates: separação para vendedor + correção do admin no reload
**Arquivos**:  
- `src/pages/admin/Templates.tsx`  
- `src/components/whatsapp/TemplatePicker.tsx`  
- `src/contexts/AuthContext.tsx` (ajuste de timing de role)  

**Mudanças**:
1. **Seller**: separar visualmente em 2 blocos:
   - “Meus templates”
   - “Templates da administração” (admin/support/master)
2. Garantir bloqueio de templates de outros vendedores em qualquer cenário.
3. **Admin**: corrigir bug do reload (hoje filtra como seller no primeiro fetch):
   - refetch quando role resolver
   - ou corrigir `AuthContext` para só liberar carregamento após role real.
4. Manter busca/filtro de categoria funcionando nos blocos separados.

Exemplo visual esperado:
```text
Templates (vendedor)
├─ Meus templates (4)
│  ├─ card...
├─ Templates da administração (3)
│  ├─ card...
```

#### Etapa C — Kanban drag com auto-scroll real na borda
**Arquivos**:
- `src/components/whatsapp/KanbanDialog.tsx`
- `src/components/whatsapp/KanbanColumn.tsx`
- `src/components/whatsapp/KanbanCard.tsx` (se necessário para sinal de drag ativo)

**Mudanças**:
1. Trocar auto-scroll “1 frame por dragover” por loop contínuo (`requestAnimationFrame`) enquanto cursor estiver na zona da borda.
2. Detectar direção por proximidade (esquerda/direita) e parar no `drop/dragend`.
3. Garantir `preventDefault` e limpeza correta de listeners para não depender de arrastar sobre a barra horizontal.

### 3) Vantagens / Desvantagens
**Vantagens**
- Badge consistente entre header, sidebar e chat individual.
- Regra de templates previsível por role.
- Drag Kanban muito mais fluido em boards longos.

**Desvantagens / trade-offs**
- Inclui migration e ajuste de leitura por canal (mudança estrutural).
- Pequeno aumento de complexidade no fluxo de unread.
- Ajuste de timing no AuthContext pode afetar carregamento inicial (comportamento mais correto, porém mais estrito).

### 4) Checklist manual (QA)
- [ ] Receber mensagem em canal A, abrir `/chat` e validar badge no item A.
- [ ] Badge só some ao clicar exatamente no canal A.
- [ ] Header/sidebar e item de lista mostram o mesmo total.
- [ ] Seller vê apenas “Meus” + “Administração”; nunca templates de outro seller.
- [ ] Admin ao recarregar `/admin/templates` vê todos os templates sem precisar criar novo.
- [ ] No Kanban, arrastar card da 1ª para última coluna sem usar barra inferior manualmente.

### 5) Próximas fases
1. Adicionar testes de regressão para regras de visibilidade de templates por role.
2. Adicionar telemetria leve para eventos de unread (count before/after click).
3. Revisar warning de render do Kanban (`ref`) em paralelo para eliminar ruído de console.
