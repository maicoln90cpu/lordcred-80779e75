

## Plano de Correções — 4 Itens

### Item 1: Campo "Visível para" não aparece para admin

**Causa**: `isAdmin` do `useAuth()` retorna `true` apenas para role `'admin'`. Role `'user'` (Administrador) não é coberto. O campo na linha 382 do `Templates.tsx` verifica `isAdmin` que é `false` para role `'user'`.

**Correção**: No `Templates.tsx`, trocar `isAdmin` por `isAdmin || userRole === 'user'` — ou importar `userRole` do `useAuth` e verificar ambos. Preciso adicionar `userRole` à desestruturação do `useAuth()`.

**Arquivo**: `Templates.tsx` linha 51 e 382

---

### Item 2: Templates do admin não aparecem para vendedores

**Causa**: No `TemplatePicker.tsx`, a query na linha 55 seleciona `'id, title, content, category, media_url, media_type, media_filename'` — **não inclui `visible_to`**. O filtro client-side na linha 81 acessa `(t as any).visible_to` que é sempre `undefined`, então todos os templates passam (incluindo os de outros vendedores). Mas o verdadeiro problema é que a query `.in('created_by', allowedIds)` funciona, porém templates com `visible_to` de outro usuário não são filtrados porque `visible_to` não é selecionado.

**Correção**: Adicionar `visible_to` ao select da query no `TemplatePicker.tsx`.

**Arquivo**: `TemplatePicker.tsx` linha 55

---

### Item 3: Avatar no chat interno ao lado das mensagens

**Causa**: O `profilesMap` não contém `avatar_url`. A RPC `get_internal_chat_profiles` retorna apenas `(user_id, email, name)`. Preciso de uma nova RPC ou query direta para obter `avatar_url`.

**Correção**:
1. Criar migration com nova RPC `get_internal_chat_profiles_v2` que retorna `avatar_url` também
2. No `InternalChat.tsx`, adicionar `avatar_url` ao `UserProfile` interface e atualizar `loadUsers` para usar a nova RPC
3. No render das mensagens (linha 803), adicionar `Avatar` component antes do balão para mensagens de outros usuários

**Arquivos**: `InternalChat.tsx`, migration SQL

---

### Item 4: Filtro de status "pendente" não funciona

**Causa**: O default no banco é `'pendente'` (minúsculo), mas leads importados podem ter `status = NULL`. Na linha 167 do `LeadsPanel.tsx`, o filtro faz `l.status === filterStatus`. Se `l.status` é `null` e `filterStatus` é `'pendente'`, não há match.

Na contagem (linha 144), `counts[l.status]` com `l.status = null` cria `counts[null]` em vez de `counts['pendente']`.

**Correção**:
1. No `LeadsPanel.tsx`, normalizar `l.status` para `'pendente'` quando é null/vazio:
   - Linha 144: `const st = l.status || 'pendente'; counts[st] = ...`
   - Linha 161: já verifica `l.status !== 'pendente'`, adicionar `&& l.status !== null`
   - Linha 167: `const st = l.status || 'pendente'; st === filterStatus`
2. Criar migration para normalizar dados existentes: `UPDATE client_leads SET status = 'pendente' WHERE status IS NULL`

**Arquivos**: `LeadsPanel.tsx`, migration SQL

---

### Migration SQL necessária

```sql
-- Fix null statuses in existing leads
UPDATE client_leads SET status = 'pendente' WHERE status IS NULL;

-- New RPC with avatar_url
CREATE OR REPLACE FUNCTION public.get_internal_chat_profiles_v2()
RETURNS TABLE(user_id uuid, email text, name text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT p.user_id, p.email, p.name, p.avatar_url
  FROM profiles p
  INNER JOIN internal_channel_members icm ON icm.user_id = p.user_id
  INNER JOIN internal_channel_members my_channels ON my_channels.channel_id = icm.channel_id
  WHERE my_channels.user_id = auth.uid()
$$;
```

---

### Resumo

| Item | Arquivo(s) | Mudança |
|------|-----------|---------|
| 1 | `Templates.tsx` | Verificar `userRole` inclui `'user'` além de `'admin'` |
| 2 | `TemplatePicker.tsx` | Adicionar `visible_to` ao select da query |
| 3 | `InternalChat.tsx` + migration | Nova RPC com `avatar_url`, exibir Avatar ao lado de mensagens |
| 4 | `LeadsPanel.tsx` + migration | Normalizar `null → 'pendente'`, corrigir filtros |

### Checklist manual
- [ ] Admin (role 'admin' ou 'user') vê campo "Visível para" ao criar template
- [ ] Vendedor vê seus templates + templates do admin (globais ou direcionados a ele)
- [ ] Avatar do usuário aparece ao lado das mensagens no chat interno
- [ ] Filtro "Pendente" nos leads retorna todos os leads com status null ou 'pendente'

