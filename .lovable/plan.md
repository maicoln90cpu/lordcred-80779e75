

# Plan: 5 Internal Chat Enhancements

## 1. Sellers can start direct conversations (but NOT create groups)

**Current state**: Line 62 `isAdmin = !isSeller` — the "New direct chat" button is only shown to non-sellers. RLS on `internal_channels` only allows `admin` or `user` roles to INSERT.

**Changes**:
- **`InternalChat.tsx`**: Show the "Nova conversa direta" button (`MessageSquare`) for ALL users. Keep "Criar grupo" (`Plus`) button admin-only.
- **RLS migration**: Add INSERT policy on `internal_channels` for sellers creating non-group channels only. Add INSERT policy on `internal_channel_members` for sellers adding themselves.

**Migration SQL**:
```sql
-- Allow sellers to create direct (non-group) channels
CREATE POLICY "Sellers can create direct channels"
ON public.internal_channels FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'seller'::app_role)
  AND is_group = false
  AND created_by = auth.uid()
);

-- Allow sellers to add members to channels they created
CREATE POLICY "Sellers can add members to own channels"
ON public.internal_channel_members FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'seller'::app_role)
  AND channel_id IN (
    SELECT id FROM internal_channels WHERE created_by = auth.uid() AND is_group = false
  )
);
```

## 2. Unread badge on individual channel items in sidebar

**Current state**: Badge only shows on sidebar nav and WhatsApp header as a total count. No per-channel badge.

**Changes**:
- **`useInternalChatUnread.ts`**: Expose `unreadByChannel: Record<string, number>` in addition to `totalUnread`.
- **`InternalChat.tsx`**: Import `useInternalChatUnread`, call `markAsRead(channelId)` when selecting a channel. Show red dot/count badge next to each channel in the channel list when `unreadByChannel[ch.id] > 0`.

## 3. Media support in internal chat (images, audio, video, documents)

**Database migration**: Add columns to `internal_messages`:
```sql
ALTER TABLE public.internal_messages
  ADD COLUMN media_url text,
  ADD COLUMN media_type text, -- 'image', 'audio', 'video', 'document'
  ADD COLUMN media_name text;
```

**Storage**: Create a `internal-chat-media` bucket (public, with RLS for insert by authenticated users).

**`InternalChat.tsx` changes**:
- Add attachment button (Plus icon with dropdown: Image, Video, Audio, Document) similar to `ChatInput.tsx`.
- Add audio recording capability (mic button, reuse recording logic from `ChatInput.tsx`).
- Upload file to Supabase Storage `internal-chat-media` bucket, store public URL in `media_url`.
- Render media in message bubbles: images inline, audio with player, video with player, documents with download link.
- Caption support: if media + text, text becomes caption.

## 4. Typing indicator

**Approach**: Use Supabase Realtime Broadcast (no DB table needed — ephemeral).

**`InternalChat.tsx` changes**:
- Subscribe to a broadcast channel `typing-{channelId}`.
- On input change (debounced), broadcast `{ type: 'typing', userId, channelId }`.
- On receiving typing event from another user, show "Fulano está digitando..." below the message area for 3 seconds (auto-clear).
- Display animated dots indicator.

## 5. Online indicator

**Approach**: Use Supabase Realtime Presence.

**`InternalChat.tsx` changes**:
- Track presence on a shared channel `internal-chat-presence`.
- Each user tracks their `user_id` in presence state.
- Show green dot on user avatars in channel list for 1:1 chats, and member count online for groups.
- In the channel header, show "Online" or "Offline" status for direct chats.

**`useInternalChatUnread.ts`**: Also track presence here so it's available globally (for the future).

---

## Files Changed

| File | Change |
|------|--------|
| New migration SQL | Add `media_url`, `media_type`, `media_name` to `internal_messages`; create storage bucket; seller RLS policies |
| `src/hooks/useInternalChatUnread.ts` | Expose `unreadByChannel`, add presence tracking |
| `src/pages/admin/InternalChat.tsx` | Major refactor: seller direct chat, per-channel badges, media upload/render, typing indicator, online indicator, audio recording |

## Scope & Complexity

This is a large set of changes. The implementation will be done in a single pass, focusing on:
1. DB migrations first (media columns, storage, seller RLS)
2. Hook updates (unread per channel, presence)
3. InternalChat.tsx full refactor (media, typing, online, seller permissions, badges)

