

## Correcao de 3 bugs na sidebar de conversas

### Bug 1: Menu de 3 pontos nao aparece

O menu esta configurado com `opacity-0 group-hover:opacity-100` (linha 677), mas o `div` absoluto pode estar sendo bloqueado pelo `button` que ocupa toda a largura. Adicionar `z-10` ao container absoluto para garantir que fique acima do botao.

Alem disso, o console mostra warning "Function components cannot be given refs" no DropdownMenu. Isso nao deve ser a causa, mas o `z-10` resolve o problema de sobreposicao.

**Arquivo**: `src/components/whatsapp/ChatSidebar.tsx`, linha 677

Mudar de:
```
<div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
```
Para:
```
<div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
```

### Bug 2: Horario nao aparece ao lado das mensagens

O `formatTime` (linha 455) retorna string vazia quando `lastMessageAt` e null. Muitas conversas sincronizadas podem ter `last_message_at` preenchido mas `lastMessage` vazio, ou vice-versa. O timestamp JA esta sendo renderizado na linha 649-651, dentro do flex entre o nome e o horario. O problema e que o span do horario nao tem `ml-auto` nem largura minima, e pode estar sendo comprimido pelo nome longo.

Corrigir adicionando `ml-2` ao span do horario para garantir espaco, e verificar que o container flex tem `gap` adequado.

**Arquivo**: `src/components/whatsapp/ChatSidebar.tsx`, linha 649

Mudar de:
```
<span className="text-xs text-muted-foreground shrink-0">
```
Para:
```
<span className="text-xs text-muted-foreground shrink-0 ml-2">
```

### Bug 3: Badge de nao lidas (39) desincronizado

O badge no chip selector soma `unread_count` de TODAS as conversas. Porem apos a limpeza de conversas bogus, podem existir conversas com `unread_count > 0` que nao aparecem na sidebar (por exemplo, conversas que foram lidas no WhatsApp mas o sync nao zerou o contador local).

A correcao e dupla:
1. No sync-history, ao fazer upsert da conversa, SEMPRE usar o `wa_unreadCount` da UazAPI (ja feito na linha 347)
2. No front-end, ao abrir a sidebar com filtro "Nao lidas" e nao encontrar resultados, resetar os contadores de unread para zero

A solucao mais robusta: adicionar uma funcao no `fetchChats` que, apos carregar todas as conversas, recalcula o total de unread e atualiza o badge via `onUnreadUpdate`.

**Arquivo**: `src/components/whatsapp/ChatSidebar.tsx`

Apos o `setChats` no `fetchChats` (linhas 190-201), adicionar recalculo do unread total:

```typescript
// After setting chats, recalculate unread total
if (onUnreadUpdate && chipId) {
  const totalUnread = mapped
    .filter(c => !c.is_archived)
    .reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  onUnreadUpdate(chipId, totalUnread);
}
```

Isso garante que o badge sempre reflete os dados REAIS das conversas carregadas, nao valores cached/stale.

### Resumo

| # | Bug | Arquivo | Linha | Correcao |
|---|-----|---------|-------|----------|
| 1 | Menu 3 pontos | ChatSidebar.tsx | 677 | Adicionar `z-10` ao container absoluto |
| 2 | Horario | ChatSidebar.tsx | 649 | Adicionar `ml-2` ao span do horario |
| 3 | Badge unread | ChatSidebar.tsx | 190-201 | Recalcular unread total apos fetchChats |

