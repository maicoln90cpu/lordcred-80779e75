

# Plano de Correcao - 4 Problemas

## 1. Provedor nao salva ao trocar de Evolution para UazAPI

**Causa raiz:** O `handleSave` usa `as any` para forcar o update, mas os tipos estao corretos no `types.ts`. O problema real e que a RLS policy `system_settings` exige `is_admin()`, e o update esta funcionando corretamente para admins. Porem, ao trocar o provedor no Select, o estado local atualiza mas o `handleSave` pode estar falhando silenciosamente porque o `toast` de erro e generico ("Erro ao salvar").

**Correcao:** Remover o `as any` do update e adicionar log detalhado do erro no toast para diagnostico. Tambem garantir que o `handleProviderChange` atualiza corretamente todos os campos necessarios.

## 2. Admin (role "user") nao ve vendedores criados na aba "Criados"

**Causa raiz:** No `Users.tsx` linha 91-93, o filtro para nao-master e:
```
enrichedUsers = enrichedUsers.filter(u => 
  u.role === 'seller' && u.created_by === currentUser?.id
);
```
Porem, a RLS policy de `profiles` so permite que admins (`is_admin()`) vejam todos os perfis. A funcao `is_admin()` provavelmente verifica se o role e `admin`, nao `user`. Portanto, usuarios com role `user` (Administrador) nao conseguem fazer SELECT em `profiles` de outros usuarios.

**Correcao:** Adicionar uma RLS policy em `profiles` que permita usuarios com role `user` ver os perfis que eles criaram (`created_by = auth.uid()`). Tambem adicionar policy similar em `user_roles` e `chips` para que o JOIN funcione.

Novas policies necessarias:
- `profiles`: SELECT WHERE `created_by = auth.uid()` para role `user`
- `user_roles`: SELECT para user_ids que existam em profiles com `created_by = auth.uid()`
- `chips`: SELECT para user_ids que existam em profiles com `created_by = auth.uid()`

## 3. Menu no header do /whatsapp para vendedores alterarem nome e senha

**Implementacao:**
- Adicionar um `DropdownMenu` no header do `WhatsApp.tsx`, visivel para todos os usuarios (especialmente vendedores)
- O menu tera um icone de usuario/perfil com opcoes:
  - "Alterar Nome" - abre dialog para trocar o nome no `profiles`
  - "Alterar Senha" - abre dialog que usa `supabase.auth.updateUser({ password })` para trocar a senha
- Criar um componente `UserProfileMenu.tsx` que encapsula essa logica

**Detalhes tecnicos:**
- Para trocar nome: `supabase.from('profiles').update({ name }).eq('user_id', auth.uid())`
- Para trocar senha: `supabase.auth.updateUser({ password: novaSenha })`
- A RLS de `profiles` ja permite `Users can update their own profile` (UPDATE WHERE user_id = auth.uid())

## 4. Permitir que "user" (Administrador) edite e exclua vendedores criados

**Causa raiz:** 
- O `delete-user` edge function so permite exclusao por `admin` (linha 53). Usuarios com role `user` recebem 403.
- O `profiles` update por RLS so permite o proprio usuario ou admin.

**Correcao:**
- **delete-user function:** Alterar para aceitar role `user` tambem, mas restringir para que so possa excluir usuarios que ele criou (verificar `created_by`).
- **profiles RLS:** Adicionar policy UPDATE para que `user` possa atualizar perfis onde `created_by = auth.uid()`.
- **Users.tsx:** Adicionar funcionalidade de edicao (dialog para editar nome/email) dos vendedores criados.

---

## Resumo tecnico das alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/migrations/new.sql` | Novas RLS policies para `profiles`, `user_roles`, `chips` permitindo role `user` ver/editar registros que criou |
| `supabase/functions/delete-user/index.ts` | Permitir role `user` excluir vendedores que criou (verificar `created_by`) |
| `src/components/whatsapp/UserProfileMenu.tsx` | Novo componente com dropdown para trocar nome e senha |
| `src/pages/WhatsApp.tsx` | Adicionar `UserProfileMenu` no header |
| `src/pages/admin/Users.tsx` | Adicionar dialog de edicao de vendedor (nome) |
| `src/pages/admin/MasterAdmin.tsx` | Melhorar tratamento de erro no save do provedor |

### SQL das novas RLS policies

```sql
-- Administradores (role=user) podem ver perfis que criaram
CREATE POLICY "Users can view profiles they created"
ON public.profiles FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- Administradores podem atualizar perfis que criaram
CREATE POLICY "Users can update profiles they created"
ON public.profiles FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Administradores podem ver roles dos usuarios que criaram
CREATE POLICY "Users can view roles of created users"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id IN (
  SELECT p.user_id FROM profiles p WHERE p.created_by = auth.uid()
));

-- Administradores podem ver chips dos usuarios que criaram
CREATE POLICY "Users can view chips of created users"
ON public.chips FOR SELECT
TO authenticated
USING (user_id IN (
  SELECT p.user_id FROM profiles p WHERE p.created_by = auth.uid()
));
```

### Alteracao no delete-user

Permitir que role `user` exclua, verificando `created_by`:
```typescript
// Antes: if (callerRole?.role !== 'admin')
// Depois:
if (callerRole?.role !== 'admin' && callerRole?.role !== 'user') {
  return error 403
}

// Se nao e admin, verificar se criou o usuario
if (callerRole?.role === 'user') {
  const { data: targetProfile } = await adminClient
    .from('profiles')
    .select('created_by')
    .eq('user_id', userId)
    .single();
  
  if (targetProfile?.created_by !== caller.id) {
    return error 403 "Voce so pode excluir usuarios que voce criou"
  }
}
```

