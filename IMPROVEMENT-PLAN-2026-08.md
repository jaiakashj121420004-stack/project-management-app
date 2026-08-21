# Aurora — Improvement Plan (Aug 2026)

*A session-by-session build plan. Not a replacement for `plan.md` (the architecture spec) — this is the punch list from your 15 Aug 2026 planning session, sequenced and turned into copy-paste prompts.*

## How to use this file

Each task below is meant to be **its own fresh Claude Code session**, opened in the Aurora project root (`C:\Users\jaiak\Desktop\CLAUDE WORKSPACE\Project Management app`). CLAUDE.md auto-loads there, so the session already knows the golden workflow (read `memory.md` → do the work → update `memory.md` → commit). Each prompt below is self-contained: paste it in as the first message of a new session and it has everything it needs — the current file names, the current bug/gap, the exact fix, and what "done" looks like.

**Order matters less than it looks.** Tasks are sequenced easy→hard and grouped so early tasks make later tasks cheaper. Nothing here is tightly coupled unless a task's own "Depends on" line says so.

**Thinking-effort labels** (Sonnet Low / Medium / High) reflect how much the task rewards careful reasoning vs. how mechanical it is — not how long it'll take. Set these deliberately; over-thinking a mechanical task wastes tokens, under-thinking a design-judgment task produces slop.

**Skipped for now, by your call:** Play Store / App Store presence. The strategy report (§11) already recommends staying web-only until there are paying users, and you confirmed you don't want to touch this yet. No task below covers it — revisit later using that report section.

**2026-08-20 — trimmed to active work only.** Tasks 1-14 and 16-25 (everything except the Marketing plan) were verified DONE against the actual repo, not just taken on memory.md's word: every one of them has a matching commit on `main`, confirmed reachable from `main`'s current HEAD via `git merge-base --is-ancestor`, and `main` matches `origin/main` (already pushed). Their full write-ups were removed from this file to keep it focused on what's actually left — a compact reference list with each one's commit hash lives at the very end of this file if you ever need to trace one back. **What's left, in order: Task 15 (Marketing plan, deliberately deferred), then Tasks 26-38** (from the 2026-08-20 Notes/Canvas/Calendar planning pass with Claude/Cowork — timer, editor bugs, sharing, exports, and calendar polish).

**Two standing rules for every task below, added 2026-08-20 — worth carrying forward to any task added after these too:** **(1)** every prompt still ends with the golden workflow (update memory.md, typecheck/build, commit) but now ALSO requires the session's final chat reply to print, verbatim and copy-paste-ready, the exact Windows Command Prompt commands for that session (npm install/typecheck/build, the exact `git add <files> && git commit -m "..."` line, `git push`) and, for any task that adds a migration, the full SQL text of that migration typed out in the reply too — not just "apply the migration file," the actual SQL — so it can be pasted directly into the Supabase SQL editor without hunting for the file. **(2)** Tasks 33 and 34 add attributes to the schema shared with Canvas's live collaborative documents (`src/features/editor/extensions.ts`) — treat any future addition to that shared schema with the same care: changes go in BOTH `blockExtensions` and `collabBlockExtensions`, and backward compatibility with documents that predate the change must be explicitly verified, not assumed.

---

## Task 15 — Marketing plan (separate future session, after everything above)

**Session effort: Sonnet Medium-High thinking**
**Depends on:** literally everything else in this plan — you were explicit this is tackled last, in its own new session, once the product itself is in its finished state.

**Note for when you get there:** the existing `reports/Aurora_Full_Strategy_Report_2026-08-13.html` already has a full marketing strategy section (§10) with channel-by-channel research, a 90-day budget, and message-testing angles — that session shouldn't start from zero, it should treat that section as the draft and turn it into the dedicated, more detailed pre-launch/post-launch marketing plan HTML you asked for, refreshing anything that's changed in the meantime (pricing, feature set, what's actually shipped vs. planned by then). I'm not writing that session's prompt now since you asked for this to be planned fresh, later, once the rest of this list is done and the product's real shape by then is known — writing a detailed prompt for it today would be guessing at a moving target.

---

## Task 26 — Fix floating-menu/toolbar clipping (Notes slash menu, Canvas text toolbar)

**Session effort: Sonnet Low thinking** (positioning/CSS bug, mechanical once the root cause is confirmed)
**Depends on:** nothing.

**The bug, as reported (2026-08-20 planning session with Claude/Cowork):** typing `/` to open the slash-command menu near the bottom of a long note clips the menu off-screen (or hides its lower options) instead of flipping it to open upward. Separately, in Canvas, clicking into a text box near the top of the screen sometimes puts its floating formatting toolbar behind the app's top nav bar, so it's unreadable/unclickable.

**Prompt to paste into a new session:**
```
Read memory.md and CLAUDE.md first. Then read
src/features/editor/suggestion/renderer.ts (the Tippy popup that positions the
slash menu — SlashMenu.tsx itself has no positioning logic, it's a plain list),
src/features/editor/suggestion/SlashCommand.ts, src/features/canvas/RichTextBox.tsx,
src/features/canvas/TextFormatToolbar.tsx, and src/features/canvas/canvasText.css
(look at .canvas-table__toolbar and any other absolutely/fixed-positioned
toolbar rules) before changing anything.

1. Slash menu clipping: renderer.ts creates the Tippy instance that anchors
   SlashMenu.tsx to the cursor. Confirm whether it currently sets Tippy's
   `placement`/`flip`/boundary options at all. Configure it to flip to
   `top-start` (or similar) when there isn't enough room below the cursor, and
   constrain it to the viewport (not just the nearest scroll container) so it
   never renders partially off-screen or under the bottom nav on mobile. Test
   by opening `/` on the very last line of a note that's taller than the
   viewport, both with the keyboard visible on a phone-sized viewport and not.

2. Canvas toolbar behind the navbar: TextFormatToolbar is positioned relative
   to the selected text box's on-canvas coordinates. Find where its top/left (or
   transform) is computed and clamp it so it never renders above the app shell's
   top nav (src/components/shell/Topbar.tsx) — either clamp its `top` to a
   minimum offset below the navbar's height, or flip it to appear below the
   text box instead of above when there's no room above. Also give it a z-index
   that's explicitly above the canvas stage but check it doesn't end up above
   modals/dropdowns that should stay on top (grep the app's existing z-index
   scale/tokens rather than inventing a new arbitrary value).

3. Verify both fixes in the actual UI: a note long enough to scroll, slash-menu
   opened on the last visible line; a canvas text box dragged/created near the
   very top of the stage, selected so its toolbar would naturally want to
   render above the navbar.

When finished: update memory.md, run typecheck/build, commit as
`fix: keep the slash menu and canvas text toolbar inside the viewport`. In your
final chat reply, print the exact Windows Command Prompt commands to run
(npm install if any dep changed, npm run typecheck, npm run build, the exact
git add/commit/push lines) — no migration/SQL for this task.
```

**Verification**
- Opening `/` on the last line of a tall note shows the full menu, flipped upward, never clipped — including on a narrow/mobile viewport.
- Selecting a canvas text box near the top of the screen shows its formatting toolbar fully below the navbar, never hidden behind it.
- `npm run typecheck && npm run build` clean.

---

## Task 27 — Advanced time tracking: pause, resume, and reset

**Session effort: Sonnet Low-Medium thinking** (small, well-contained UI + one new mutation; no new table)
**Depends on:** Task 16 (time tracking, already built).

**What's actually happening today, precisely (so this isn't rebuilt from scratch):** `time_entries` already stores every start/stop as its own row (`started_at`, `ended_at` nullable = running), and `TimeTrackingSection.tsx`'s small "h:mm" total (`totalSeconds`) already sums every entry — so time is **not** actually lost between starts. The complaint is about the button itself: `formatHoursMinutesSeconds(entrySeconds(running, now))` only shows the CURRENT running entry's elapsed seconds, so the big button visibly resets to `0:00:00` every time you press Start again, even though the small badge next to it keeps the real cumulative total. There's also no way to clear a card's tracked time (no "reset").

**Prompt to paste into a new session:**
```
Read memory.md and CLAUDE.md first. Then read src/features/board/timeTracking.ts,
TimeTrackingSection.tsx, useCardExtras.ts, and cardExtras.api.ts in full.

Make the per-card timer read as Start / Pause / Reset, not Start / Stop with an
apparent reset-to-zero:

1. Rename the toggle button's PAUSE state (currently "Stop", calls
   useStopTimeEntry): keep the exact same start/stop mutation behavior (it
   already correctly preserves total time across entries), just relabel the UI
   copy/icon (Play/Pause icons instead of Play/Square) so it reads as pausing,
   not stopping-and-losing-progress.

2. Fix the visible "resets to zero" complaint: while running, show the
   CUMULATIVE total (every past entry + the current running entry's elapsed
   seconds) on the big button, not just the current entry's own seconds — i.e.
   `totalSeconds(entries, now)` formatted as h:mm:ss while running, falling
   back to the existing h:mm total display when idle. Remove the now-redundant
   small badge if the button itself shows the live total, or keep both if you
   think showing "total so far" (live) + "this session" (per-entry) side by
   side is clearer — your call, but the running total must be visually obvious
   without doing mental math across sessions.

3. Add a Reset action: a small icon button (RotateCcw or similar, next to the
   Start/Pause button, only visible when the card has any time entries and
   NOT currently running) that, after a confirm step (reuse the same
   inline-confirm pattern DeleteCardDialog.tsx or the note's delete-confirm
   uses — a "Clear tracked time?" chip with Cancel/Clear, not a native
   `confirm()`), deletes every time_entries row for this card. Add
   `deleteTimeEntriesForCard(cardId)` to cardExtras.api.ts (RLS already scopes
   deletes to `user_id = auth.uid()` per existing policy — confirm whether that
   means Reset can only clear the CURRENT user's own entries or all entries on
   the card via can_edit_card; read the existing time_entries RLS in
   supabase/migrations/20260816140000_time_entries.sql and decide + document
   which, matching the existing checklist/label delete permission model on this
   card) and a matching `useDeleteTimeEntries` mutation in useCardExtras.ts,
   optimistically clearing the cache like every other mutation there.

No new migration is needed for this task — it's UI + a delete-only mutation
against the existing table.

When finished: update memory.md, run typecheck/build, commit as
`feat: pause/resume language + cumulative display + reset for card timers`. In
your final chat reply, print the exact Windows Command Prompt commands to run
(npm run typecheck, npm run build, the exact git add/commit/push lines) — no
SQL for this task since no migration is added.
```

**Verification**
- Starting, pausing, and starting again on the same card shows the running total keep climbing on the button itself, never visibly drop to zero.
- Reset (after confirming) clears the card's tracked time and the button returns to "Start timer".
- `npm run typecheck && npm run build` clean.

---

## Task 28 — Guard against accidental image deletion via Backspace in Notes

**Session effort: Sonnet Low thinking** (a keyboard-shortcut override on one existing node)
**Depends on:** nothing.

**The bug, precisely:** `src/features/editor/nodes/NoteImage.ts` / `NoteImageView.tsx` don't override any keyboard handling — ProseMirror's default node-selection behavior applies, so pressing Backspace right after (or with) an image selected removes it in very few presses, with no confirmation. There's already a manual Trash2 delete button in the image's own toolbar (`NoteImageView.tsx`, only visible when selected) — that's the deliberate way to delete; Backspace should stop being an easy accidental path.

**Prompt to paste into a new session:**
```
Read memory.md and CLAUDE.md first. Then read
src/features/editor/nodes/NoteImage.ts and NoteImageView.tsx in full, and
skim how Tiptap node extensions add `addKeyboardShortcuts()` elsewhere in this
repo's nodes/ folder for the existing pattern (there may not be one yet — if
so, this establishes the convention).

Change NoteImage.ts's `addKeyboardShortcuts()` (add it if it doesn't exist) so
Backspace does NOT delete the image node on the first press:

1. When Backspace is pressed and the selection is (or is about to become,
   per ProseMirror's normal Backspace-selects-then-deletes-node behavior) a
   NodeSelection on this image, require the image to already be the selected
   node for a short streak of consecutive Backspace presses (the user asked
   for three) before actually deleting it — track a press counter (component
   state or a small module-level WeakMap keyed by the node, reset whenever
   selection moves off the node or any other key is pressed) rather than
   relying on timing. On presses before the threshold, just keep the node
   selected (swallow the keystroke) — don't delete text before/after it either.
2. Give a small visual cue on each swallowed press so the behavior doesn't feel
   broken — e.g. a brief shake/pulse on the image's border (respect
   prefers-reduced-motion — skip the animation, keep the swallow) or a tiny
   inline hint text ("Press Backspace 2 more times, or use ⌫ delete
   below") appearing in the image's existing toolbar area.
3. The existing Trash2 button in NoteImageView.tsx's toolbar must keep working
   exactly as today — one click, no counter — since that's the deliberate
   delete path this task explicitly keeps available per the user's ask.
4. Do NOT change any other node's (text, table, embed) Backspace behavior —
   scope this to NoteImage only.

When finished: update memory.md, run typecheck/build, commit as
`fix: require 3 backspace presses (or the delete button) to remove a note image`.
In your final chat reply, print the exact Windows Command Prompt commands to
run (npm run typecheck, npm run build, git add/commit/push) — no SQL for this
task.
```

**Verification**
- Placing the cursor right after an image and pressing Backspace once or twice never deletes it (selects it / shows the hint instead); a third consecutive press deletes it.
- The image's own trash-icon button still deletes it in one click.
- Typing/deleting text elsewhere in the note is completely unaffected. `npm run typecheck && npm run build` clean.

---

## Task 29 — Fix the Notes table block (insert / add / remove rows & columns)

**Session effort: Sonnet Low-Medium thinking** (debugging an existing integration, not new design)
**Depends on:** Task 10 (table block, already built).

**What's already there:** `src/features/editor/nodes/tableExtensions.ts` wires up the real official `@tiptap/extension-table` (+ row/header/cell), `resizable: true`. `EditorToolbar.tsx` has a `Table2` icon. The reported bug is that clicking it to insert a table doesn't reliably work, and once a table exists, add/remove row and add/remove column controls aren't reliably available or don't do anything.

**Prompt to paste into a new session:**
```
Read memory.md and CLAUDE.md first. Then read
src/features/editor/nodes/tableExtensions.ts and EditorToolbar.tsx in full,
specifically the Table2 button's onClick handler and any table-row/column
controls (a floating menu, a bubble menu, or per-cell grip handles) that
currently exist or are supposed to exist for an already-inserted table.

1. Reproduce first: insert a table via the toolbar button in a fresh note,
   confirm exactly what breaks (insert does nothing, or works once but a
   second insert fails, or the table inserts but into the wrong position, or
   only fails inside certain contexts like inside a list/Details block).
   Note the exact repro in memory.md even if you find and fix it in the same
   session — this is the kind of bug worth a paper trail.

2. Fix table insertion: the toolbar button should call the standard Tiptap
   table commands (`insertTable({ rows: 3, cols: 3, withHeaderRow: true })` or
   similar) via `editor.chain().focus()...run()`. Confirm the command chain
   actually reaches the editor instance (a stale `editor` closure or a missing
   `.focus()` before the table command are the two most common causes of
   "works sometimes").

3. Add real add/remove row and column controls once a table exists. Tiptap's
   table extension ships the underlying commands
   (addRowBefore/addRowAfter/deleteRow, addColumnBefore/addColumnAfter/
   deleteColumn, deleteTable) — they just need UI. Add a small floating toolbar
   or per-edge "+" affordance that appears when the cursor is inside a table
   (Tiptap's `isActive('table')`), with clear icon buttons for add-row-above/
   below, add-column-left/right, delete-row, delete-column, delete-table.
   Match the app's existing glass/toolbar styling (see ToolbarPopover.tsx or
   TextFormatToolbar.tsx for the visual pattern to reuse, not reinvent).

4. Confirm the static renderer (generateHTML in serialize.ts) renders a saved
   table correctly too (a viewer / exported note must show the table, not lose
   it) — tables aren't in the shared blockExtensions list (by design, per
   tableExtensions.ts's own comment), so double check serialize.ts includes
   noteTableExtensions when generating static HTML for notes.

When finished: update memory.md (the precise root cause found, not just "fixed
tables"), run typecheck/build, commit as
`fix: reliable table insert + add/remove row/column controls in notes`. In your
final chat reply, print the exact Windows Command Prompt commands to run
(npm run typecheck, npm run build, git add/commit/push) — no SQL for this task.
```

**Verification**
- Inserting a table works every time, including a second table later in the same note and a table inside a bullet list item.
- With the cursor in a table, add-row-above/below, add-column-left/right, delete-row, delete-column, and delete-table all work and match the app's visual style.
- A read-only viewer of the note (and the Markdown export) still shows the table correctly. `npm run typecheck && npm run build` clean.

---

## Task 30 — Paste images from the clipboard (Ctrl+V) in Notes

**Session effort: Sonnet Low-Medium thinking** (one editor event handler, reuses an existing upload path)
**Depends on:** nothing — reuses the image upload pipeline already built for the Notes image toolbar (`uploadNoteImage` in `src/features/notes/noteMedia.ts`).

**Prompt to paste into a new session:**
```
Read memory.md and CLAUDE.md first. Then read src/features/editor/BlockEditor.tsx,
src/features/notes/NoteBlockEditor.tsx, src/features/notes/noteMedia.ts, and
src/features/editor/nodes/NoteImage.ts/NoteImageView.tsx in full — the goal is
a paste handler that inserts a NoteImage node using the exact same upload path
the toolbar's file picker already uses, not a second image pipeline.

1. Add a `handlePaste` to the Tiptap editor's `editorProps` (BlockEditor.tsx's
   `useEditor` call, or a small Tiptap extension if that's cleaner to keep
   BlockEditor generic for canvas text boxes too — see constraint 3 below) that
   inspects `event.clipboardData.items` for an `image/*` type. If found:
   `event.preventDefault()`, grab the `File` via `item.getAsFile()`, and upload
   it exactly like the existing "insert image" flow does (`uploadNoteImage`,
   same size/type validation and error messages as the file-picker path — do
   not skip that validation just because it came from a paste).
2. Insert a NoteImage node at the current cursor position with a temporary
   "uploading…" state while the upload is in flight (NoteImageView.tsx already
   has loading/error rendering for a resolving signed URL — reuse that same
   pattern, don't build a second loading UI), replacing it with the real path
   once the upload resolves; show the existing friendly error copy on failure
   rather than silently dropping the paste.
3. IMPORTANT — this must be note-only, not leak into canvas text boxes: notes
   inject NoteImage via NoteBlockEditor's `extraExtensions`
   (NOTE_EXTENSIONS), and canvas text boxes use the plain shared
   `blockExtensions` without it. Implement the paste handler so it only fires
   when the NoteImage extension is actually present in that editor instance
   (check `editor.extensionManager.extensions` or similar) rather than adding
   it unconditionally to BlockEditor's shared editorProps — a paste of an
   image into a canvas text box should keep doing whatever it does today
   (verify what that currently is and don't regress it).
4. Confirm plain-text and rich-text paste (e.g. pasting from Word/Google Docs)
   still work exactly as before — this task only ADDS image-paste handling, it
   must not change any other paste behavior.

When finished: update memory.md, run typecheck/build, commit as
`feat: paste images from the clipboard into notes (Ctrl+V)`. In your final
chat reply, print the exact Windows Command Prompt commands to run (npm run
typecheck, npm run build, git add/commit/push) — no SQL for this task.
```

**Verification**
- Copying an image (from the OS, a browser, or a screenshot tool) and pressing Ctrl+V inside a note inserts it, shows a brief loading state, then renders — same as using the image toolbar button.
- An oversized or unsupported-type pasted image shows the same friendly error the file picker shows, and doesn't insert a broken node.
- Pasting an image into a Canvas text box is unaffected (whatever it did before, it still does). Regular text paste is unaffected. `npm run typecheck && npm run build` clean.

---

## Task 31 — Drag-and-drop reordering of blocks inside Notes

**Session effort: Sonnet High thinking** (new interaction surface on top of ProseMirror; getting drag handles right without breaking selection/collab is genuinely fiddly)
**Depends on:** nothing directly, but do after Task 29 (table fix) so the drag handle can be tested against a table block too, and be aware of Task 9's to-do drag-and-drop work as prior art for this repo's dnd-kit conventions (different library — Tiptap/ProseMirror doesn't use dnd-kit for in-document block dragging — but the interaction-quality bar it set, and its gesture-conflict lessons, apply here).

**Why this is the trickiest task in this batch:** the note editor's schema (`blockExtensions` in `src/features/editor/extensions.ts`) is explicitly shared, verbatim, with Canvas's collaborative Yjs text boxes — the file's own header comment says so. A drag-handle feature belongs to NOTES ONLY (a small canvas text box doesn't need or want a left-margin block-drag gutter), so it must NOT be added to the shared `blockExtensions` array — it has to go through `NoteBlockEditor.tsx`'s `extraExtensions` (`NOTE_EXTENSIONS`), the same note-only injection point `NoteImage`/`NoteEmbed`/tables already use.

**Prompt to paste into a new session:**
```
Read memory.md, CLAUDE.md, and plan.md §5 (the Yjs/collaboration paragraph)
first. Then read src/features/editor/extensions.ts (note its own header comment
about the shared schema), BlockEditor.tsx, NoteBlockEditor.tsx, and
tableExtensions.ts in full.

Add drag-and-drop reordering of top-level blocks (paragraphs, headings, images,
lists, tables, etc.) within a note — a small grip handle in the left margin
next to the block under the cursor, drag it up/down to reorder.

1. RESEARCH FIRST: check for a maintained, MIT/free-licensed Tiptap v3-
   compatible drag-handle extension (the project's own convention — see
   prompts.md's "New dependencies" section — is MIT/free only, no Tiptap Pro
   paid extensions). If nothing suitable and actively maintained exists for
   Tiptap v3, build a minimal custom one instead: a ProseMirror plugin that
   renders a decoration (the grip handle) next to the top-level node under the
   pointer, and uses the native HTML5 drag-and-drop API (or a pointer-based
   custom drag, matching how NoteImageView.tsx's own resize-handle already
   implements pointer capture/move/up) to compute a drop position and move
   that node via a ProseMirror transaction (`tr.delete` + `tr.insert`, or
   `dispatch` a single move transaction — prefer one atomic transaction over
   delete-then-insert so undo is a single step).
2. Scope this to NOTES ONLY: add it via NoteBlockEditor.tsx's
   NOTE_EXTENSIONS array (or a new prop on BlockEditor if the drag-handle
   needs BlockEditor-level wiring — keep it OFF by default, opt-in via a prop,
   so canvas text boxes never render it). Confirm after building that a canvas
   text box's toolbar/behavior is completely unchanged.
3. Interaction details: the handle only appears on hover/cursor-proximity (not
   permanently visible clutter), works with mouse, touch, and — best-effort —
   keyboard (at minimum, don't make block reordering IMPOSSIBLE via keyboard;
   a simple "move block up/down" keyboard shortcut as a fallback is enough,
   full drag-and-drop via keyboard is not required). Dragging a block below/
   above a table or inside/out of a list should behave sensibly — decide the
   exact rules (e.g. you can drag a paragraph out of a bullet list to top
   level, you likely should NOT be able to drag a block INTO the middle of a
   table's cell content) and document the decision in memory.md rather than
   leaving it as unspecified behavior.
4. Autosave: dragging must trigger NoteEditor's existing onChange → debounced
   autosave path exactly like any other edit — don't bypass it.

Constraints: TS strict, no any. Must not touch extensions.ts's shared
blockExtensions array. Must not regress Canvas's collaborative text boxes in
any way — spend real time verifying this, not just "should be fine because I
didn't touch that file."

When finished: update memory.md (including the license/package you chose or
confirmation you built a custom implementation and why), run
typecheck/build/tests, commit as
`feat: drag-and-drop block reordering in notes`. In your final chat reply,
print the exact Windows Command Prompt commands to run (npm install <any new
package> if one was added, npm run typecheck, npm run build, git
add/commit/push) — no SQL for this task.
```

**Verification**
- A grip handle appears next to the block under the cursor in an editable note; dragging it reorders paragraphs, headings, images, list items, and a whole table block up/down; the change autosaves and survives reload; undo (Ctrl+Z) undoes one reorder as a single step.
- A Canvas text box shows no drag handle and behaves exactly as it did before this task, including for two people editing the same canvas text box live.
- `npm run typecheck && npm run build` clean.

---

## Task 32 — A View-mode toggle for Notes (mirrors Canvas's Edit/View toggle)

**Session effort: Sonnet Medium thinking** (small, but touches the note header's layout)
**Depends on:** nothing. Canvas already has this pattern built (see prompts.md's P3.1b — an Edit/View segmented toggle on `CanvasEditor.tsx` for `canEdit` users, hiding editing controls in View mode) — this task is bringing Notes up to the same parity, it is a DIFFERENT thing from the existing viewer-role read-only rendering (`NoteEditor.tsx`'s `canEdit` prop, driven by `note_members` sharing roles) which already exists and must be left alone.

**The gap, precisely:** an editor/owner of a note currently has no way to preview it read-only without actually being in edit mode — there's no self-serve "View" toggle the way Canvas has one. Add it.

**Prompt to paste into a new session:**
```
Read memory.md and CLAUDE.md first. Then read src/features/notes/NoteEditor.tsx,
NoteBlockEditor.tsx, BlockEditor.tsx, and src/features/canvas/CanvasEditor.tsx
(specifically wherever it implements its existing Edit/View segmented toggle —
find and match that component/pattern, most likely the same
SegmentedToggle.tsx used elsewhere in the app) in full before changing
anything.

1. Add local `viewMode` state to NoteEditor.tsx (default: Edit), only shown/
   usable when `canEdit` is true (a viewer already always gets the read-only
   render via the existing `canEdit` prop — do not add a second, redundant
   toggle for them).
2. Add a small Edit/View SegmentedToggle in the note header, next to (not
   replacing) the existing Save indicator/Export/Share/Delete controls — match
   Canvas's placement and styling for consistency users will recognize.
3. Compute the `editable` prop passed into NoteBlockEditor as
   `canEdit && viewMode === 'edit'` (both must be true to actually edit) — in
   View mode, BlockEditor.tsx already calls `editor.setEditable(false)`
   reactively (see its existing useEffect), so this should require no changes
   to BlockEditor itself, just the prop NoteEditor passes down. Confirm the
   toolbar (EditorToolbar, only rendered when `editable` is true in
   BlockEditor) correctly disappears in View mode.
4. Make sure autosave/dirty-state logic doesn't get confused by toggling View
   mode mid-edit — flushing any pending unsaved change before switching to
   View is the safest behavior (reuse the existing flush-on-unmount ref
   pattern already in NoteEditor.tsx).

When finished: update memory.md, run typecheck/build, commit as
`feat: Edit/View toggle for notes, matching canvas`. In your final chat reply,
print the exact Windows Command Prompt commands to run (npm run typecheck, npm
run build, git add/commit/push) — no SQL for this task.
```

**Verification**
- As an editor/owner, switching a note to View mode hides the formatting toolbar and makes the document read-only (no cursor edits possible); switching back to Edit restores editing exactly where it left off, with no lost changes.
- A viewer (via sharing) still sees the same read-only render as before, unaffected by this toggle. `npm run typecheck && npm run build` clean.

---

## Task 33 — Subscript, superscript, and mathematical formulas in the shared editor

**Session effort: Sonnet High thinking** (changes the SHARED Tiptap schema used by both notes and Canvas's live collaborative text boxes — the highest blast-radius task in this batch, treat it with the same care as a data-model change)
**Depends on:** nothing, but read plan.md §5's Yjs/Canvas collaboration paragraph in full before starting — any node added to `blockExtensions` becomes part of every EXISTING stored note/canvas document's schema.

**Why this one needs extra care:** `src/features/editor/extensions.ts` is explicitly the ONE schema shared by the live editor (`BlockEditor`/`RichTextBox`) AND the static renderer (`generateHTML` in `serialize.ts`) — its own header comment says a document must round-trip losslessly through both. Canvas text boxes are also live, multi-user, Yjs-CRDT-synced (P3.7 in plan.md) — a new node type has to serialize/deserialize compatibly for documents that were created BEFORE this change too (an old note with no math nodes must still open fine; adding the extension must not break existing content).

**Prompt to paste into a new session:**
```
Read memory.md, CLAUDE.md, and plan.md §5 (the Yjs/canvas collaboration
paragraph) in full first. Then read src/features/editor/extensions.ts (both
blockExtensions AND collabBlockExtensions — a math node must be added to BOTH,
they must stay in lockstep per the file's own comment), BlockEditor.tsx,
EditorToolbar.tsx, and serialize.ts's generateHTML usage.

1. Subscript/superscript (the easy half): add the official
   `@tiptap/extension-subscript` and `@tiptap/extension-superscript` (MIT,
   maintained by the Tiptap team — same trust tier as the extensions already
   in this file) to BOTH `blockExtensions` and `collabBlockExtensions` in
   extensions.ts. Add matching toolbar buttons to EditorToolbar.tsx (an "x²"/
   "x₂"-style icon pair, near Bold/Italic/Underline) and, if canvas's
   TextFormatToolbar.tsx has its own separate button set (check — it might
   share EditorToolbar or have its own), add them there too so Notes and
   Canvas text boxes both get them, matching the schema being shared.

2. Math formulas (the hard half) — RESEARCH FIRST: web-search for a
   maintained, MIT/free-licensed Tiptap v3-compatible math extension (KaTeX-
   based) as of now. If a good one exists, evaluate it against this
   constraint list before adopting: (a) renders via KaTeX (small, fast, MIT —
   do not reach for MathJax, it's much heavier), (b) stores the formula as
   plain LaTeX source in the node's JSON attrs (not pre-rendered HTML — the
   static renderer must be able to re-render it, and a Yjs CRDT needs a plain
   serializable value, not a DOM node), (c) works as an inline node (for
   `$x^2$`-style inline math) and ideally also a block node (for
   `$$...$$`-style standalone equations) — build whichever of the two the
   library gives you cleanly; both is nice-to-have, inline is the minimum bar.
   If nothing suitable exists, build a minimal custom Tiptap Node: attrs
   `{ latex: string }`, a NodeView that renders KaTeX's `renderToString` output
   via `dangerouslySetInnerHTML` (KaTeX's own output is safe to inject — it's
   not raw user HTML, it's KaTeX's rendered markup from a LaTeX string you
   control the input surface of; still validate/catch KaTeX parse errors
   gracefully rather than crashing the editor on invalid LaTeX), and a small
   inline editing UI (click to open a text input pre-filled with the LaTeX
   source, live KaTeX preview, Enter/Escape to commit/cancel).
3. Slash-menu integration: add a "Math formula" item to
   src/features/editor/suggestion/slashItems.ts so `/math` (or similar) inserts
   one, consistent with how every other block type is inserted in this editor.
4. Bundle size: KaTeX ships its own CSS + font files — confirm they're only
   loaded by the already-lazy notes/canvas chunk (per this file's existing
   "lazy-load the whole canvas/editor module" convention), not the app shell.
5. Backward compatibility, explicitly verified: open (or construct a test
   fixture from) a note/canvas document that predates this change and confirm
   it still opens with no console errors and no data loss — the new node types
   being unknown to old code was never a risk (old code doesn't exist anymore
   post-deploy), but the REVERSE — new code encountering documents that simply
   don't contain the new node types yet — must be a complete non-event.

When finished: update memory.md (record which library was chosen and why, or
that a custom node was built and why nothing suitable existed), run
typecheck/build/tests, commit as
`feat: subscript, superscript, and math formulas in the shared editor`. In your
final chat reply, print the exact Windows Command Prompt commands to run
(npm install <chosen packages>, npm run typecheck, npm run build, git
add/commit/push) — no SQL for this task (no schema/table changes, only the
Tiptap document schema, which lives in jsonb columns that already accept any
shape).
```

**Verification**
- Sub/superscript toolbar buttons work in both Notes and Canvas text boxes; formatting survives reload and the Markdown/static export.
- Inserting a math formula (via slash command or toolbar), typing LaTeX, and committing it renders correctly via KaTeX in both the editable and read-only/static render; an invalid LaTeX string shows a graceful inline error, not a crash.
- Two people editing the same Canvas text box that contains a math formula see it sync live without corrupting the CRDT doc; a pre-existing note/canvas document with no math nodes opens with zero errors.
- `npm run typecheck && npm run build` clean.

---

## Task 34 — Table of contents / jump-to-heading links for long notes

**Session effort: Sonnet Medium thinking**
**Depends on:** nothing.

**Prompt to paste into a new session:**
```
Read memory.md and CLAUDE.md first. Then read src/features/editor/extensions.ts
(headings go to 3 levels, per its own comment), BlockEditor.tsx, and
NoteEditor.tsx in full.

Add an auto-generated, clickable table of contents for notes with headings.

1. Heading anchors: headings need stable, unique ids to link to. Add a small
   Tiptap extension (`addGlobalAttributes` on the `heading` type, similar in
   shape to the existing ListStyle extension in extensions.ts — follow that
   exact pattern) that assigns each heading node a stable `id` attribute,
   generated once on creation (a short random slug or a slugified-title-plus-
   uniqueness-suffix — decide which reads better in a URL/anchor and is stable
   even if the heading text is later edited; a slug that changes when text
   changes would break existing links, so prefer a stable random/uuid-based id
   over a text-derived slug unless you have a good reason). This is a schema
   change (a new attribute on an existing node type) — like Task 33, add it
   to BOTH blockExtensions and collabBlockExtensions, and confirm old
   documents without the id attribute still open fine (default to generating
   one lazily on first render if missing, rather than requiring a migration
   pass over every existing note).
2. A collapsible "Contents" panel: a small floating or docked panel (your call
   on placement — a collapsed button in the note header that expands a list,
   or a persistent left-edge rail on wide screens that collapses on mobile;
   look at how LayersPanel.tsx in canvas handles a similar collapsible-panel
   UI for a pattern to reuse) listing every heading in the current document,
   indented by level (H1/H2/H3), generated by walking the live editor's JSON
   (`editor.getJSON()`) — must update live as headings are added/removed/
   edited, not just on load.
3. Clicking an entry scrolls the note's content smoothly to that heading and
   (nice-to-have, not required) briefly highlights it. Only show the panel
   when the note actually has 2+ headings — don't clutter short notes with an
   empty/pointless TOC.
4. This should work in the read-only/View mode (Task 32) and for a shared
   viewer too, not just while editing.

When finished: update memory.md, run typecheck/build, commit as
`feat: table of contents with jump-to-heading links for notes`. In your final
chat reply, print the exact Windows Command Prompt commands to run (npm run
typecheck, npm run build, git add/commit/push) — no SQL for this task.
```

**Verification**
- A note with several headings shows a Contents panel listing them all, correctly indented by level; clicking any entry jumps to that heading.
- Adding, renaming, deleting, or reordering (if Task 31 has landed) a heading updates the panel live.
- A short note with 0-1 headings shows no panel. Works for a read-only viewer too. `npm run typecheck && npm run build` clean.

---

## Task 35 — Export a note as PDF

**Session effort: Sonnet Medium-High thinking** (new export surface, Pro-gated; text-fidelity and print-styling both matter)
**Depends on:** the existing Pro foundation (`useIsPro`/`<ProGate>`/`proFeatures.ts`, already built). Do this AFTER Tasks 29 (tables), 33 (math), and 34 (TOC) if you want the export to faithfully cover those; not a hard blocker if the user wants PDF export sooner — just note in memory.md that tables/math/TOC rendering in the exported PDF should be re-checked once those tasks land.

**Scope decision, made with the user (2026-08-20):** both PDF and Word export, Pro-gated, for notes. This task is PDF only — Word (.docx) is the next task, deliberately separate (different rendering approach entirely, no shared code to speak of beyond "get the current document").

**Prompt to paste into a new session:**
```
Read memory.md, CLAUDE.md, and plan.md's Pro-gating section first. Then read
src/lib/proFeatures.ts, src/features/billing/useIsPro.ts + ProGate.tsx, and
src/features/notes/NoteEditor.tsx's existing `handleExport` (Markdown export,
the precedent for "export the current document including unsaved edits") and
src/features/editor/serialize.ts's `generateHTML` usage (the static-render
path already used for read-only viewers) in full.

Add a Pro-gated "Export as PDF" action to NoteEditor.tsx, next to the existing
Markdown export button.

1. Approach: generate the note's already-existing static HTML render (reuse
   generateHTML from serialize.ts — the exact same schema/output the read-only
   viewer already produces, so tables/math/images/formatting all render
   identically to what's on screen, not a second bespoke renderer) inside a
   hidden iframe with a dedicated print stylesheet (page margins, font
   fallbacks since Fraunces/Spectral are loaded via Google Fonts and must
   actually be available to the print render, sensible page-break behavior so
   a heading doesn't strand at the bottom of a page), then trigger the
   browser's native print-to-PDF via `iframe.contentWindow.print()`. This
   needs no new npm dependency and produces real, selectable text (not a
   rasterized image) — prefer it over a canvas-rasterization library
   (html2canvas+jsPDF) unless you hit a concrete blocker that approach can't
   handle, in which case document why in memory.md before switching.
2. Gate behind Pro: wrap the button/action in the existing `<ProGate>` pattern
   (see how canvas or another Pro feature gates a single action, not a whole
   page, for the right component shape) — a free user sees an upgrade CTA
   instead of an export button. This is UI gating only per this repo's
   existing double-gate principle; there's no new server-side data being
   created here (nothing is stored), so there is no RLS/migration angle to
   this task — the "double gate" doesn't apply the same way it does to
   inserts, but do confirm nothing about the export path leaks content a free
   user shouldn't have access to in the first place (e.g. it must still
   respect `canEdit`/note access, not bypass it).
3. Include the note's title as the PDF's heading/filename
   (`<title>.pdf` via `<title>` in the iframe doc, matching how the Markdown
   export already sanitizes the filename).
4. Images: signed URLs (`useNoteMediaUrl`) are short-lived — confirm the
   images actually load inside the print iframe before printing is triggered
   (a naive approach might print before signed URLs resolve, producing broken
   image placeholders in the PDF) — wait for all `<img>` elements in the
   iframe to fire `load` (or `error`, handled gracefully) before calling
   `.print()`.

When finished: update memory.md, run typecheck/build, commit as
`feat: export a note as PDF (Pro)`. In your final chat reply, print the exact
Windows Command Prompt commands to run (npm run typecheck, npm run build, git
add/commit/push) — no SQL for this task (no new table/migration).
```

**Verification**
- A Pro user sees an "Export as PDF" button; clicking it opens the browser's print dialog pre-loaded with the note's content, correctly styled, with images, tables, headings, and (once Task 33/34 land) math and TOC entries all rendering — "Save as PDF" from that dialog produces a real, selectable-text PDF.
- A free user sees an upgrade CTA instead of the export button, and a viewer without edit access can't reach the action either.
- `npm run typecheck && npm run build` clean.

---

## Task 36 — Export a note as Word (.docx)

**Session effort: Sonnet Medium-High thinking** (a real new dependency + a document-model conversion, but no schema/data changes)
**Depends on:** Task 35's Pro-gating pattern (reuse it, don't reinvent). Same "do after 29/33/34 for full fidelity, not a hard blocker" note applies.

**Prompt to paste into a new session:**
```
Read memory.md, CLAUDE.md, and plan.md's Pro-gating section first. Then read
Task 35's completed implementation in NoteEditor.tsx (reuse its ProGate
wiring and "current document including unsaved edits" pattern —
`currentDoc()` already exists in NoteEditor.tsx for exactly this purpose), and
src/features/editor/serialize.ts in full (you'll be walking the same Tiptap
JSON doc, not the HTML render this time).

Add a Pro-gated "Export as Word" action next to PDF export (Task 35) and the
existing Markdown export.

1. RESEARCH FIRST, briefly: confirm the current recommended MIT/free npm
   package for generating real .docx files client-side as of now (the `docx`
   package on npm has historically been the standard choice for this — verify
   it's still maintained/current, don't assume without checking).
2. Write a converter from the note's Tiptap JSON document (same source
   `currentDoc()` already exposes) to that library's document-building API:
   paragraphs, headings (levels 1-3), bold/italic/underline/strike/highlight/
   text color, bullet + ordered lists (including the app's custom list styles
   from BULLET_LIST_STYLES/ORDERED_LIST_STYLES if the library supports custom
   bullet glyphs, otherwise fall back to the closest native Word equivalent
   and document the limitation), task lists (render as a checkbox glyph +
   text, Word has no native interactive checkbox in a portable way), tables
   (Task 29), links (safe href only, reuse `safeLinkHref` from extensions.ts
   rather than re-validating), and images (fetch each image's signed URL and
   embed the actual image bytes into the docx — don't leave a broken
   reference). For subscript/superscript and math formulas (Task 33): render
   sub/superscript natively (the docx library almost certainly supports this
   directly); for math, since Word's native equation format (OMML) is a
   different format than LaTeX, the pragmatic v1 approach is to render the
   KaTeX-rendered formula as a small embedded IMAGE in the docx (rasterize the
   formula's HTML/SVG to a PNG client-side) rather than attempting a
   LaTeX-to-OMML conversion — document this as a deliberate v1 simplification
   in memory.md, not a silent gap.
3. Trigger a real file download of the generated .docx (the library's own
   Blob-generation + the same `URL.createObjectURL` + anchor-click download
   pattern the existing Markdown export already uses), named after the note's
   title.
4. Gate behind the same `<ProGate>` pattern as Task 35.
5. Bundle size: this new dependency should only ever load inside the already-
   lazy notes editor chunk, ideally dynamically imported only when the export
   button is actually clicked (not eagerly bundled with the rest of the note
   editor) — confirm with a bundle check.

When finished: update memory.md (note which npm package was chosen, its
license, and the documented v1 simplifications — especially the math-as-image
decision), run typecheck/build/tests, commit as
`feat: export a note as Word/.docx (Pro)`. In your final chat reply, print the
exact Windows Command Prompt commands to run (npm install <chosen package>,
npm run typecheck, npm run build, git add/commit/push) — no SQL for this task
(no new table/migration).
```

**Verification**
- A Pro user exports a note containing headings, formatted text, a list, a table, an image, and a link — the downloaded .docx opens correctly in Word/Google Docs/LibreOffice with all of that intact and readable.
- A free user sees the upgrade CTA instead. The new dependency is confirmed to only load on-demand (bundle stays lean per this repo's standing guardrail). `npm run typecheck && npm run build` clean.

---

## Task 37 — Sharing & collaborators: finish it for notes and canvas

**Session effort: Sonnet Medium thinking** (mostly completing/auditing an already-built system, not designing a new one — read carefully before assuming anything is missing)
**Depends on:** nothing — this is largely already built. **Read this task's "what's already there" section closely before writing any code; the gap may be smaller than it looks.**

**What's already there, confirmed by reading the actual code (2026-08-20):** `src/features/sharing/` already has a full `note_members`/`canvas_members` data layer (`api.ts`: `fetchCollaborators`, `shareTarget`, `setCollaboratorRole`, `removeCollaborator`, both roles = `editor`/`viewer`) and a `useSharing` hook. `NoteEditor.tsx` already renders a `<ShareButton kind="note" .../>` — but ONLY when `canShare = note.project_id === null && note.owner_id === user?.id`, i.e. **standalone (Library) notes owned by the current user only** — a note that belongs to a project has NO sharing UI today (project membership is the only access control for those). Canvas has the equivalent already for INDEPENDENT (project-free) personal canvases per plan.md's P3.1c decisions (`canvas_members`, an owner-only Share control) — confirm project-scoped canvases are in the same "no per-canvas sharing, only project membership" state as project notes, or whether they differ.

**Prompt to paste into a new session:**
```
Read memory.md, CLAUDE.md, and plan.md §5-6 (canvas sharing model + security)
first. Then read src/features/sharing/{api.ts,useSharing.ts,ShareButton.tsx,
SharePanel.tsx} and src/features/notes/NoteEditor.tsx's `canShare` line in
full. Also read the note_members / canvas_members RLS in
supabase/migrations/20260714120000_sharing.sql and
20260622200000_canvas_standalone.sql (or wherever canvas_members actually
lives — confirm the exact migration file) before touching any policy.

1. Audit first, change nothing yet: open the app as a real user and confirm,
   precisely, what currently works — share a standalone note, share an
   independent (project-free) personal canvas, and note down what happens
   for (a) a note inside a project and (b) a canvas inside a project. Record
   the actual current behavior in memory.md before writing any fix, since the
   task brief's belief (project-scoped notes/canvases have no per-item sharing
   today, only project membership) should be VERIFIED, not assumed.
2. If project-scoped notes/canvases indeed have no finer-grained sharing than
   "every project member can edit" (the likely finding): decide, and document
   the decision, whether that's actually a gap worth closing or working as
   intended — a card/board's whole point is shared project membership, and
   adding a SEPARATE per-note viewer/editor override on top of project
   membership is a meaningfully bigger feature (a note inside a project could
   then be MORE restrictive than the project itself, which raises new
   questions: can a project owner override it? should it be checked against
   `reports/SIMPLICITY-GUARDRAIL.md`, since this is exactly the kind of
   permission-matrix complexity that guardrail exists to catch?). If the
   user's actual want was simpler — "let me share MY standalone notes/personal
   canvases with specific people, view or edit" — that already fully works
   today, and this task can conclude with a UI polish/visibility pass
   instead (see step 3) rather than a new permission system. Use your
   judgment, informed by the audit, and say clearly in memory.md which path
   you took and why.
3. UI polish/visibility pass (do this regardless of the decision in step 2):
   confirm the Share button is easy to find (not `hidden sm:inline-flex`-only
   on a note if mobile users need it too — check NoteEditor.tsx's className
   there), the collaborator list shows names/avatars clearly, role changes
   take effect live for the affected user (check whether note/canvas
   viewer-vs-editor access re-checks live or requires a reload — if it needs
   a reload, that's a real bug worth fixing: a demoted viewer should lose
   edit access without needing to refresh), and removing a collaborator
   immediately revokes access.
4. If, based on the audit, per-note sharing for PROJECT notes genuinely is
   the ask (re-read the original request with the user if you're unsure
   rather than guessing): extend `note_members`/RLS to layer on top of
   project membership for project-scoped notes specifically, following the
   exact same SECURITY DEFINER helper pattern (`can_access_note`/
   `can_edit_note`) already used for standalone notes and independent
   canvases — do not weaken any existing project-membership check to do this.

Constraints: TS strict, no any. RLS is the real gate, UI is UX only — do not
rely on the client to hide something the DB would still allow. Match Aurora
styling.

When finished: update memory.md (the audit findings first, then what was
changed and why) and, if any RLS/table changed, add a
`supabase/migrations/<ts>_<name>.sql` file, run typecheck/build/tests, commit
as `fix: complete sharing UI for notes and canvas` (or `feat:` if step 4's new
scope was actually built). In your final chat reply, print the exact Windows
Command Prompt commands to run (npm run typecheck, npm run build, git
add/commit/push) AND, if a migration was added, the full SQL text of that
migration file, typed out in full so it can be pasted directly into the
Supabase SQL editor.
```

**Verification**
- Sharing a standalone note or an independent canvas, as owner, with another user as viewer and as editor both work exactly as designed, are easy to find in the UI, and update live (no reload needed) when a role changes or a collaborator is removed.
- memory.md records a clear, verified statement of what sharing coverage exists for project-scoped notes/canvases after this task, not a guess.
- `npm run typecheck && npm run build` clean.

---

## Task 38 — Calendar: remaining polish beyond Tasks 8 and 25

**Session effort: Sonnet Low-Medium thinking** (small additive polish — the heavy lifting already happened in Tasks 8 and 25)
**Depends on:** Task 8 (borders/today-button/overflow polish, already built) and Task 25 (Timeline/Gantt view, already built).

**Context worth knowing before scoping this session (2026-08-20 planning pass):** when the user asked for "calendar improvements" in this batch, they flagged all three of views/navigation, visual polish, and sync/integrations as areas of interest — but re-reading Task 8 and Task 25 (already shipped per memory.md), most of the obvious ground is already covered: month + week views, a Timeline/Gantt view, drag-to-reschedule, a "Today" jump button, a prominent today highlight, an ICS subscribe feed for Google/Apple/Outlook (Pro-gated), and visible grid borders. **Have the future session start by asking the user, in plain language, what specifically still feels missing or rough** — don't blindly build more calendar surface on the assumption there's a large gap; there may not be one. The items below are genuine, concrete small gaps found by re-reading the current code, offered as a starting list, not a mandate to build all of them blind.

**Prompt to paste into a new session:**
```
Read memory.md and CLAUDE.md first, specifically the 2026-08-15 (Task 8) and
2026-08-20 (Task 25, Timeline/Gantt) memory.md entries in full so you know
exactly what calendar work already shipped. Then read
src/features/calendar/{CalendarPage.tsx,CalendarToolbar.tsx,CalendarGrid.tsx,
DayCell.tsx,AgendaList.tsx,TimelineGrid.tsx} in full.

Before building anything: ask the user directly what specifically still feels
missing or rough about the calendar now that Tasks 8 and 25 have shipped
(month/week views, Timeline/Gantt, drag-reschedule, Today button, today
highlight, ICS sync feed, and visible borders all already exist) — the
original ask was broad ("improve the calendar") and most of the concrete gaps
already had a session. Don't build blind against a stale ask.

If the user confirms there's still real appetite for more, here are three
concrete, genuinely still-open small gaps found by re-reading the current
code — pick from these (or whatever the user actually says) rather than
inventing new calendar surface:

1. Day view: Month, Week, and Timeline all exist, but there's no single-day
   detailed view (useful on a phone, or any day with a lot happening) —
   DayCardsModal.tsx already exists as a "peek" but is a modal, not a real
   navigable view with its own URL/toolbar state. Consider promoting it to a
   fourth CalendarToolbar option if the user wants a real Day view rather than
   a modal.
2. Multi-project visual clarity: confirm the existing project-accent color
   coding stays legible when many projects with visually similar accents
   appear on the same day/week — a compact color-key legend in the toolbar
   (if one doesn't already exist) would help.
3. ICS feed reach: the existing Pro-gated ICS subscribe feed is read-only
   external sync (Google/Apple/Outlook can see Aurora's dates, one-way) — if
   "sync & integrations" was pointing at something more than that (e.g.
   two-way sync, a specific calendar provider's native app integration), that
   is a materially bigger feature (external OAuth, webhook write-backs) and
   deserves its own dedicated task/session with the user's explicit sign-off
   before being scoped, not a quick addition here.

Whatever you build, keep changes additive and small per this file's own
guardrail conventions — no new top-level nav item, no restructuring of the
existing view/state logic.

When finished: update memory.md, run typecheck/build, commit with a message
describing exactly what was added.  In your final chat reply, print the exact
Windows Command Prompt commands to run (npm run typecheck, npm run build, git
add/commit/push) and, if any migration was needed, its full SQL text typed out
for the Supabase SQL editor.
```

**Verification**
- Whatever was actually agreed with the user and built works correctly on both mouse and touch, in both themes, and doesn't regress Month/Week/Timeline/ICS. `npm run typecheck && npm run build` clean.

---

## Completed (verified 2026-08-20 — reference only, not active work)

Every row below was confirmed with `git log` + `git merge-base --is-ancestor <hash> main` against the real repo (not taken on memory.md's word alone) — each commit is a real ancestor of `main`'s current HEAD, and `main` matches `origin/main` (already pushed). Full task write-ups (prompts/verification steps) were removed from this file 2026-08-20 to keep the active list short; `git show <hash>` or the matching memory.md entry has the detail if you ever need it.

| # | Task | Commit |
|---|---|---|
| 1 | Competitor research + Simplicity Guardrail doc | `0503783` |
| 2 | Remove leftover pre-rebrand font dependencies | `9a5f1a9` |
| 3 | Minimal funnel analytics instrumentation | `0b52ef0` |
| 4 | Add to Home Screen button | `5f42386` |
| 5 | Full immersive per-project color re-theme | `432a62a` |
| 6 | Redesign custom background/text color personalization | `a2d9dd7` |
| 7 | Sync theme & personalization preferences across devices | `3e5e912` |
| 8 | Calendar: borders, explainer, small enhancements | `cb19b3d` |
| 9 | To-do & checklist drag-and-drop overhaul | `9663d32` |
| 10 | Table block for Notes and Canvas | `01137c9` |
| 11 | Feature-bloat guardrail + audit pass | `92d7508` |
| 12 | MCP connector — Aurora as an MCP server for Claude | `f5fc03a` |
| 13 | Solo-maintainer "bus factor" runbook | `bdeb552` |
| 14 | Pentest: commission it (readiness pass) | `16d759f` |
| 16 | Time tracking (start/stop, per card) | `20f4315` |
| 17 | Client-facing read-only share link | `27217b0` |
| 18 | File attachments on cards | `368a939` |
| 19 | Starter templates + save-as-template builder | `9505ab6` |
| 20 | Full-text search across cards and notes | `2777fc8` |
| 21 | One-time Trello/CSV import | `fba2eee` |
| 22 | Recurring Kanban cards | `566f1e2` |
| 23 | Rule-builder automations (Pro/Team) | `b41a5d7` |
| 24 | Goals tracking | `265ca42` |
| 25 | Timeline/Gantt view | `f3e997c` |

**Not done — intentionally deferred, not a gap:** Task 15 (Marketing plan) has no commit; it's the first active task below, exactly per its own note ("tackled last, in its own new session, once the product itself is in its finished state").
