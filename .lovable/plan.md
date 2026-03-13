

# Plan: Fix 4 Critical Internal Chat Issues

## Issue Analysis

### 1. CRITICAL: Sellers see admin page at /admin/chat
**Root cause**: Two problems:
- `DashboardLayout` sidebar shows ALL nav items to sellers (only `adminOnly` items are filtered, not admin-only pages like Dashboard, Chips, etc.)
- Role label at line 135 shows `'Administrador'` for ALL non-master users, including sellers
- The chat route is under `/admin/chat` which is confusing but technically accessible (no `blockSellers`)

**Fix**:
- Add a `sellerVisible` flag to nav items; only show Chat Interno + Configurações to sellers
- Fix role label: show "Vendedor" for sellers, "Administrador" for `user` role, "Master" for `admin`
- Move chat route from `/admin/chat` to `/chat` (add redirect for old URL)
- In `InternalChat.tsx`, hide admin-only buttons (create group, delete, manage members) for sellers — already done via `isAdmin` check, but `isAdmin = !isSeller` which means `user` role users are also "admin" in this component. Need to use `useAuth().isAdmin` or check properly.

### 2. No message notifications
**Fix**: Add browser `Notification API` + audio ping when a new message arrives on any channel the user is a member of. Subscribe to all channels, not just the selected one.

### 3. Messages not appearing instantly
**Root cause**: Supabase Realtime requires the table to have `REPLICA IDENTITY FULL` set, or the subscription filter may not work. Also, the current subscription at line 154 uses `postgres_changes` with a filter — if Realtime isn't enabled for `internal_messages`, nothing fires.

**Fix**:
- Add optimistic message insertion: immediately add the message to local state on send (before DB insert completes)
- Ensure Realtime subscription is properly set up; add `REPLICA IDENTITY FULL` to `internal_messages` via migration
- Keep deduplication logic to prevent doubles when realtime eventually fires

### 4. Showing "Usuário" instead of user name
**Root cause**: The `profiles` table `name` field may be null for some users, and `user_email` may also not be mapped correctly when realtime payload arrives.

**Fix**: Ensure `profilesMapRef` is populated before rendering, and fall back to email prefix properly. The sender's own messages should use the logged-in user's profile name.

---

## Implementation Details

### File: `src/components/layout/DashboardLayout.tsx`
- Add `sellerHidden?: boolean` to `NavItem` interface
- Mark Dashboard, Meus Chips, Mensagens, Vendedores, Leads, Performance, Kanban, Links Úteis, Master Admin as `sellerHidden: true`
- Keep Chat Interno and Configurações visible to all
- Filter: `navItems.filter(item => (!item.adminOnly || isAdmin) && (!item.sellerHidden || !isSeller))`
- Fix role label: `isSeller ? 'Vendedor' : isAdmin ? 'Master' : 'Administrador'`

### File: `src/App.tsx`
- Change `/admin/chat` to `/chat`
- Add redirect: `/admin/chat` → `/chat`

### File: `src/pages/admin/InternalChat.tsx`
**Optimistic send (issue 3)**:
- On `handleSendMessage`, immediately push a temp message to `setMessages` with `id: crypto.randomUUID()`, user info from profilesMap, and current timestamp
- After DB insert succeeds, the realtime subscription or dedup handles the rest

**Notifications (issue 2)**:
- Add a separate Supabase channel subscription for ALL `internal_messages` (no channel_id filter)
- When a new message arrives for a channel that is NOT currently selected, show a browser Notification + play a short audio beep
- Request `Notification.permission` on mount

**User name fix (issue 4)**:
- Already mostly correct; ensure the optimistic message uses `profilesMap[user.id]?.name`

### Migration SQL
```sql
ALTER TABLE internal_messages REPLICA IDENTITY FULL;
```
This ensures Realtime delivers the full row payload including `channel_id` for filters.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/layout/DashboardLayout.tsx` | Filter seller nav items, fix role label |
| `src/App.tsx` | Move route `/admin/chat` → `/chat`, add redirect |
| `src/pages/admin/InternalChat.tsx` | Optimistic send, notification subscription, fix sender name |
| New migration SQL | `REPLICA IDENTITY FULL` on `internal_messages` |

