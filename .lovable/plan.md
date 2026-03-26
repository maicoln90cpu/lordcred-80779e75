

## Plan: Improve ProductInfo table cells height + add row drag reorder + column sort

### What changes

**1. Increase textarea min-height (eliminate scrollbars)**
- Change `min-h-[48px]` to `min-h-[72px]` on the Textarea cells so content displays without internal scrollbars.

**2. Add drag-and-drop row reordering**
- Add HTML5 native drag events (`draggable`, `onDragStart`, `onDragOver`, `onDrop`, `onDragEnd`) to each `TableRow` in the body.
- Track `dragRowId` and `dropTargetRowId` in state.
- On drop, recompute `sort_order` for all rows and batch-update via Supabase, then invalidate the rows query.
- Add a drag handle icon (GripVertical from lucide) in the `#` column so it's clear rows are draggable.
- Visual feedback: highlight the drop target row with a top-border accent.

**3. Add column-header click sorting (client-side)**
- Add `sortColId` and `sortDir` (`'asc' | 'desc'`) state.
- Clicking a column header toggles sort direction (or sets it as the active sort column).
- Sort `rows` array client-side by comparing `getCellContent(row.id, sortColId)` — smart sort that tries numeric comparison first, falls back to locale string compare.
- Show a small `ArrowUpDown` / `ArrowUp` / `ArrowDown` icon next to the column name to indicate sort state.
- This is purely visual/client-side ordering for viewing — does NOT change `sort_order` in DB. Drag-and-drop changes the persisted order.

### Files modified
- `src/pages/admin/ProductInfo.tsx` — all changes in this single file

### Technical details
- Drag reorder uses the same pattern as KanbanAdmin/LinksAdmin (HTML5 native drag events, batch `sort_order` update).
- Column sort is stateless (reset when switching tabs via `setActiveTab`).
- New imports: `GripVertical`, `ArrowUpDown`, `ArrowUp`, `ArrowDown` from lucide-react.

