

## Plano de Implementação — 2 Correções

### Item 1: Mapeamento de aliases de colunas configurável pelo admin

**Problema**: Os aliases de colunas para importação estão hardcoded no `LeadImporter.tsx`. Quando o admin exporta planilhas com headers como "Valor Lib." e tenta reimportar, nem sempre bate com os aliases existentes.

**Solução**: Adicionar um novo card em "Configurações da Planilha" (`Leads.tsx`) onde o admin configura os aliases de cada coluna. Persistir em `system_settings` (novo campo `lead_column_aliases`). O `LeadImporter.tsx` lê essa config e usa os aliases configurados.

**Arquivos**:
- `supabase/migrations/` — nova migration: `ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS lead_column_aliases jsonb DEFAULT NULL`
- `src/integrations/supabase/types.ts` — atualizar tipo
- `src/pages/admin/Leads.tsx` — novo card "Mapeamento de Colunas para Importação"
- `src/components/admin/LeadImporter.tsx` — buscar aliases do `system_settings` e usar no parse
- `src/components/admin/LeadsTable.tsx` — ajustar headers da exportação para usar o label do sistema

**Estrutura do JSON `lead_column_aliases`**:
```json
[
  { "key": "nome", "system_label": "Nome", "aliases": ["nome", "name"] },
  { "key": "telefone", "system_label": "Telefone", "aliases": ["telefone", "phone", "tel"] },
  { "key": "valor_lib", "system_label": "Valor Lib.", "aliases": ["valor lib", "valor lib.", "valor_lib"] },
  ...
]
```

**UI do card**:
```text
Mapeamento de Colunas para Importação
┌──────────────────────────────────────────────────────────┐
│ Coluna Sistema │ Nome Exportação │ Variações (aliases)    │
│ nome           │ Nome            │ nome, name             │
│ telefone       │ Telefone        │ telefone, phone, tel   │
│ valor_lib      │ Valor Lib.      │ valor lib, valor lib.  │
│ ...            │                 │                        │
└──────────────────────────────────────────────────────────┘
```

- Admin pode editar os aliases de cada coluna (campo texto, separado por vírgula)
- O `system_label` é o nome exibido ao exportar
- O `key` (nome interno) não é editável para não quebrar o sistema
- A exportação usa `system_label` como header
- A importação normaliza tudo para lowercase e tenta todos os aliases configurados
- Se não houver config salva, usa os aliases hardcoded atuais como default

---

### Item 2: Nome errado no chat interno (direct chat mostra nome próprio)

**Problema**: Quando o admin cria um chat direto com Gabriel, o canal é salvo com `name = "Gabriel"` (nome do alvo). Quando Gabriel abre o chat, `getChannelDisplayName` retorna `ch.name` = "Gabriel" em vez do nome do admin.

**Causa**: `getChannelDisplayName` (linha 666) simplesmente retorna `ch.name` sem considerar que em chats diretos, cada participante deveria ver o nome do OUTRO.

**Solução**: Alterar `getChannelDisplayName` para, em chats diretos (`!ch.is_group`), buscar o outro membro e exibir o nome dele via `profilesMap`.

**Arquivo**: `src/pages/admin/InternalChat.tsx`

**Lógica**:
```typescript
const getChannelDisplayName = (ch: Channel) => {
  if (!ch.is_group) {
    const otherUserId = getDirectChatUserId(ch);
    if (otherUserId && profilesMap[otherUserId]) {
      return profilesMap[otherUserId].name || profilesMap[otherUserId].email?.split('@')[0] || ch.name;
    }
  }
  return ch.name;
};
```

Também preciso garantir que `getDirectChatUserId` funcione corretamente — ele depende de `channelMembers` que só é carregado para o canal selecionado. Para funcionar na lista lateral, precisamos ter os membros de TODOS os canais. Alternativa: extrair o outro user_id do nome do canal comparando com `user.id` nos members, ou carregar members de todos os canais de uma vez.

**Abordagem**: Carregar todos os membros de todos os canais do usuário de uma vez (uma query) e armazenar em um map `allChannelMembers: Record<string, string[]>`. Usar isso no `getDirectChatUserId` e no `getChannelDisplayName`.

```text
ANTES: Gabriel vê "Gabriel" como nome do chat direto com admin
DEPOIS: Gabriel vê "ADM Silas Carlos Dias" como nome do chat direto com admin
```

---

### Divisão

**Etapa 1** (frontend + migration): Item 2 — fix do nome no chat (rápido, sem risco)
**Etapa 2** (frontend + migration): Item 1 — card de aliases de colunas

### Vantagens
- Importação flexível sem depender de headers exatos
- Admin controla completamente os mapeamentos
- Nomes no chat direto sempre corretos independentemente de quem criou o canal

### Desvantagens / Trade-offs
- Mais um campo em `system_settings` para gerenciar
- Carregar membros de todos os canais adiciona uma query extra no mount do chat

### Checklist Manual
- [ ] Admin exporta planilha e reimporta sem erros
- [ ] Admin configura alias novo e importação reconhece
- [ ] Chat direto: Gabriel vê nome do admin, admin vê "Gabriel"
- [ ] Chat direto: preview de última mensagem mostra nome correto do remetente

