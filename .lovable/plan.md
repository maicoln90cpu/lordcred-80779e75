

## Three Fixes

### 1. Chip status out of sync (phone 554898097426 shows disconnected)

**Problem:** The chip status in the database only updates during QR code polling or manual sync. There is no automatic periodic sync, so if a chip reconnects on the provider side, the local DB stays "disconnected."

**Solution:**
- On the Chips page load, automatically sync status of all chips with the provider API (batch call to `check-status` for each chip).
- Update the `handleSyncStatus` to also be called in a `useEffect` on page mount for all connected/disconnected chips.
- Add a "Sync All" button for manual batch sync.

### 2. Show/hide password toggle on user creation dialog

**Problem:** The password field in the "Novo Vendedor" / "Novo Usuario" dialog is always masked.

**Solution:**
- Add a `showPassword` state toggle.
- Change the password `<Input>` type from `"password"` to dynamically switch between `"text"` and `"password"`.
- Add an Eye/EyeOff icon button inside or next to the input for toggling visibility.

### 3. User list not updating after deletion

**Problem:** Two issues:
1. When `auth.admin.deleteUser()` succeeds, the edge function does NOT clean up the `profiles` and `user_roles` rows (only cleans up on 404). Since these tables have no FK to `auth.users`, the rows persist and the user keeps showing in the list.
2. The `AlertDialogAction` component auto-closes the dialog on click, potentially interrupting the async `handleDeleteUser` before `fetchUsers()` runs.

**Solution:**
- **Edge function fix:** Always delete `user_roles` and `profiles` rows after successful auth deletion (move cleanup outside the error-only branch).
- **Frontend fix:** Prevent `AlertDialogAction` default behavior with `e.preventDefault()` so the async operation completes fully before closing. Also optimistically remove the user from the local state immediately for instant UI feedback.

---

### Technical Details

**Files to modify:**

1. **`src/pages/Chips.tsx`** -- Add `useEffect` that calls `handleSyncStatus` for all chips on mount; add batch sync button.

2. **`src/pages/admin/Users.tsx`** -- Add `showPassword` state + Eye toggle icon on password input; fix `AlertDialogAction` to use `e.preventDefault()` and optimistically update the user list.

3. **`supabase/functions/delete-user/index.ts`** -- Move `user_roles` and `profiles` cleanup to always execute after auth deletion (success or 404), not only on 404.

