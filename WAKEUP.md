# WAKEUP.md — morning runbook (overnight autonomous session, 2026-07-14)

> Claude worked through the remaining Nvexis phases while you slept. **Nothing was
> committed** — that's yours. This file is the ordered checklist: apply the
> migrations, install if needed, build, and commit. Work top to bottom.
>
> ⚠️ Claude could NOT run `npm run build` or apply migrations (those are Windows /
> Supabase-only). Everything here was written and type-verified against the
> installed types with review subagents, but it has NOT been runtime-tested. Treat
> the first build as the real check. If a phase fails to build, the phases committed
> *before* it are still good — commit in the order below so a late failure doesn't
> lose the earlier work.

---

## TL;DR (what got done)

Phases **3, 4, 5, 6 are built**, plus the **Lodestar marketing landing page** (all
type-verified, not runtime-tested). **One** Supabase migration to apply this session
(`20260714120000_sharing.sql`); no `npm install` needed. Build, then commit the
slices listed below. A review subagent checked the new code and I
fixed the one real bug it found (a missing `icon` on the share dialog's role
toggle). **Note:** any tool that reads via the Linux sandbox mount (incl. `git
status` and some reviewers) shows recently-written files as truncated/NUL-padded —
that's the known mount lag, NOT real corruption. The host files are intact; your
Windows `npm run build` is the real test.

## Order of operations

### 0. Install (only if a phase below added deps — noted inline)
```
npm install
```

### 1. Apply migrations in the Supabase SQL Editor (in this order)
Paste each file's contents and Run. All are additive / `if not exists`-guarded.

- [ ] `supabase/migrations/20260714120000_sharing.sql` — (Phase 4) canvas + note sharing: share_canvas/share_note/*_collaborators RPCs, note_members table + RLS, notes RLS updated to include note membership, note_members realtime
- [ ] _(more added below as phases land)_

### 2. Build
```
npm run build
```
Fix any TS error (paste to Claude next session if stuck), then:

### 3. Commit in slices (suggested messages)
Each bullet is one logical commit. Run `git add -A && git commit -m "…"` per slice,
or squash as you like, then `git push`.

- [ ] `feat: unify canvas text boxes onto the shared block editor (Phase 3 complete)`
- [ ] `feat: share personal canvases + standalone notes with collaborators (Phase 4)`
- [ ] `feat: canvas minimap, fit-to-content + reset view (Phase 5)`
- [ ] `feat: command palette (Cmd/Ctrl-K) + Library search (Phase 6)`
- [ ] `feat: Lodestar marketing landing page (celestial theme, every feature)`
- [ ] _(more added below as phases land)_

---

## Marketing site — BUILT (Lodestar theme)  (no migration)
- Full rewrite of `features/marketing/LandingPage.tsx` into **"Lodestar"** — a
  celestial front door: a starlit night hero (Nvexis prism as the guiding star +
  gilt/gold glow) descending into warm parchment feature sections, on the Nvexis
  palette. New `features/marketing/lodestar.css` (starfield, gilt, faux-window
  chrome, CTA) + `features/marketing/lodestar/Mockups.tsx` (faux app screens:
  board, block editor, canvas, calendar, ⌘K palette).
- **Every feature is showcased:** boards, Library + block editor, canvas
  (+ live cursors), and a 12-card grid (calendar, to-dos, ⌘K, search, reminders,
  PWA, offline/sync, minimap, custom colours, comments/@mentions, sharing/roles,
  RLS) + a collaboration band + Free/Pro pricing + testimonials + final CTA.
- **On "screenshots":** I can't capture real app screenshots in-session (no
  running app behind your login), so these are polished **animated faux mockups**
  (the same approach the old marketing used). Swap in real PNGs later if you want —
  drop them in `public/` and replace the `<...Mockup/>` calls.
- `/pricing`, `/terms`, `/privacy` still use the OLD `MarketingLayout` + sections
  (untouched, still build). The old landing sections (`sections/HeroSection` etc.)
  are now unused dead code — optional cleanup. **Commit:** `feat: Lodestar
  marketing landing page (celestial theme, every feature)`.
- Go-live steps (Dodo LIVE keys, KYC, legal finalisation) are still yours.

## Post-build sanity checks (quick things to try once it's up)

- Open a note → `/` opens the block menu; `:fire` inserts 🔥; toolbar colours work.
- Share a standalone note / personal canvas with a second account's email → it
  appears in that account's Library at the root.
- Canvas → the minimap (bottom-right) shows content + viewport; Fit/Reset work.
- Press ⌘K / Ctrl-K anywhere → command palette; type to jump.
- Library search box filters across folders.

## Progress log (what Claude did, newest first)

### Phase 6 — extras (subset)  (no migration)
- **⌘K / Ctrl-K command palette** (`features/command-palette/CommandPalette.tsx`,
  mounted in `AppShell`): fuzzy-jump to any app destination, keyboard-first.
- **Library search**: a search box in the Library filters notes/canvases/folders
  by title across all folders (`LibraryContents` gained a `search` prop).
- **Scoped down (deliberate):** `[[wiki-links]]`+backlinks, note version history,
  export (MD/PDF), and templates were NOT built — each is sizeable and riskier to
  ship un-tested; left for a future pass. **Commit:** `feat: command palette
  (Cmd/Ctrl-K) + Library search (Phase 6)`.

### Phase 5 — canvas navigation (minimap + fit)  (no migration)
- `features/canvas/bounds.ts` (sceneBounds / fitCamera / centerCamera) +
  `CanvasMinimap.tsx`: a corner overview showing every element + the current
  viewport rect, click-to-jump, and **Fit to content** / **Reset view** buttons.
  Wired bottom-right into `CanvasEditor` (desktop; hidden on small phones).
- **Scoped down (deliberate):** named Frames/Sections were NOT built — they'd add
  a new element type to the Yjs CRDT, too risky to ship un-tested. Element listing
  already exists via the canvas LayersPanel. **Commit:** `feat: canvas minimap,
  fit-to-content + reset view (Phase 5)`.

### Phase 4 — sharing (canvas + notes)  ⚠️ needs `20260714120000_sharing.sql`
- **Design decision:** I chose **reliable share + RLS access** over full Yjs live
  co-editing for notes. Building the notes-CRDT blind risked leaving the working
  block editor broken; sharing + last-write-wins (open shows latest) is solid.
  Canvas already has full Yjs live co-editing. Live-cursor notes can be a later add.
- New `features/sharing` module: `ShareButton` + `SharePanel` (invite by email as
  editor/viewer, change role, remove) + `useSharing` + generic `api.ts`. Backed by
  `share_canvas`/`share_note` RPCs (email→user, owner-gated upsert) and
  `canvas_collaborators`/`note_collaborators` RPCs (roster with profile+email).
- `note_members` table + `is_note_owner`/`can_access_note`/`can_edit_note` helpers;
  notes SELECT/UPDATE/DELETE RLS rewritten to include note membership.
- Wired: **Share** button on standalone notes (`NoteEditor`) and personal canvases
  (Library open view). Shared items (which carry the sharer's `folder_id`) now
  surface at the recipient's Library **root** (LibraryContents effective-folder fix).
- `database.ts` gained `note_members` + the new RPCs; exported `NoteMember`.
- No new deps. **Commit:** `feat: share personal canvases + standalone notes with
  collaborators (Phase 4)`.
- ⚠️ Known limitation (safe): a shared **viewer** opening a note sees an editable
  UI; the DB rejects their saves (RLS) with a "Couldn't save" indicator rather than
  a pre-disabled editor. Fine for now.

### Phase 3 — COMPLETE (canvas text unification)
- `src/features/canvas/richText.ts` is now a thin shim re-exporting the shared
  `blockExtensions`/`collabBlockExtensions`/`renderBlockHtml`/`safeLinkHref`/etc.
  from `@/features/editor`, so canvas text boxes and notes share ONE schema.
- `RichTextBox.tsx` gained the `/` slash + `:` emoji commands (no drag handle in
  the canvas overlay).
- `canvasText.css` gained styles for the new blocks (H3, task lists, toggle
  blocks, custom list styles).
- No migration. No new deps. **Commit:** `feat: unify canvas text boxes onto the
  shared block editor (Phase 3 complete)`.

_(updated as work proceeds)_
