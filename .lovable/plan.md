

# Plan: Chat Interno - Badge, Sidebar Fix, Toast Notifications, Sender Name

## 1. Unread badge on Chat Interno icon (DashboardLayout + WhatsApp header)

**Problem**: No visual indicator of unread internal chat messages anywhere.

**Solution**: Create a shared hook/context `useInternalChatUnread` that subscribes to `internal_messages` Realtime INSERT events, tracks unread count per channel (excluding currently viewed channel), and exposes a total unread number.

- **New file**: `src/hooks/useInternalChatUnread.ts` — a hook that:
  - On mount, fetches all channels the user is a member of
  - Subscribes to `internal_messages` INSERT events globally
  - Maintains a `Map<channelId, unreadCount>` incremented on each new message from other users
  - Resets count for a channel when `markAsRead(channelId)` is called
  - Returns `totalUnread: number`

- **`src/components/layout/DashboardLayout.tsx`**: Import the hook, render a red badge (count) on the "Chat Interno" nav item when `totalUnread > 0`.

- **`src/pages/WhatsApp.tsx`** (line 345): Fix route from `/admin/chat` to `/chat`. Add badge on the `MessageCircle` button using the same hook.

## 2. Remove "Configurações" from seller sidebar

**Problem**: Sellers see "Configurações" which links to `/settings` — same effect as "Voltar ao Chat", redundant and confusing.

**Fix**: In `DashboardLayout.tsx`, mark `Configurações` as `sellerHidden: true` in the navItems array (line 47).

## 3. Replace browser notifications with in-app toast

**Problem**: Browser Notification API doesn't work reliably (permissions, blocked by browsers).

**Fix**: In `InternalChat.tsx` global notification subscription (lines 224-229), replace `new Notification(...)` with `toast({ title: senderName, description: msg.content.slice(0, 100) })`. Also add toast notification in the `useInternalChatUnread` hook for when user is on WhatsApp page (not on /chat).

## 4. Fix sender name showing "Usuário" for sellers

**Problem**: Sellers can't read all profiles due to RLS — `profiles` table only allows viewing own profile, profiles created by you, or admin access. Sellers see null for admin profiles.

**Root cause**: Line 87 in InternalChat: `supabase.from('profiles').select(...)` — sellers can only see their own profile row. Admin profiles return empty.

**Fix**: Create a `SECURITY DEFINER` function `get_channel_member_profiles(channel_ids uuid[])` that returns `user_id, email, name` for all members of the given channels, bypassing RLS. Call this instead of `profiles.select(*)`.

**Migration SQL**:
```sql
CREATE OR REPLACE FUNCTION public.get_internal_chat_profiles()
RETURNS TABLE(user_id uuid, email text, name text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.user_id, p.email, p.name
  FROM profiles p
  INNER JOIN internal_channel_members icm ON icm.user_id = p.user_id
  INNER JOIN internal_channel_members my_channels ON my_channels.channel_id = icm.channel_id
  WHERE my_channels.user_id = auth.uid()
$$;
```

Then in `loadUsers`, call `supabase.rpc('get_internal_chat_profiles')` instead of `supabase.from('profiles').select(...)`.

---

## Files Changed

| File | Change |
|------|--------|
| New `src/hooks/useInternalChatUnread.ts` | Shared hook for unread count + toast notifications |
| `src/components/layout/DashboardLayout.tsx` | Badge on Chat Interno nav item, hide Configurações for sellers |
| `src/pages/WhatsApp.tsx` | Fix route `/admin/chat` → `/chat`, add badge on chat icon |
| `src/pages/admin/InternalChat.tsx` | Replace browser Notification with toast, use RPC for profiles |
| New migration SQL | `get_internal_chat_profiles()` SECURITY DEFINER function |

