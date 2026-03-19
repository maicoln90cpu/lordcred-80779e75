

## Plano de Reestruturação de Roles — 4 Etapas

### ✅ Etapa 1: Migration SQL (CONCLUÍDA)

**O que foi feito:**
- Adicionado `'master'` ao enum `app_role`
- Migrado `admin → master` e `user → admin` na tabela `user_roles`
- Default para novos usuários alterado para `'seller'`
- Atualizado `is_admin()` → verifica `'master'`
- Atualizado `promote_master_user()` → seta `'master'`
- Atualizado `handle_new_user()` → insere `'seller'`
- Criada RPC `get_internal_chat_profiles_v2()` com `avatar_url`
- Normalizado `client_leads.status` NULL → `'pendente'`
- **~30 RLS policies** atualizadas em 12 tabelas

---

### 🔲 Etapa 2: Edge Functions (PRÓXIMA)

Arquivos a atualizar:
| Arquivo | Mudanças |
|---------|----------|
| `update-user-role/index.ts` | `'admin'` → `'master'` na verificação de requester, `'user'` → `'admin'` na lista de roles válidos |
| `create-user/index.ts` | `'admin'` → `'master'`, `'user'` → `'admin'` em callerRole |
| `delete-user/index.ts` | Mesmas mudanças |
| `chip-health-check/index.ts` | Mesmas mudanças |

---

### 🔲 Etapa 3: Frontend — AuthContext + Layout

Arquivos a atualizar:
| Arquivo | Mudanças |
|---------|----------|
| `AuthContext.tsx` | `UserRole = 'master' \| 'admin' \| 'seller' \| 'support'`, `isAdmin = master`, novo `isAdministrator = admin` |
| `DashboardLayout.tsx` | Labels: master='Master', admin='Administrador' |
| `ProtectedRoute.tsx` | Verificar se usa `isAdmin` corretamente |

---

### 🔲 Etapa 4: Frontend — Páginas e Componentes

Arquivos a atualizar:
| Arquivo | Mudanças |
|---------|----------|
| `Users.tsx` | RadioGroup roles, labels, permissões |
| `Templates.tsx` | `isAdmin \|\| userRole === 'admin'`, adminIds `.in('role', ['master', 'admin'])` |
| `TemplatePicker.tsx` | adminIds `.in('role', ['master', 'admin'])` |
| `ShortcutManager.tsx` | adminIds `.in('role', ['master', 'admin'])` |
| `InternalChat.tsx` | Avatar, vendedor busca por email (só suporte/admin), nova RPC |
| `LeadsPanel.tsx` | Normalizar status null → pendente, case-insensitive |
| `RemoteAssistance.tsx` | `.in('role', ['seller', 'admin'])` |
| `LeadImporter.tsx` | Fallback role seller |
| `MigrationSQLTab.tsx` | Texto do enum |

---

### Hierarquia Final

| Role DB | Label UI | Nível |
|---------|----------|-------|
| `master` | Master | Acesso total + SQL/Export |
| `admin` | Administrador | Acesso total exceto SQL/Export |
| `support` | Suporte | Operacional |
| `seller` | Vendedor | Leads + chat |
