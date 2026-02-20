

## Fixes and Improvements for WhatsApp Interface

### 1. Fix audio/PTT messages showing as text "ptt" instead of audio player

**Root cause:** When messages come from the UazAPI `/message/find` endpoint, the `mediaType` field may be returned in a different property (e.g., `type`, `messageType`), or the `text` field literally contains "ptt" for voice messages. The normalization logic in the edge function doesn't properly detect all PTT/audio messages.

Additionally, in `MessageBubble`, even when `isMedia` is false (because `hasMedia`/`mediaType` are missing), the raw text "ptt" is displayed.

**Changes:**
- **`supabase/functions/uazapi-api/index.ts`** (fetch-messages normalization): Improve media type detection by also checking `m.type`, `m.messageType`, and the `text` field for known media type keywords like "ptt", "audio", "image", etc. When text equals a media type name exactly, treat it as media and clear the display text.
- **`src/components/whatsapp/MessageBubble.tsx`**: Add a fallback check -- if the text content is exactly a known media type keyword (ptt, audio, image, video, sticker, document), treat it as media even if `hasMedia` is false, and render the MediaRenderer.
- **`src/components/whatsapp/MediaRenderer.tsx`**: The AudioPlayer component already works well. No changes needed here.

### 2. Add emoji picker to chat input

**Changes:**
- **`src/components/whatsapp/EmojiPicker.tsx`** (new file): Create a categorized emoji picker component with tabs for: Smileys, People, Animals, Food, Activities, Travel, Objects, Symbols. Each category contains a curated set of commonly used emojis. The picker opens as a popover above the input area.
- **`src/components/whatsapp/ChatInput.tsx`**: Add a Smile icon button next to the Plus (attachments) button. Clicking it opens the EmojiPicker popover. When an emoji is selected, it's inserted at the cursor position in the message input.

### 3. Fix ChipSelector -- clicking chip opens disconnect menu instead of switching

**Root cause:** Each chip button is wrapped inside a `DropdownMenuTrigger`, so any click opens the dropdown menu (which only has "Desconectar"). The `onClick` on the button fires `onSelectChip` but the dropdown also opens, blocking the interaction.

**Changes:**
- **`src/components/whatsapp/ChipSelector.tsx`**: Separate the chip selection from the dropdown. Make the main chip button area a plain click-to-select, and add a small secondary button (chevron-down or three-dot icon) that opens the dropdown menu with the disconnect option. This way, clicking the chip name switches the conversation, and only clicking the menu icon opens the disconnect option.

### 4. Message context menu (reply, react, forward, download, pin, favorite, delete)

**Changes:**
- **`src/components/whatsapp/MessageContextMenu.tsx`** (new file): Create a context menu component that appears when right-clicking or long-pressing a message bubble. Options include:
  - Responder (Reply) -- prepends quoted text in input
  - Reagir (React) -- opens a small emoji reaction picker
  - Baixar (Download) -- for media messages, triggers download
  - Encaminhar (Forward) -- opens a contact/chat picker dialog to forward
  - Fixar (Pin) -- placeholder/visual only for now
  - Favoritar (Favorite) -- placeholder/visual only for now
  - Apagar (Delete) -- calls UazAPI delete endpoint if available
- **`src/components/whatsapp/MessageBubble.tsx`**: Wrap each message in a ContextMenu trigger. Pass message data to the context menu.
- **`src/components/whatsapp/ChatWindow.tsx`**: Add state for reply-to message and forward dialog. Pass handlers down to MessageContextMenu.
- **`src/components/whatsapp/ChatInput.tsx`**: Add a reply preview bar above the input when replying to a message.

### 5-6. Message storage analysis (informational, no code changes)

Current architecture:
- Messages are stored in the `message_history` database table via webhooks (incoming) and have no automatic expiration.
- The frontend uses localStorage as a 7-day cache with 100 messages per chat limit.
- The primary message source is the UazAPI provider's `/message/find` endpoint.
- There is no 30-day purge -- messages accumulate indefinitely in both the provider and the database.
- After logout, the localStorage cache remains until browser data is cleared. On login, messages reload from the provider API.

No code changes needed for questions 5-6 -- this is informational only.

---

### Technical Details

**Files to create:**
1. `src/components/whatsapp/EmojiPicker.tsx` -- Categorized emoji grid with Popover
2. `src/components/whatsapp/MessageContextMenu.tsx` -- Right-click/long-press menu for messages

**Files to modify:**
1. `supabase/functions/uazapi-api/index.ts` -- Fix fetch-messages media type normalization for PTT/audio
2. `src/components/whatsapp/MessageBubble.tsx` -- Fallback media detection for "ptt" text; wrap in context menu
3. `src/components/whatsapp/ChatInput.tsx` -- Add emoji button and reply preview bar
4. `src/components/whatsapp/ChipSelector.tsx` -- Separate click-to-select from dropdown menu
5. `src/components/whatsapp/ChatWindow.tsx` -- Add reply/forward state management and handlers

**Implementation order:**
1. Fix PTT/audio display (highest priority -- broken functionality)
2. Fix ChipSelector click behavior (broken functionality)
3. Add emoji picker (new feature, self-contained)
4. Add message context menu (new feature, touches multiple files)

