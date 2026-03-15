

## Issues and Plan

### Issue 1: Support users not showing in admin's user list

**Root cause**: Line 104-108 in `Users.tsx` — the regular admin (`userRole === 'user'`) filter only shows `role === 'seller'`. Support users created by the admin are excluded.

**Fix**: Change the admin filter to include both `seller` and `support` roles created by them:
```
enrichedUsers = enrichedUsers.filter(u => 
  (u.role === 'seller' || u.role === 'support') && u.created_by === currentUser?.id
);
```

Also update the card title from "Meus Vendedores" to "Meus Usuários" for regular admins (line 327).

---

### Issue 2: Sidebar refactoring — group related items

The current sidebar has 17+ flat items. The plan is to organize them into collapsible groups using visual separators/labels.

**Proposed grouping for Admin/Support**:

```text
── Principal ──────────────
  Dashboard
  Meus Chips
  Mensagens

── Equipe ─────────────────
  Usuários
  Leads
  Performance (admin only)
  Kanban

── Operações ──────────────
  Monitor de Chips
  Fila de Mensagens
  Webhooks
  Templates

── Comunicação ────────────
  Tickets
  Chat Interno

── Ferramentas ────────────
  Links Úteis
  Assistência Remota
  Logs de Auditoria

── Sistema ────────────────
  Configurações
  Master Admin (master only)
```

**For Sellers**: Only see Tickets + Chat Interno (no groups needed).

**Implementation approach**:
- Define nav items as groups with a `groupLabel` and array of items
- Render each group with a small label separator and the items underneath
- Use `text-xs text-muted-foreground uppercase` for group labels
- When sidebar is collapsed, hide group labels, show only icons
- Keep the same filtering logic (sellerHidden, supportHidden, adminOnly)

### Files to modify

1. **`src/pages/admin/Users.tsx`** — Fix filter to include `support` role for admin view
2. **`src/components/layout/DashboardLayout.tsx`** — Refactor navItems into grouped structure with section labels

