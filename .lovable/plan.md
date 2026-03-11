

## Plano: Sincronizacao bidirecional Status ↔ Kanban

### Problema
O `custom_status` no sidebar e o `kanban_cards.column_id` sao fontes de verdade independentes. Quando o usuario muda o status pelo menu de contexto do sidebar, nenhum `kanban_card` eh criado/atualizado, e o contato nao aparece no Kanban.

### Solucao

**Editar `handleSetStatus` em `ChatSidebar.tsx`** para, apos atualizar `conversations.custom_status`, tambem sincronizar com `kanban_cards`:

1. **Status definido (nao null)**: buscar o `conversation.id` pelo `chip_id` + `remote_jid`, encontrar a `kanban_column` cujo `name` corresponda ao label do status (ex: `STATUS_CONFIG['aguardando'].label` = "Aguardando" → coluna "Aguardando"), e fazer `upsert` no `kanban_cards` com `onConflict: 'conversation_id'`.

2. **Status removido (null)**: buscar o `conversation.id` e deletar o `kanban_card` correspondente.

### Codigo resumido da mudanca

```typescript
const handleSetStatus = async (chat, status) => {
  // ... update conversations.custom_status (existente) ...

  // NOVO: sync com kanban
  const { data: conv } = await supabase
    .from('conversations').select('id')
    .eq('chip_id', chipId).eq('remote_jid', chat.remoteJid).single();

  if (conv) {
    if (status) {
      const statusLabel = STATUS_CONFIG[status]?.label || status;
      const { data: col } = await supabase
        .from('kanban_columns').select('id')
        .eq('name', statusLabel).single();
      if (col) {
        await supabase.from('kanban_cards').upsert(
          { conversation_id: conv.id, column_id: col.id, sort_order: 0 },
          { onConflict: 'conversation_id' }
        );
      }
    } else {
      await supabase.from('kanban_cards').delete().eq('conversation_id', conv.id);
    }
  }
};
```

### Arquivos afetados

| Arquivo | Mudanca |
|---|---|
| `src/components/whatsapp/ChatSidebar.tsx` | Adicionar sync kanban no `handleSetStatus` |

Nenhuma mudanca de banco necessaria.

