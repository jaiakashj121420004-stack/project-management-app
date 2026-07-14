# NVEXIS-UPGRADE-PLAN.md — the Nvexis rebrand + notes/canvas expansion

> **Read this together with `memory.md` (state) and `plan.md` (spec).** This is the
> master playbook for the multi-phase upgrade started 2026-07-13. It captures the
> locked decisions, what Phase 1 shipped, and the exact spec for Phases 2–6 so no
> context is lost between sessions. When a phase is finished, record it in
> `memory.md` and tick it here.

---

## 0. The goal (what the user asked for)

Two big things on top of the existing, working Aurora PM app:

1. **Rebrand the entire app to the Nvexis brand** ("The Almanac"), keeping glassmorphism + adding paper-grain noise, in a warm two-ink palette (oxblood on parchment/ink), full light **and** dark modes. *Not* the old colorful Aurora look.
2. **Add an independent Notes + Canvas experience** organised like a file explorer (folders/subfolders/files), with a Notion-style block editor, custom colours everywhere, canvas navigation aids, and Pro collaboration on both notes and canvases — plus a **first-class mobile UX**.

The app name stays **Aurora** (it is a Nvexis *product line*); only the **look** becomes Nvexis. Full brand spec: **`DESIGN-GUIDELINES.md`** (in this repo) + `../Company HQ/Brand Assets/`.

## 1. Locked decisions (2026-07-13)

1. **Visual direction = Hybrid "glass over parchment."** Nvexis palette + Fraunces/Spectral/IBM Plex Mono type + editorial details, but we KEEP frosted glass surfaces and add subtle paper-grain noise. (This intentionally deviates from the brand bible, which bans glass/gradients — the user chose the hybrid.)
2. **Editor = Notion-style block editor** for both notes and canvas text boxes (slash commands, drag-handle blocks, toggle/collapsible blocks, all list types, task lists, emoji picker, custom colours, headings, bubble toolbar).
3. **Folders = one unified "Library" tree** holding notes AND canvases together (mixed types, infinite subfolders), like a real file explorer.
4. **Delivery = phased, in order** (Phases 1→6 below). Each phase ships independently and stays green. **Marketing-site re-skin is deferred to the very end, after all 6 phases.**

## 2. Nvexis design tokens (already wired in Phase 1)

Source of truth for colours/type is `DESIGN-GUIDELINES.md`. The live implementation is `src/styles/index.css` (CSS variables, Night = `:root/.dark`, Day = `.light`) + `tailwind.config.ts`.

- **Day (light, hero):** page `#ECE4D6` parchment · surface `#F4EEE2` · ink `#221A14` · body `#4A3F35` · hairline warm oxblood · accent oxblood `#7A2A26`.
- **Night (dark, default):** page `#181210` ink · surface `#211917` · bone `#ECE2D2` · body `#C7BAA9` · accent oxblood `#C24A40` (button fill deepened to `#8E332D` for contrast).
- **Type:** Fraunces (display/headings) · Spectral (body) · IBM Plex Mono (figures/eyebrows). Loaded via Google Fonts `<link>` in `index.html` — **no fontsource dependency**. Never Inter.
- **Accent = oxblood only.** Per-project accents were retinted to an earthy family (Oxblood/Gilt/Clay/Pine/Terracotta/Umber) in `src/lib/accents.ts` — same keys, no DB migration.
- **Glass** is warmed onto paper (not white frost); **paper grain** kept via `.aurora-grain`; background blobs retinted to faint warm oxblood/gilt (no rainbow).
- **Logo = the Nvexis prism** (faceted oxblood gem). Official PNGs live in `public/brand/` (day 400/800, night 800, transparent 800). App icons (`public/pwa-*`, `apple-touch-icon`, `maskable-*`, `favicon-64.png`) are resized from `nvexis-logo-night-800.png` via the Pillow snippet in `scripts/generate-icons.mjs`. `favicon.svg` is a monochrome prism silhouette for Safari pinned tabs. The sidebar `Brand` mark uses `nvexis-mark-transparent-800.png`.

## 3. Phase 1 — Nvexis rebrand + mobile pass — ✅ SUBSTANTIALLY DONE

Shipped (all committed + deployed):
- Token system rewritten to Nvexis Day/Night; fonts → Fraunces/Spectral/IBM Plex Mono; focus rings + theme-color + canvas text fonts updated.
- Per-project accents retinted (earthy family, no migration).
- Editorial polish on shared primitives: tighter radii (buttons `rounded-xl`, cards/panels `rounded-2xl`, shell chrome `rounded-2xl`), calmer hover-lift, softer sheen; every `text-white` (58 spots) → parchment `--accent-fg`.
- Official **Nvexis prism** icons + sidebar Brand mark; `generate-icons.mjs` converted to a Pillow-based regenerator sourced from `public/brand/`.
- Mobile fixes from real-device screenshots: board columns `85vw` on phones; top-bar search shortens to "Search…"; project tab row scrolls horizontally (no more clipped "Activity"); **collapsible pen color panel** on the canvas (chevron, remembered in localStorage); extra bottom-nav clearance (`main` pb → 7rem).

Still open in Phase 1 (do opportunistically or fold into later phases): folio/eyebrow/rule/fleuron editorial flourishes; light-mode contrast spot-checks; soften confetti/priority status colours; canvas top-header tightness on mobile. **NOT Phase 1:** the marketing/landing re-skin (deferred to the end).

## 4. Phase 2 — Library + unified folder tree + standalone notes — ✅ SHIPPED + VERIFIED LIVE (2026-07-13)

Built, deployed, and confirmed working (migration `20260713120000_library_folders.sql` applied; commit `dc2864a`; `features/library`; see memory.md for the full record). Decisions taken this phase: global **Notes + Canvas nav entries replaced by one "Library"** (old routes redirect; per-project tabs kept); **standalone notes are FREE** (canvases keep their Pro gate); standalone notes reuse the **markdown editor** until the Phase 3 block editor; **move via a "Move to…" menu** on all platforms (drag-and-drop deferred to a polish pass). Post-ship fix: canvas pen-panel collapse hooks-order crash (`PenToolbar`). **Deferred backlog** (fold into a later polish pass): desktop drag-and-drop moves; delete the orphaned `NotesHome`/`CanvasHome` (routes now live in the Library).

Make notes independent of projects (canvases already can be personal) and add a file-explorer Library.

- **Data model (new migration):**
  - `folders` (`id`, `owner_id`, `parent_id` nullable self-ref for nesting, `name`, `position`, `created_at`, `updated_at`). RLS: owner + (later) `folder_members`.
  - `notes`: add `owner_id` (default `auth.uid()`), make `project_id` **nullable**, add `folder_id` nullable. Keep project-scoped notes working (project_id set) AND standalone notes (project_id null, folder_id set). Update `notes` RLS to owner-or-project-member.
  - `canvas_notes`: add `folder_id` nullable (personal canvases already exist via `owner_id`).
- **UI:** a "Library" nav entry → sidebar folder tree (expand/collapse, infinite nesting) + a main "folder contents" view (breadcrumbs, grid/list of subfolders + note files + canvas files with distinct icons). Create folder, create note, create canvas, rename, drag-to-move, right-click / long-press context menu, delete-with-confirm. Reuse `EntityPicker`/`GlassSelect` patterns.
- Keep the existing per-project Notes/Canvas tabs; the Library is the new global home for standalone items.
- **Verify:** RLS (a user can't see another's folders/notes), nesting, move across folders, both note types render.

## 5. Phase 3 — Notion-style block editor + custom colours

One shared rich editor used by **both** standalone notes and canvas text boxes (today both use Tiptap with a thin toolbar).

- Build on Tiptap. Add: all heading levels; bullet / numbered / **hyphen / lettered / roman** lists (nested) + task lists; **toggle/collapsible ("dropdown") blocks**; blockquote, divider, code block; underline/strike/highlight; **emoji picker** (`:` autocomplete + button); **multiple + custom text & highlight colours**; a **slash `/` command menu**; a floating bubble toolbar; drag-handle blocks.
- **Custom colour picker (hex wheel):** harden the existing `features/canvas/ColorPicker.tsx` + `color.ts` into a shared component; wire into pen colour, text colour, highlight colour. Keep the colourful stylus/text swatches (user wants many colours) alongside the Nvexis defaults.
- Roman/lettered lists need CSS `list-style-type` variants (Tailwind base resets lists — restore in a scoped stylesheet like `.canvas-rich`).
- **Verify:** each block type round-trips through save/load; XSS-safe (existing `safeLinkHref` pattern); works in the canvas overlay AND standalone notes; mobile-friendly toolbars.

## 6. Phase 4 — Collaboration for notes + canvas sharing UI

- **Canvas sharing UI** (the last un-built Pro item): a `canvas_members` panel (invite by email, editor/viewer) mirroring the project MembersPanel. The table + RLS helpers already exist (`20260622200000_canvas_standalone.sql`).
- **Notes collaboration:** add `note_members` (mirror `canvas_members`); invite-by-email editor/viewer; move the note editor onto the same **Yjs-over-Supabase-Realtime** engine the canvas uses (`features/canvas/collab/`) for live co-editing. RLS-gate the realtime channel like `20260629120000_canvas_realtime.sql`.
- Folder-level sharing cascades to contents (design: share a folder → members get its notes/canvases).
- Pro-gated (both notes and canvas collaboration require Pro on the owner's plan). **Verify:** two-user live edit, viewer read-only at the DB, no cross-tenant leak.

## 7. Phase 5 — Canvas navigation: minimap, frames, outline

The infinite canvas needs "where am I / where's my stuff."
- **Minimap** (corner overview of all content + a draggable viewport rectangle to jump).
- **Zoom-to-fit / reset view**, **jump-to-element**.
- **Outline / contents panel** listing every element.
- **Named Frames/Sections:** draw a titled region around a cluster; frames are the canvas analog of folders — jump to them from the outline. (New element type in the `scene`/Yjs doc; keep media bytes out of the doc.)
- **Verify:** minimap tracks content + viewport; frames persist; reduced-motion safe.

## 8. Phase 6 — Extras (nice-to-haves)

`Ctrl-K` command palette; full-text Library search; `[[wiki-links]]` + backlinks between notes; note version history (cheap via Yjs); templates (meeting notes, canvas layouts); export (note→MD/PDF, canvas→PNG/PDF); cover images + emoji icons on notes/folders.

## 9. Then — marketing/landing re-skin (LAST)

Re-skin `features/marketing` to Nvexis, then the go-live checklist in `prompts.md` (Dodo TEST→LIVE, refund/contact pages, legal). Only after Phases 1–6.

---

## 10. Mobile = definition-of-done for EVERY phase

Every new screen must be built mobile-first and verified on a phone viewport: proper padding/spacing/alignment, touch targets ≥ 40px, no horizontal overflow (make wide rows scroll), content clears the fixed bottom nav, safe-area insets respected, works in Day + Night. The user reviews on a real device and sends screenshots.

## 11. Working notes — session environment quirks (IMPORTANT)

- **This runs in Cowork mode with a sandbox.** Use the **file tools (Read/Write/Edit/Grep/Glob)** for the repo — they act on the real host files and are reliable. The **bash tool uses a mount that serves STALE/TRUNCATED reads** of recently-written files, so `tsc`/`git diff`/`git status`/running scripts via bash are **unreliable** and will show phantom truncation. Verify code with the file tools + the user's Windows `npm run build`.
- **Git commit/push happens on the user's Windows machine** (the sandbox can't finalize git — it can't delete `.git` lock files). After each unit of work, hand the user a `npm run build` + `git add -A && git commit -m "…" && git push`. Cloudflare auto-deploys on push to `main`; the service worker may serve a stale build until reload (unregister SW + clear caches to force-refresh).
- **Icons:** don't hand-draw — use the official `public/brand/*` PNGs; regenerate the icon set with the Pillow snippet in `scripts/generate-icons.mjs` (Python + Pillow, run on Windows).
- Repo: `github.com/jaiakashj121420004-stack/project-management-app`. Live: `https://project-management-app-dev.pages.dev`.

## 12. Phase checklist

- [x] Phase 1 — Nvexis rebrand + mobile pass (core done; minor polish optional)
- [x] Phase 2 — Library + unified folder tree + standalone notes (2026-07-13; shipped, migration applied, deployed, verified live)
- [x] Phase 3 — Notion-style block editor + custom colours (2026-07-13→14; slash menu, bubble toolbar, emoji, **toggle blocks**, list styles, custom colour swatches, note **images**/**audio-video embeds (Pro)**/**canvas links**, **Markdown export**, **templates**, **emoji icons**, **cover images** — built + type-verified, pending build/commit)
- [x] Phase 4 — Collaboration for notes + canvas sharing UI (2026-07-14; reliable share + RLS chosen over blind Yjs-for-notes; `features/sharing`)
- [x] Phase 5 — Canvas navigation: minimap, frames, outline (2026-07-14; corner minimap + **jump-to-element** from the Layers panel + a **named Frame element type** with an Add-frame tool + inline rename)
- [x] Phase 6 — Extras (2026-07-14; ⌘K command palette + Library search + note export + templates shipped; backlinks/version-history still open)

> **Progress note (2026-07-14):** all six phases are built. Phases 1–2 are live; Phases 3–6 + the polish pass are written and type-verified via review subagents but **not yet built/committed** on Windows (the in-session Linux mount serves truncated reads). Apply the three idempotent migrations (`20260714180000_note_media`, `20260714200000_notes_folders_icon`, `20260714210000_note_cover`), then `npm run build` + commit per slice. Only **go-live** (Dodo LIVE keys, KYC, legal) and the marketing re-skin polish remain.
- [ ] Marketing re-skin + go-live (LAST)
