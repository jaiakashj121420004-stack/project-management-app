# memory.md — Current State

> **The living memory of this project.** Read this first every session to know where things stand. **Update it after every meaningful change, then commit to git** (see [CLAUDE.md](./CLAUDE.md)). For the full spec see [plan.md](./plan.md); for build steps see [prompt.md](./prompt.md).
>
> Keep this file lean: it tracks *state*, not specification. Don't paste design or architecture here — link to `plan.md`.
>
> **2026-08-20: this file was slimmed down** from ~430KB (78 sprawling, largely-redundant session write-ups) to a crisp summary. The old verbatim history is not lost — it's in `git log`/`git show` on every commit that landed it, and the "Feature log" below is a one-line-per-feature index into that history. **Going forward, keep new Status entries SHORT (a few sentences: what changed, why, what's still pending) — the detailed "why" belongs in the Decision log (one entry, one paragraph, only for choices a future session actually needs to know about) and the commit message/diff, not a re-told narrative here.**

---

## 📍 Status

Aurora is a live, shipped multi-tenant project-management PWA — Kanban boards, Calendar (Month/Week/Timeline-Gantt), Notes, Canvas (real-time collaborative whiteboard), a daily to-do planner, Goals, and Pro/Team-gated Automations — deployed on **Cloudflare Pages** (https://project-management-app-dev.pages.dev) with **Supabase** as the backend and **Dodo Payments** for billing. Every phase of the original build (`prompt.md` Phases 0–10) and the June 2026 Pro feature set (`prompts.md` P0–P3.7: canvas, timed reminders, collaboration) is built, migrated, and live. The July 2026 security remediation (7 phases) is complete and pentest-reviewed (`reports/PENTEST-READINESS-2026.md`).

**Current work:** executing `IMPROVEMENT-PLAN-2026-08.md`, built from competitor research (`reports/FEATURE-GAP-ANALYSIS.md`, `reports/SIMPLICITY-GUARDRAIL.md`). Tasks 1–14 and 16–25 are confirmed done and pushed to `main` (verified 2026-08-20 by cross-referencing `git log` against each task's expected commit hash + `git merge-base --is-ancestor` + `git branch -vv` against `origin/main`). Task 15 (marketing plan) is deliberately deferred to its own session. **Tasks 26–38 are the active backlog** — 13 self-contained session prompts covering Notes/Canvas/Calendar UX fixes and features; open that file for the exact next prompt to run, its dependencies, and its risk notes (Task 33, math/subscript/superscript, is flagged as the highest-risk item — it touches the block schema shared with Canvas's live Yjs-collaborative text).

**Most recent session (2026-08-20):** fixed slash-menu + canvas-toolbar viewport clipping (Task 26 of 26–38) — `src/features/editor/suggestion/renderer.ts` now flips/clamps the slash menu against the real viewport (incl. the mobile keyboard via `visualViewport`); the canvas text toolbar (`RichTextBox.tsx`) now self-positions from the real DOM rects of the text box and the top nav (`#app-topbar`, added to `Topbar.tsx`) instead of guessed camera-space math. Committed locally as `3eaba47` — **not yet pushed**; typecheck could not be completed in-sandbox this session (see Open items) and needs Windows confirmation.

**Session (2026-08-20, later):** per-card timer UX fix — the toggle now reads Start/Pause (not Start/Stop; same underlying start/stop mutation pair, just relabeled Play/Pause) and, while running, the button shows the CARD's cumulative total (all entries, all users, ticking live) instead of only the current entry's own elapsed seconds, so pausing never looks like it lost progress. Added a Reset action (RotateCcw icon, visible only when idle and the current user has entries on the card) behind an inline confirm chip (same pattern as `NoteEditor.tsx`'s delete confirm — a chip with Cancel/Clear, not a native `confirm()`). Decision: Reset only clears the CALLING user's own time entries on that card, not everyone's — `time_entries`' delete RLS policy (`20260816140000_time_entries.sql`) scopes deletes to `user_id = auth.uid()`, unlike checklist items/labels where any editor can delete any row, so a "reset the whole card" button would silently no-op on teammates' rows; `deleteTimeEntriesForCard(cardId, userId)` (cardExtras.api.ts) + `useDeleteTimeEntries` (useCardExtras.ts) filter by user explicitly to make that scope visible in code, not just an invisible RLS side effect. No new migration. Typecheck verified clean in-sandbox (follow-up pass, 2026-08-21). ⚠️ `npm run build` still not run in-sandbox (device-bridge limitation, see Standing workflow reminder) and this change is still uncommitted — needs `npm install && npm run typecheck && npm run build`, then `git add`/`git commit`/`git push` on Windows.

**Standing workflow reminder** (see `CLAUDE.md` for the full rule set): the device-bridge Windows-mounted `node_modules` has a long-standing `@rolldown/binding-linux-x64-gnu` native-binding mismatch that makes `npm run build`/`vitest` unreliable when run in-place over that bridge — a fresh `npm install` in an isolated Linux clone of `origin/main` reliably builds clean, so that's the fallback verification path when Windows isn't available. The real gate is always Windows: `npm install && npm run typecheck && npm run build`, then commit + push.

**Session (2026-08-20, later still):** note-image Backspace guard — `NoteImage.ts` (`addKeyboardShortcuts`) now requires 3 consecutive Backspace presses while the image is the selected node before it deletes; the first 2 are swallowed and stamp a `noteImageBackspaceCue` transaction meta (module-level `backspaceStreak` keyed by node identity, reset once the selection leaves the node) that `NoteImageView.tsx` listens for via `editor.on('transaction')` to shake the image (`motion-safe:animate-note-image-shake`, new keyframe in `tailwind.config.ts`) and show a "Press Backspace N more times, or use ⌫ delete below" hint. The existing Trash2 toolbar button is untouched — still deletes on one click, no counter. This establishes the first `addKeyboardShortcuts()` convention in `src/features/editor/nodes/` (no prior pattern existed to follow); scoped to `noteImage` only, other nodes (text/table/embed/canvasLink) unchanged. Typecheck verified clean in-sandbox. ⚠️ `npm run build` not run in-sandbox (device-bridge limitation, see Standing workflow reminder) — needs `npm install && npm run typecheck && npm run build` + commit + push on Windows.

**Session (2026-08-21):** paste images from the clipboard into notes (Ctrl+V) — `NoteImage.ts` gained an `addProseMirrorPlugins()` `handlePaste` that checks `clipboardData.items` for an `image/*` entry, and if found, `preventDefault()`s and uploads it via the *same* `uploadNoteImage()` the toolbar's file picker already calls (identical validation + error copy, no second pipeline). Deliberately implemented as part of the `NoteImage` node itself (not BlockEditor's shared `editorProps`) so it's structurally impossible for canvas text boxes to get it — they use `blockExtensions` without `NoteImage`. `NoteImage` needed a new `noteId` option (`.configure({ noteId })`) since a ProseMirror plugin has no access to the `NoteContext` React context the toolbar uses; `NoteBlockEditor.tsx`'s `NOTE_EXTENSIONS` moved from a module constant to a `useMemo` keyed on `note.id` to supply it (still built once per note mount — BlockEditor never rebuilds from a changed extensions array, so this doesn't violate that contract). Three new ephemeral node attrs (`uploading`, `uploadError`, `uploadId`; all hidden from the static HTML renderer via explicit `parseHTML`/`renderHTML` no-ops) let a placeholder node get inserted immediately at the cursor and then be found-and-patched (by `uploadId`, via `doc.descendants`) once the upload settles — handles the doc having changed shape in between. `NoteImageView.tsx` reuses its existing loading/error skeleton markup, just parameterized with "Uploading image…" / the real `MediaUploadError` message instead of new UI. Plain-text and rich-text (Word/Google Docs) paste are untouched — the handler returns `false` (falls through to default paste) whenever no `image/*` clipboard item is present. ⚠️ Not verified in-sandbox: no `node_modules` staged this session, so this was reviewed by hand only (see Standing workflow reminder) — needs `npm install && npm run typecheck && npm run build` + commit + push on Windows. One of the three changed files (`src/features/notes/NoteBlockEditor.tsx`) could not be written back to the Windows folder via the device bridge — Windows rejected it twice (Controlled Folder Access-style denial) even though its two sibling files in the same session wrote fine; it was delivered as a chat attachment instead and needs manual replacement (or a retry once whatever's locking it is resolved) before the Windows build.

## 🧾 Feature log (compact, newest first)

One line per shipped feature/fix, newest first — a scan index, not the record. Full detail lives in the commit itself (`git log --oneline`, `git show <hash>`); the biggest architectural calls are also in the Decision log below.

- ✨ Feature (2026-08-21, with Claude/Cowork): paste images from the clipboard into notes (Ctrl+V), same upload path as the toolbar's file picker
- 🐛 Fix (2026-08-20, with Claude/Cowork): note images now need 3 Backspace presses (or the Trash2 button) to delete, with a shake+hint cue on swallowed presses
- 🐛 Fix (2026-08-20, with Claude/Cowork): slash menu + canvas text toolbar no longer clip/overlap outside the viewport
- 📝 Verification + plan trim (2026-08-20, with Claude/Cowork, no app code changed): IMPROVEMENT-PLAN-2026-08.md cut from 25 fully-written tasks + Tasks 26-38 down to just Task 15 + Tasks 26-38
- 📝 Planning session (2026-08-20, with Claude/Cowork, no code changed): IMPROVEMENT-PLAN-2026-08.md gained Tasks 26-38
- ✅ Timeline/Gantt view BUILT (2026-08-20) — Improvement Plan Task 25; `tsc`/`eslint` verified clean directly on the real repo, ⚠️ nothing is staged or committed from this session
- ✅ Simple goals tracking BUILT (2026-08-20)
- ✅ Rule-builder automations BUILT (2026-08-17)
- ✅ Recurring Kanban cards BUILT (2026-08-17)
- ✅ One-time Trello/CSV → Aurora project import BUILT (2026-08-16)
- ✅ Full-text search across cards + notes in the command palette BUILT (2026-08-17) — Improvement Plan Task 20; ⚠️ typecheck could NOT be verified this session (see below)
- ✅ File attachments on Kanban cards BUILT (2026-08-16) — verified in-sandbox (`npm run typecheck` clean, `eslint` clean on every changed file; `vitest run` could not execute
- ✅ Per-card time tracking (start/stop, running total) BUILT (2026-08-16)
- ✅ Pre-pentest hardening pass + `reports/PENTEST-READINESS-2026.md` (2026-08-16)
- ✅ Table block: one shared model, two separate implementations, in Notes and Canvas (2026-08-16)
- ✅ To-do list/item drag-and-drop: fractional-position reorder, dedicated drag handles, auto-sink on complete (2026-08-15) — ⚠️ npm install + typecheck/build/test + commit on Windows
- ✅ Calendar grid polish: visible day-cell borders + today prominence + weekday separator (2026-08-15) — ⚠️ npm install + typecheck/build + commit on Windows
- ✅ Settings → Custom colors rebuilt curated-first: 8 coordinated personalization presets + a derived accent for Advanced too (2026-08-15)
- ✅ Full immersive per-project accent theming shipped (2026-08-15) — ⚠️ build/test + commit on Windows
- ✅ "Install Aurora" PWA affordance shipped (2026-08-15)
- ✅ Minimal funnel-analytics instrumentation shipped end-to-end (2026-08-15)
- DONE: Task 2 of the Aug 2026 Improvement Plan - removed leftover pre-rebrand font dependencies (2026-08-15)
- ✅ Improvement plan expanded: all 7 FEATURE-GAP-ANALYSIS items scoped as Tasks 16-22, plus 3 explicitly-requested overrides of the Simplicity Guardrail's advisory flags
- ✅ Task 1 of the Aug 2026 Improvement Plan done: competitor research + two new reference docs (2026-08-15)
- 🔴 PROD INCIDENT: entire app rendered completely unstyled — stale `index.html` + an over-broad `_redirects` catch-all (2026-08-15)
- ✅ ROOT CAUSE FOUND + FIXED (for real this time): "Settings page is frozen / nothing clickable" was `.aurora-grain` on a content panel (2026-08-15)
- 🔴 THEME-TOGGLE FREEZE — View Transitions removed entirely after 2 failed fix attempts, confirmed clean live (2026-08-13)
- 🔴 MOBILE "STUCK ON /privacy" BUG FIXED — 2 real gaps closed (2026-08-13)
- 🔴 BUILD FIX: `tsc --noEmit -p .` was silently checking nothing all last session (2026-08-13)
- ✨ BRAINSTORM BATCH: TODAY VIEW + ONBOARDING TOUR + BULK ACTIONS + SWIPE GESTURES + STARTER TEMPLATES + ICS CALENDAR FEED (2026-08-13)
- 🗓️ CALENDAR APP UPGRADE + SETTINGS/THEMING PAGE + TO-DO PRIORITY + HELP PANEL (2026-08-12) — ⚠️ apply 2 migrations, delete 1 unused file
- 🔁 TO-DO RECURRENCE ENGINE + BILLING ANNUAL-SWITCH FIX + TOOLTIP SYSTEM (2026-08-12) — ⚠️ apply 1 migration + deploy 1 new function
- 💼 TEAM PLAN SHIPPED + INDIA PRICING RESEARCHED (2026-08-12)
- 🛡️ CANVAS-MEDIA SERVER-SIDE CAPS + 10 GiB QUOTA (2026-08-12)
- 💰 PRICING TIGHTENED + PLAY STORE DROPPED (2026-08-12)
- 💳 DODO KYC — ALL 3 STEPS SUBMITTED, UNDER REVIEW (2026-07-19)
- 🏷️ GOOGLE OAUTH BRANDING — OG META TAGS ADDED (2026-07-19) — ⚠️ build/commit/push on Windows
- 🌐 CUSTOM DOMAIN LIVE + GOOGLE OAUTH BRANDING IN PROGRESS (2026-07-19)
- ✅ DODO TEST-MODE BILLING — VERIFIED END-TO-END (2026-07-19)
- ✅ WAKE-UP CHECKLIST + GO-LIVE VERIFICATION — COMPLETE (2026-07-19)
- 🕵️ ADMIN AUDIT LOG — BUILT (2026-07-19) — ⚠️ apply 1 migration
- 🧹 LINT SWEEP TO ZERO + a11y TEST FIX — BUILT & VERIFIED ON WINDOWS (2026-07-19)
- 🔐 SECURITY REMEDIATION — PHASES 3, 4, 5 BUILT + MOBILE UI FIX + MARKETING/RESEARCH DELIVERABLES (2026-07-16)
- 🔐 SECURITY REMEDIATION — PHASE 2 (isolate billing/reminder PII from co-members) BUILT (2026-07-15) — ✅ applied to prod; ⚠️ build/test + commit on Windows
- 🔐 SECURITY REMEDIATION — PHASE 1 (lock over-exposed SECURITY DEFINER RPCs) BUILT (2026-07-15) — ⚠️ apply 1 migration to prod + commit on Windows
- ✅ PROD ENV HYGIENE — VERIFIED ON LIVE PROJECT (2026-07-15)
- ✅ AURORA REMEDIATION — PHASE 7 (verification & go-live) BUILT (2026-07-15) — ⚠️ `npm install` (axe-core) + run the gate + checklists on Windows + a real phone, then commit
- 🔒 AURORA REMEDIATION — PHASE 6 (security hardening) BUILT (2026-07-14) — ⚠️ `npm install` + build/test + commit on Windows + apply 1 migration
- 🛠️ AURORA REMEDIATION — PHASE 5 (engineering hardening + custom note templates) BUILT (2026-07-14) — ⚠️ `npm install` + build/test + commit on Windows + apply 1 migration
- 🎨 AURORA REMEDIATION — PHASE 4 (design polish & marketing) BUILT (2026-07-14) — ⚠️ build/test + commit on Windows
- ♿ AURORA REMEDIATION — PHASE 3 (accessibility & design-system) BUILT (2026-07-14) — ⚠️ build/test + commit on Windows
- 🛡️ AURORA REMEDIATION — PHASE 2 (resilience safety net) BUILT (2026-07-14) — ⚠️ `npm install` + build/test + commit on Windows
- 🅰️ AURORA REMEDIATION — PHASE 1 (brand & logo) BUILT (2026-07-14) — ⚠️ build + commit on Windows
- ✨ NVEXIS EDITOR/CANVAS/LIBRARY POLISH + DEFERRED FEATURES SHIPPED (2026-07-14) — ⚠️ needs 3 migrations + build/commit on Windows
- 🌙 OVERNIGHT AUTONOMOUS RUN (2026-07-14) — Phases 3(complete)/4/5/6 BUILT; marketing re-skin deferred. ⚠️ NOT yet built/committed on Windows
- 📚 NVEXIS PHASE 2 — Library + unified folder tree + standalone notes
- ✅ Canvas creative upgrades — colours, precision eraser, document text (2026-06-30) — typecheck + lint + `vite build` all clean
- ✅ Canvas live multiplayer — Pro P3.7 (2026-06-29) — built; typecheck + lint + `vite build` all clean
- ✅ Canvas element management — Pro P3.6 (2026-06-29) — build fixed, lint clean, verified live-ready
- ✅ Canvas audio + video LIVE — Pro P3.5 (2026-06-29)
- ✅ Canvas rich text now matches the full P3.3 spec (2026-06-29)
- ✅ Canvas creation FIXED (2026-06-25)
- Phase 10 (Polish & launch) — built in code (2026-06-21); pending the user's Stripe setup + a build/commit/push + applying the billing migration
- post-launch polish pass (2026-06-21)
- Phase 10.1 (2026-06-21)
- Theme + personalization account sync (2026-08-15)
- Security Remediation Phases 3-5 + mobile UI + deliverables (2026-07-16)
- Pro P3.7 — canvas live multiplayer (Yjs + Supabase Realtime + cursors) (2026-06-29)
- Pro P3.6 — canvas element management, build fixed + lint clean (2026-06-29)
- Pro P3.5 — canvas audio + video (2026-06-29)
- Pro P3.4 — canvas image elements (2026-06-29)
- Pro P3.3 — canvas rich text finished to spec (2026-06-29)
- Post-Phase-6 batch (2026-06-20, user-requested)
- Post-launch polish (2026-06-21)
- UX pass — Feedback/Features tab + mobile search polish (2026-06-21)
- Pro pricing — $5.99/mo + annual (5% off) (2026-06-21)
- Pro P0 — gating + storage foundation (2026-06-22)
- Custom date+time picker — no native OS controls left (2026-06-22)
- Pro P1 — custom timed reminders (2026-06-22)
- Payments: Stripe → Dodo Payments (2026-06-22)
- Pro P2 — collaboration (2026-06-22)
- Pro P3.1 — Notes Canvas foundation (2026-06-22)
- Standalone canvases — project OR personal (2026-06-22)
- Notes & Canvas full-width layout refactor (2026-06-22)
- Fix: canvas creation blocked by RLS — the "opens for half a second and closes" bug (2026-06-25)
- Fix (REAL root cause): canvas creation 42501 was the SELECT read-back, not the INSERT policy (2026-06-25)
- Pro P3.2 — pressure-sensitive freehand drawing (2026-06-26)

---

## 🧠 Decision log

One line-or-two per decision — the "why," condensed. Full reasoning for any of these is in the commit that made it (`git log --oneline` around the date, or `git show`) and, for pre-launch architecture, in `plan.md`.

- **2026-08-20 (goals tracking is free, not Pro-gated).** Deliberately overrides the Simplicity Guardrail's advisory flag — the mitigation is scope ("goals with a progress bar," no OKR hierarchy, one flat table), not a paywall, since it's cheap to build with no abuse surface (unlike automations below).
- **2026-08-16 (time tracking: one running timer per user, account-wide).** A user can only ever be "on the clock" for one card at a time, enforced by a partial unique index on `time_entries` — matches how real time trackers behave and avoids silently double-counting.
- **2026-08-15 (theme sync: null = "never synced," not "reset").** `profiles.theme`/`custom_theme` stay nullable; reset writes the concrete default object, never null, so a null column unambiguously means "this account has never written here" — that's what lets the reconcile effect avoid clobbering a device's local customization on first sync. Also revived the dead `CustomThemeProvider` stub instead of deleting it, since this task needed one shared, subscribable source of truth.
- **2026-07-15 (Security Remediation Phase 2 — kept billing/PII columns on `profiles`, added a column-limited accessor).** Rather than split billing columns into a new table (large blast radius right before charging money), added `co_member_profiles`, a SECURITY DEFINER accessor that exposes only name/avatar to co-members. One policy + one function + one query changed.
- **2026-07-15 (Security Remediation Phase 1 — grants-only RPC lockdown, with one deviation).** Revoked EXECUTE on sensitive RPCs from `public`/`anon` as planned; deviated from revoking it from `authenticated` too for RPCs called *inside* RLS policies themselves (`user_is_pro` etc.) — proven on real Postgres that SECURITY DEFINER does not exempt the caller's own EXECUTE grant, so revoking there broke the policies. Residual authenticated-oracle risk tracked as a follow-up requiring an in-body caller guard.
- **2026-06-29 (Pro P3.2–P3.7 canvas — multiple engineering calls, see `git show` for each).** Freehand strokes persist raw input samples (not the outline polygon) so they stay crisp at any zoom and stay CRDT-friendly for the later multiplayer phase. Element management (P3.6) batches transform-end events into single history steps via `setTimeout(0)` coalescing. Images (P3.4) use a module-level signed-URL cache to dedupe Storage requests. All committed 2026-06-25–06-29.
- **2026-06-22 (canvas decoupled from projects — a canvas is project OR personal).** `canvas_notes.project_id` became nullable + a new `owner_id`; access resolves via SECURITY DEFINER helpers (owner, project membership, or a `canvas_members` row) so `canvas_members`'s own RLS never self-recurses through `project_members` (the known Postgres RLS self-recursion gotcha).
- **2026-06-22 (Pro architecture — Yjs for canvas multiplayer, custom canvas engine, Dodo over Stripe).** Canvas built on `react-konva` + `perfect-freehand` + Tiptap (tldraw/Excalidraw both rejected — licensing/feature gaps); live multiplayer via one `Y.Doc` per note over a thin Supabase-Realtime broadcast provider. Payments moved from (never-activated) Stripe to **Dodo Payments** because Dodo is a Merchant of Record — it localizes checkout currency and remits sales tax/VAT itself, which matters for a globally-sold solo product. `project_is_pro()` (board owner's plan governs) is the one gate reused everywhere Pro-only writes need RLS enforcement, never just a UI check.
- **2026-06-21 (Phase 10 — plan is a column on `profiles`, limits enforced in the DB not the UI).** A user can never self-upgrade (a BEFORE UPDATE trigger blocks any client write to billing columns except from the service-role webhook); a free user's 4th project is blocked by a BEFORE INSERT trigger, not a disabled button.
- **2026-06-20 (Phase 8 collaboration — roles enforced in RLS, invitations keyed by email).** Every content write gates on `can_edit_project`/`can_edit_card` at the database level (viewers are read-only in Postgres, not just hidden buttons). Invitations key by email (not user id, since the invitee may not have an account yet) and redeem via one shared SECURITY DEFINER core on signup or on next login.
- **2026-06-18 (Phase 3 — multi-tenant RLS pattern: membership via SECURITY DEFINER helpers, never a sub-query).** `is_project_member()`/`is_project_owner()` are `SECURITY DEFINER` + `set search_path=''`, so policies call the function instead of sub-querying `project_members` directly — this is what avoids the `project_members` self-recursion gotcha (`plan.md` §6), and every later per-project table (columns, cards, notes, checklist items…) reuses this exact pattern via a `can_access_card()`-style helper rather than inventing a new one.
- **2026-06-18 (Phase 1 — theming, hosting, and stack choices).** CSS-variable theming (`.dark`/`.light` on `<html>`, pre-paint inline bootstrap script, no flash); Tailwind v3 (config-token workflow, not v4 CSS-first); host = Cloudflare Pages, backend = Supabase (Vercel Hobby rejected — bans commercial use); auth = email/password + Google; no Docker (nothing to self-host); design language = "Aurora" (animated gradients, glassmorphism, per-project accents, spring motion).

*(Add new decisions on top as they happen — one paragraph, only for choices a future session needs to know about to avoid re-litigating them.)*

---
## 🗂️ Current file structure

```
Project Management app/
├── .env.example          ← documents the two VITE_ Supabase vars (real .env is gitignored)
├── .gitignore            ← ignores node_modules, dist, dev-dist, .env*, OS/editor cruft
├── .prettierrc.json      ← Prettier config
├── .prettierignore
├── CLAUDE.md             ← working rules (read every session)
├── SETUP.md              ← one-time setup: accounts, keys, git remote, Cloudflare
├── README.md             ← run-locally + Cloudflare Pages deploy guide
├── plan.md               ← spec (architecture, design, data, security)
├── memory.md             ← this file (state)
├── prompt.md             ← build prompts per phase (Phases 0–10, the core app)
├── prompts.md            ← Pro features build playbook (Notes Canvas, custom reminders, collaboration)
├── prompts.html          ← interactive prompt tracker — core app Phases 0–10 (open in browser)
├── pro-plan.html         ← interactive Pro-plan tracker — checkboxes + progress bar for the 10 Pro prompts
├── index.html            ← Vite entry HTML
├── package.json          ← deps + scripts (dev/build/preview/typecheck/lint/format)
├── eslint.config.js      ← ESLint flat config (TS + react-hooks, no-any)
├── postcss.config.js     ← Tailwind + autoprefixer
├── tailwind.config.ts    ← Tailwind theme (Aurora tokens land in Phase 1)
├── vite.config.ts        ← Vite + React + PWA plugin, @ alias
├── tsconfig.json         ← solution config (references app + node)
├── tsconfig.app.json     ← strict app TS config
├── tsconfig.node.json    ← TS config for vite/tailwind config files
├── supabase/
│   ├── README.md         ← how to apply migrations + the one-time Auth provider/redirect setup
│   └── migrations/
│       ├── 20260618093000_profiles.sql  ← profiles table + handle_new_user() trigger + own-row RLS
│       ├── 20260618120000_projects.sql  ← projects + project_members + is_project_member()/is_project_owner() + creator-as-owner trigger + multi-tenant RLS
│       ├── 20260618140000_kanban.sql    ← columns + cards + member-gated RLS + seed-default-columns trigger + backfill
│       ├── 20260618160000_card_details.sql ← checklist_items + labels + card_labels + can_access_card() helper + member-gated RLS
│       ├── 20260620100000_card_priority.sql ← cards.priority (open-ended integer ≥1) + index — 2026-06-20
│       ├── 20260620120000_todos.sql        ← todo_lists + todo_items + owns_todo_list() helper + own-row RLS — 2026-06-20
│       ├── 20260620140000_notes.sql        ← notes table + touch_notes_updated_at() trigger + member-gated RLS — 2026-06-20
│       ├── 20260620160000_collaboration.sql ← invitations + redemption (RPC + signup trigger) + can_edit_project/can_edit_card/shares_a_project_with helpers + owner-protect trigger + role-aware write RLS + profiles co-member SELECT + Realtime publication — Phase 8
│       ├── 20260621090000_reminders.sql    ← profiles reminder prefs + cards.reminder_sent_for + due_reminder_candidates()/mark_reminders_sent() (service-role-only RPCs) — Phase 9
│       ├── 20260621180000_invitation_accept.sql ← accept/decline invitations (no auto-join) + leave project — post-launch
│       ├── 20260621210000_billing.sql       ← profiles plan + billing cols + current_plan() + project-limit & billing-column-protect triggers — Phase 10
│       ├── 20260621230000_collab_limits_feedback_ceo.sql ← member-limit trigger + feedback + ceo_messages + is_admin() — Phase 10.1
│       ├── 20260622000000_pro_foundation.sql ← project_is_pro() helper + private canvas-media bucket + storage.objects RLS (member read; member+pro write) — Pro P0
│       ├── 20260622120000_dodo_billing.sql  ← stripe_*→dodo_* profile cols + extended protect_plan_columns guard — Dodo billing
│       ├── 20260622140000_custom_reminders.sql ← cards.due_at + card_reminders + card_reminder_dispatches + card_project_is_pro() + due_time_reminder_candidates()/mark_time_reminders_sent() (service-role-only) — Pro P1
│       ├── 20260622160000_collaboration_pro.sql ← comments + comment_mentions + reactions + activity_log + notifications + cards.review_* + RLS/definer triggers + Realtime — Pro P2
│       ├── 20260622180000_canvas.sql           ← canvas_notes (page_type/scene/doc_state) + touch trigger + Pro-gated RLS — Pro P3.1
│       ├── 20260622200000_canvas_standalone.sql ← canvas owner_id + nullable project_id + canvas_members + user_is_pro/canvas_is_pro/is_canvas_owner/can_access_canvas/can_edit_canvas + immutability trigger + rewritten canvas RLS — standalone canvases
│       ├── 20260817140000_automation_rules.sql ← automation_rules (fixed trigger/action enums, jsonb shape-checked configs) + Pro/editor-gated RLS + protect_automation_rule_created_by/validate_automation_rule_targets/enforce_automation_rule_limit(20/project) triggers + fire_automation_rule() + run_automations_for_card_move/run_automations_for_checklist row triggers (aurora.automation_firing no-chain guard) + automation_rule_fires dedupe table + run_due_date_automations() service-role RPC — Improvement Plan Task 23
│       └── 20260820120000_goals.sql       ← goals (title/target_date/progress_type + mutually-exclusive manual_percent|linked_card_id enforced by goals_progress_shape CHECK; linked_card_id ON DELETE SET NULL) + member-gated RLS (no Pro/editor gate — every member can read/write, same as columns/cards) — Improvement Plan Task 24
├── supabase/functions/
│   ├── send-due-reminders/index.ts ← Deno Edge Function: runs BOTH the day-based digest AND the precise channel='email' timed path; secret-gated, Resend, marks sent/dispatched (cron every 10 min) — Phase 9 + P1
│   └── run-automations/index.ts    ← Deno Edge Function: cron-invoked (every 10 min), secret-gated, calls run_due_date_automations() RPC for the due_date_passed trigger (the one trigger type that can't be a row trigger) — Task 23
├── scripts/
│   └── generate-icons.mjs    ← zero-dep PNG icon generator (aurora gradient + "A" glyph) — Phase 9
├── public/                   ← static assets (Phase 9): pwa-192x192.png, pwa-512x512.png, maskable-512x512.png, apple-touch-icon.png, favicon.svg
└── src/
    ├── App.tsx                 ← routes (AppShell layout → Boards / To-Do / Calendar / Notes / StyleGuide)
    ├── main.tsx                ← React root + Theme/Query/Router providers + font imports
    ├── vite-env.d.ts           ← typed import.meta.env (VITE_SUPABASE_*)
    ├── components/
    │   ├── index.ts            ← barrel export
    │   ├── AuroraBackground.tsx← drifting blobs + pointer parallax + grain
    │   ├── Avatar.tsx          ← gradient-initials / image avatar
    │   ├── Badge.tsx           ← status pills (tones)
    │   ├── Modal.tsx           ← spring glass modal / mobile sheet (portal, Esc, scroll-lock)
    │   ├── glass/              ← GlassPanel, GlassCard (3D tilt)
    │   ├── buttons/            ← GradientButton (3D tactile, variants/sizes)
    │   ├── forms/              ← Field, TextArea, GlassSelect (reusable .glass-menu dropdown — replaces native <select>), DatePicker (glass calendar+time picker — replaces native date/time inputs)
    │   ├── feedback/           ← Spinner, Skeleton
    │   ├── motion/             ← Reveal wrapper
    │   ├── theme/              ← ThemeProvider, theme-context, ThemeToggle
    │   ├── shell/              ← AppShell (mounts useDueReminders + OfflineBanner + PWAReloadPrompt), Sidebar, SidebarNav, Topbar, BottomNav, Brand, navItems
    │   └── pwa/                ← OfflineBanner (offline indicator), PWAReloadPrompt (SW ready/update toast) — Phase 9
    ├── features/
    │   └── auth/               ← Phase 2 auth feature module
    │       ├── index.ts            ← barrel (provider, guards, pages, UserMenu)
    │       ├── auth-context.ts     ← AuthContext + value type
    │       ├── AuthProvider.tsx    ← session state (onAuthStateChange + getSession)
    │       ├── api.ts              ← supabase.auth wrappers + friendlyAuthError()
    │       ├── schemas.ts          ← Zod schemas + fieldErrorsOf()
    │       ├── identity.ts         ← resolveDisplayName/avatar from profile|user
    │       ├── useProfile.ts       ← profile query + update mutation (TanStack)
    │       ├── AuthLayout.tsx      ← shared glass auth card (+ OrDivider, AuthLink)
    │       ├── GoogleButton.tsx    ← "Continue with Google"
    │       ├── FormNotice.tsx      ← inline error/success/info banner
    │       ├── FullScreenLoader.tsx← guard fallback while session restores
    │       ├── ProtectedRoute.tsx  ← redirect unauthenticated → /login
    │       ├── PublicOnlyRoute.tsx ← redirect authenticated away from auth pages
    │       ├── SignUpPage.tsx · LoginPage.tsx · ForgotPasswordPage.tsx · ResetPasswordPage.tsx
    │       ├── ProfilePage.tsx     ← minimal display-name editor
    │       └── UserMenu.tsx        ← top-bar avatar → Profile / Sign out
    │   └── projects/           ← Phase 3 projects feature module
    │       ├── index.ts            ← barrel (ProjectsPage, ProjectPage)
    │       ├── api.ts              ← Supabase data layer (fetch/insert/patch/remove; RLS-governed)
    │       ├── useProjects.ts      ← TanStack hooks (useProjects/useProject + optimistic create/update/delete)
    │       ├── schemas.ts          ← Zod project form schema + fieldErrorsOf()
    │       ├── ProjectsPage.tsx    ← dashboard (index route): grid of cards, empty/loading/error states; header also has an "Import" button → features/import's ImportModal
    │       ├── ProjectCard.tsx     ← vivid Aurora glass card, stretched link, owner edit/delete actions
    │       ├── ProjectFormModal.tsx← create/edit modal (key-remount re-seeds; no reset effect)
    │       ├── AccentPicker.tsx    ← six-gradient radiogroup picker
    │       ├── DeleteProjectDialog.tsx ← owner-only delete confirmation
    │       ├── ProjectPage.tsx     ← /projects/:id route (accent-themed header + Board|Goals|Notes|Canvas|Activity tabs via ?tab=…; also the project kebab menu → Save as template / Automations)
    │       ├── projectTemplates.ts ← curated PROJECT_TEMPLATES (6 system starter templates, static data)
    │       ├── templateSchemas.ts  ← Zod ProjectTemplatePayload + save-as-template input validation, reusing board/schemas.ts's own validators
    │       ├── templatePositions.ts← pure sequentialPositions() (Supabase-free, unit-tested), built on lib/ordering.ts
    │       ├── instantiateTemplate.ts ← payload → real columns/cards/checklist/labels (batch inserts)
    │       ├── captureTemplate.ts  ← live board state → payload (pure, unit-tested) for "save as template"
    │       ├── templates.api.ts    ← Supabase data layer for the project_templates table (RLS-governed)
    │       ├── useProjectTemplates.ts ← TanStack hooks (optimistic create/rename/delete of a user's own templates)
    │       ├── TemplatePickerModal.tsx ← New Project flow: Blank project (always first) + curated grid + "My templates"
    │       └── SaveAsTemplateDialog.tsx ← the entire "template builder": name/description/icon, snapshots the live board
    │   └── import/             ← Improvement Plan Task 21: one-time Trello/CSV → Aurora project import
    │       ├── index.ts            ← barrel (ImportModal)
    │       ├── errors.ts           ← ImportParseError (unrecognisable file → human message)
    │       ├── schemas.ts          ← Zod ImportPayload (generous caps, not templateSchemas.ts's curated-template limits)
    │       ├── trelloParser.ts     ← Trello board JSON export → ImportPayload (lists/cards/labels/checklists, archived-content + Power-Up-data notes)
    │       ├── csvParser.ts        ← hand-rolled RFC4180 tokenizer + List/Card Title/Description/Due Date/Labels → ImportPayload
    │       ├── runImport.ts        ← payload → real columns/cards/checklist/labels via chunked batch inserts (same authenticated Supabase calls as instantiateTemplate.ts) + progress callback
    │       └── ImportModal.tsx     ← pick file → preview (name, columns/cards, skip notes) → progress bar → done summary; reachable from ProjectsPage's "Import" button
    │   └── automations/       ← Improvement Plan Task 23: Pro/Team rule-builder automations (fixed 3×3 trigger/action enum)
    │       ├── index.ts            ← barrel (AutomationsDialog, useAutomationRules)
    │       ├── schemas.ts          ← AUTOMATION_TRIGGER_TYPES/AUTOMATION_ACTION_TYPES + automationRuleInputSchema (Zod, superRefine per trigger/action) + fieldErrorsOf()
    │       ├── api.ts              ← Supabase data layer (fetch/insert/update/toggle/delete) + toRuleConfigs()/fromRule() (flat form ↔ jsonb trigger_config/action_config)
    │       ├── useAutomations.ts   ← TanStack hooks on one ['automation-rules', projectId] cache; optimistic create/update/toggle/delete (create tracks 'automation_rule_created')
    │       ├── describeRule.ts     ← pure trigger/action → one readable sentence ("When a card moves to…, assign it to…") — never raw JSON in the UI
    │       └── AutomationsDialog.tsx ← project-menu modal: rule list (RuleRow: sentence + enable Toggle + edit/delete) + RuleForm (trigger/action GlassSelects + conditional target pickers); hidden entirely (not disabled) for non-Pro projects
    │   └── goals/              ← Improvement Plan Task 24: simple goals tracking (flat, no Pro gate)
    │       ├── index.ts            ← barrel (GoalsPanel)
    │       ├── schemas.ts          ← GOAL_PROGRESS_TYPES + goalFormSchema (Zod, superRefine per progress mode) + fieldErrorsOf() — deliberately no `description` field (form is title + target date + progress mode only)
    │       ├── progress.ts         ← pure goalProgress()/goalChecklistCounts() — reads the shared useCardExtras() checklist cache, no new DB view/trigger
    │       ├── progress.test.ts    ← unit tests for both progress modes + the empty/unlinked edge cases
    │       ├── api.ts              ← Supabase data layer (fetch/insert/update/delete) + toProgressColumns() (flat form → mutually-exclusive manual_percent/linked_card_id columns)
    │       ├── useGoals.ts         ← TanStack hooks on one ['goals', projectId] cache; optimistic create/update/delete
    │       └── GoalsPanel.tsx      ← the whole "Goals" tab: flat GoalRow list (title, target date, progress bar, ✕/x done caption) + inline GoalForm (title Field, DatePicker, SegmentedToggle between "Link to a checklist" [default] / "Set percentage" [native `<input type="range">`, no new slider component], GlassSelect card picker sourced from useBoard())
    │   └── board/             ← Phase 4 Kanban + Phase 5 card-details feature module
    │       ├── index.ts            ← barrel (Board)
    │       ├── ordering.ts         ← fractional position helpers (positionBetween/neighbour) + isDoneColumn
    │       ├── due.ts              ← due-date urgency status/label helpers (date-fns) — Phase 5
    │       ├── schemas.ts          ← Zod column-name / card / checklist-text / label-name schemas
    │       ├── api.ts              ← board Supabase data layer (fetchBoard + column/card CRUD + moves; updateCardDetail writes due_date)
    │       ├── cardExtras.api.ts   ← Phase 5 data layer (labels / checklist_items / card_labels; RLS-governed) + time_entries start/stop — 2026-08-16
    │       ├── timeTracking.ts     ← time-entry duration math + h:mm / h:mm:ss formatting (pure helpers) — 2026-08-16
    │       ├── useBoard.ts         ← TanStack hooks on one ['board', id] cache; optimistic add/rename/delete/move (incl. due_date)
    │       ├── useCardExtras.ts    ← TanStack hooks on one ['card-extras', id] cache; optimistic label/checklist/attach/time-entry ops
    │       ├── Board.tsx           ← DndContext orchestrator (sensors, drag handlers, DragOverlay, confetti, toolbar, filtering, modals)
    │       ├── BoardToolbar.tsx    ← Phase 5 filter/search bar (title search + due chips + label chips)
    │       ├── BoardColumn.tsx     ← sortable column: grip, inline rename, delete, card list, quick-add composer
    │       ├── BoardCard.tsx       ← sortable card wrapper; passes face (labels + checklist) + hidden
    │       ├── CardSurface.tsx     ← presentational glass card: priority pill, label swatches, urgency due pill, checklist tally (also DragOverlay clone)
    │       ├── LabelPill.tsx       ← presentational colored label pill (card face / modal / filter)
    │       ├── CardDetailModal.tsx ← edit title/description/due-date + Priority + Labels + Checklist sections; 2026-08-17: + Repeat section
    │       ├── RecurrenceField.tsx ← "Repeat" section for the card modal; wraps todos' RecurrenceEditor as-is, gated on useProjectIsPro — 2026-08-17
    │       ├── DueDateField.tsx    ← native date picker, on-brand, with clear + urgency hint
    │       ├── PriorityField.tsx   ← priority picker: P1–P10 chips + "Higher…" custom — 2026-06-20
    │       ├── AssigneeField.tsx   ← assignee picker (project members); reminder target — Phase 9
    │       ├── CardLabelsSection.tsx ← attach/detach labels + inline create/delete (swatch picker)
    │       ├── Checklist.tsx       ← progress bar + reorderable list (nested dnd-kit) + add composer
    │       ├── ChecklistItemRow.tsx ← one to-do: grip, tick box, click-to-edit text, delete
    │       ├── TimeTracking.tsx    ← "Time" section: start/stop timer (live h:mm:ss) + running total (h:mm) — 2026-08-16
    │       ├── DeleteColumnDialog.tsx ← confirm column (+ its cards) delete
    │       ├── AddColumn.tsx       ← trailing add-column composer
    │       └── Confetti.tsx        ← reduced-motion-aware celebration burst
    │   └── calendar/          ← Phase 6 Calendar view feature module
    │       ├── index.ts            ← barrel (CalendarPage)
    │       ├── api.ts              ← fetchDatedCards (all dated cards, RLS-scoped) + updateCardDates (due_date/due_at + optional start_date); P25: renamed from updateCardDueDate
    │       ├── useCalendar.ts      ← ['calendar-cards'] query + reschedule/update/delete (cross-cache optimistic: calendar + board + card-extras); P25: useRescheduleCard's startDate param is optional (undefined = untouched)
    │       ├── dates.ts            ← date-fns helpers (month/week day arrays, toDateKey, periodLabel, groupCardsByDate); P25: 'timeline' CalendarView + monthOnlyDays()
    │       ├── timeline.ts         ← P25: Timeline/Gantt layout math — effectiveStartDate, groupCardsByProject, projectsWithBars, barSpan (CSS-grid column clipping), isClippedStart/End, shiftDateKey
    │       ├── CalendarPage.tsx    ← DndContext orchestrator: view/scope/cursor state, grid↔agenda↔timeline, card + day-overflow modals; P25: onDragEnd branches on drag data.kind
    │       ├── CalendarToolbar.tsx ← title + period, month/week/**timeline** segmented toggle, prev/today/next, project scope select
    │       ├── CalendarGrid.tsx    ← 7-col day grid (desktop/tablet; month + week variants)
    │       ├── DayCell.tsx         ← droppable day: accent today-pill, chips, "+N more" overflow
    │       ├── CardChip.tsx        ← presentational accent/urgency chip + DraggableCardChip (dnd-kit) wrapper
    │       ├── TimelineBar.tsx     ← P25: TimelineBarFace (presentational, backs DragOverlay clone) + DraggableTimelineBar (3 dnd-kit draggables: body + start/end resize handles)
    │       ├── TimelineGrid.tsx    ← P25: the Timeline/Gantt view — one CSS Grid, day-column droppables behind gridColumn-placed bars, rows = projects with ≥1 bar this month
    │       ├── AgendaList.tsx      ← small-phone agenda (days-with-cards, tap to open)
    │       └── DayCardsModal.tsx   ← all cards for a day (the "+N more" popover)
    │   └── todos/             ← Daily to-do planner feature module — 2026-06-20
    │       ├── index.ts            ← barrel (TodosPage)
    │       ├── api.ts              ← fetchTodos(date) + list/item CRUD (own-row RLS)
    │       ├── useTodos.ts         ← ['todos', dateKey] cache + optimistic list/item ops
    │       ├── schemas.ts          ← Zod list-name / item-text schemas
    │       ├── TodosPage.tsx       ← date nav + grid of lists + add-list composer
    │       ├── TodoListCard.tsx    ← one named list: rename/delete + items + add-item composer
    │       └── TodoItemRow.tsx     ← one to-do: tick + text + delete
    │   └── notes/             ← Phase 7 per-project Notes/docs feature module
    │       ├── index.ts            ← barrel (NotesPanel, NotesHome)
    │       ├── api.ts              ← notes Supabase data layer (fetch/insert/patch/remove; RLS-governed)
    │       ├── useNotes.ts         ← ['notes', projectId] cache + optimistic add/update/delete
    │       ├── schemas.ts          ← Zod note title / content schemas (mirror DB constraints)
    │       ├── markdown.tsx        ← self-contained XSS-safe markdown→React renderer (no dep)
    │       ├── NotesPanel.tsx      ← two-pane list + editor (responsive list↔editor swap), create (canEdit-gated)
    │       ├── NoteEditor.tsx      ← title rename + markdown textarea + live preview + debounced autosave + delete (read-only when !canEdit)
    │       └── NotesHome.tsx       ← global /notes route: project picker → each project's Notes tab
    │   └── reminders/         ← Phase 9 due-date reminders + Pro P1 custom timed reminders
    │       ├── index.ts            ← barrel (useDueReminders, ReminderSettings, RemindersSection)
    │       ├── api.ts              ← fetchMyDueSoonCards (assignee + due-window filtered, RLS-scoped)
    │       ├── notifications.ts    ← browser Notification helpers (incl. generic showNotification) + reactive enabled-pref hook + localStorage dedupe
    │       ├── useDueReminders.ts  ← app-wide poll → day-based notification per card+due-date; also mounts useTimedReminders (AppShell)
    │       ├── useTimedReminders.ts← P1: poll the user's channel='push' reminders → fire once per (reminder, due_at)
    │       ├── offsets.ts          ← P1: quick-pick offsets, offset/channel labels, Zod offset+channel schemas
    │       ├── cardReminders.api.ts← P1: card_reminders CRUD + fetchUpcomingPushReminders (two typed queries, joined)
    │       ├── useCardReminders.ts ← P1: optimistic ['card-reminders', cardId] cache (add/remove)
    │       ├── RemindersSection.tsx← P1: ProGate'd offset editor (chips + custom + channel) for the card modal
    │       └── ReminderSettings.tsx← Profile section: email/browser toggles + lead-time GlassSelect
    │   └── members/           ← Phase 8 Collaboration feature module
    │       ├── index.ts            ← barrel (MembersBar, MembersPanel, useMembers/useMyRole, useProjectRealtime, useRedeemInvitations)
    │       ├── api.ts              ← members(+profiles join, two queries) / invitations CRUD / role change / remove / redeem RPC (RLS-governed)
    │       ├── useMembers.ts       ← ['members', projectId] cache ({members, invitations}) + optimistic invite/role/remove/cancel; useMyRole()
    │       ├── schemas.ts          ← Zod invite email(normalised lowercase) + role schema
    │       ├── useProjectRealtime.ts ← postgres_changes → debounced, project-scoped TanStack invalidation (board/extras/notes/members)
    │       ├── usePresence.ts      ← Realtime Presence: live board viewers (per-project channel keyed by user id)
    │       ├── useRedeemInvitations.ts ← redeem_my_invitations() RPC on app load (once/user) + refresh projects
    │       ├── RoleControl.tsx     ← RoleBadge (static) + RoleSelect (owner role editor↔viewer)
    │       ├── MembersBar.tsx      ← header avatar stack (presence ring + "N viewing") + Share/Members button → panel
    │       └── MembersPanel.tsx    ← modal body: roster (avatar/role/remove), pending invitations (cancel), invite form
    │   └── canvas/            ← Pro P3 Notes Canvas (lazy-loaded; Konva never ships to non-canvas users)
    │       ├── index.ts            ← barrel — exports ONLY the Konva-free CanvasHome
    │       ├── api.ts              ← canvas_notes data layer (list/all/fetch/insert/independent/patch/remove; RLS)
    │       ├── useCanvas.ts        ← ['canvas-list'|'canvas-all'|'canvas'] caches + optimistic create/save/delete
    │       ├── useCanvasPalette.ts ← resolve CSS-var colours to Konva strings (per theme/accent)
    │       ├── schemas.ts          ← Zod canvas-title schema
    │       ├── errors.ts           ← canvas-create error → friendly message + RLS-denial detector
    │       ├── elements.ts         ← CanvasElement union (Stroke/Text/Image/Media) + Zod parseScene + ElementPatch + topZ + Z-order helpers; P3.4: createImageElement factory; P3.6: visible field, bringToFront/sendToBack/bringForward/sendBackward/duplicateElements/reindexZ
    │       ├── freehand.ts         ← P3.2: perfect-freehand geometry — strokePathData() + buildStroke()
    │       ├── drawing.ts          ← P3.2: pen presets (pen/marker/highlighter) + colours + PenSettings + penStrokeStyle()
    │       ├── constants.ts        ← Camera + CanvasTool ('select'|'draw'|'erase') + zoom/scale consts; P3.6: NUDGE_STEP/NUDGE_LARGE_STEP/LONG_PRESS_MS
    │       ├── history.ts          ← useSceneHistory snapshot undo/redo stack (swappable for Y.UndoManager in P3.7)
    │       ├── PageBackground.tsx  ← world-space page pattern (blank/ruled/grid/dotted)
    │       ├── elementRenderers.tsx← ElementNode: stroke <Path> from getStroke() + resize-bakes-into-points; P3.4: ImageVisual (signed URL cache module-level urlCache/inFlight Maps + manual HTMLImageElement load; skeleton + error fallback)
    │       ├── CanvasStage.tsx     ← Konva stage: pan/zoom/select + pointer draw/erase + preview layer + palm rejection; P3.4: onDropFiles + keepRatio; P3.6: selectedIds[] multi-select, multi-node Transformer, marquee (Shift+drag), long-press context menu, group drag batching, onContextMenu prop
    │       ├── CanvasToolbar.tsx   ← floating glass toolbar: tools, undo/redo, add, page-type, zoom, lock/delete; P3.4: onAddImage; P3.6: z-order buttons (4), duplicate, layers toggle
    │       ├── ContextMenu.tsx     ← P3.6: glass float context menu (right-click/long-press); z-order/duplicate/copy/paste/lock/delete; closes on outside pointerdown or Escape
        │       ├── LayersPanel.tsx     ← P3.6: glass overlay element list sorted by z desc; per-row visibility+lock toggle; click selects, shift-click multi-selects
        │       ├── PenToolbar.tsx      ← P3.2: draw-mode pen toolbar (presets + colour palette + size slider)
    │       ├── CanvasEditor.tsx    ← stateful editor: history, autosave, tool/pen state, stroke commit, batched erase; P3.4: image upload; P3.6: selectedIds[] multi-select, clipboard copy/paste, contextMenu state, showLayers, batched changeElement (pendingPatches+setTimeout), handleGroupMove, z-order actions, keyboard shortcuts (Ctrl+C/V/D/]/[, arrows, Delete), toggleLock/Visibility
    │       ├── CanvasPanel.tsx     ← per-project Canvas tab (lazy-imported by ProjectPage)
    │       └── CanvasHome.tsx      ← /canvas workspace: aggregated picker + lazy editor (Pro-gated)
    ├── hooks/
    │   ├── useTheme.ts         ← theme context hook
    │   ├── useCustomTheme.ts   ← personalization (font pairing/custom colors) context hook — 2026-08-15
    │   ├── useAuth.ts          ← auth context hook
    │   ├── useMediaQuery.ts    ← subscribe to a CSS media query (Calendar grid↔agenda switch) — Phase 6
    │   └── useOnlineStatus.ts  ← online/offline state (useSyncExternalStore) for the offline banner + reminder polling — Phase 9
    ├── lib/
    │   ├── supabase.ts         ← typed Supabase client (reads VITE_ env, throws if missing)
    │   ├── analytics.ts        ← minimal funnel-analytics client: track(eventName, properties?) + anonymous_id/attribution helpers — 2026-08-15 (see reports/ANALYTICS.md)
    │   ├── proFeatures.ts      ← single source: which features are Pro + canvas media caps + bucket name — Pro P0; P3.4: media.shipped = true
    │   ├── storage.ts          ← canvas-media upload/signed-URL helper; validates type+size vs caps (typed MediaUploadError) — Pro P0
    │   ├── queryClient.ts      ← shared QueryClient + localStorage persister (offline cache) + clearPersistedCache — Phase 9
    │   ├── accents.ts          ← six accent gradients + accentVars()
    │   ├── labelColors.ts      ← label palette (8 named colors → hex) + withAlpha() — Phase 5
    │   ├── priority.ts         ← open-ended task priority: format + tier→color (P1+) — 2026-06-20
    │   ├── dueAt.ts            ← cards.due_at date/time combine+split + formatClockTime helpers (local↔ISO) — Pro P1
    │   ├── cn.ts               ← clsx + tailwind-merge helper
    │   ├── motion.ts           ← spring presets + variants
    │   ├── theme.ts            ← theme storage/apply logic; `theme` also account-synced via profiles.theme — 2026-08-15
    │   ├── customTheme.ts      ← personalization (font pairing/custom colors) storage/apply/sanitize logic; account-synced via profiles.custom_theme — 2026-08-15
    │   ├── personalizationPresets.ts ← 8 curated bg/text/accent presets (AA-compliant by construction) + deriveAccentFromColor()
    │   └── recurrence.ts       ← shared RecurrenceRule type + ruleMatchesDate/describeRule/defaultRuleFor/recurrenceRuleSchema (jsonb rule engine for both todos + recurring cards) — hoisted from features/todos/recurrence.ts, 2026-08-17
    ├── components/theme/
    │   ├── ThemeProvider.tsx        ← Day/Night context; boot = localStorage (main.tsx, pre-paint), then reconciles from + writes through to profiles.theme when signed in — 2026-08-15
    │   ├── CustomThemeProvider.tsx  ← personalization context; same boot-then-sync pattern as ThemeProvider, for profiles.custom_theme — 2026-08-15 (previously a dead stub, now the real provider)
    │   ├── theme-context.ts / customTheme-context.ts ← the two React contexts
    │   └── ThemeToggle.tsx          ← Day/Night toggle button
    ├── pages/                  ← StyleGuide, Placeholder
    ├── styles/
    │   └── index.css           ← Aurora tokens (both themes), glass/button/gradient utilities, blobs, reduced-motion
    └── types/
        ├── database.ts         ← Supabase DB types (`profiles`, `projects`, `project_members`, `columns`, `cards` [+`priority`], `checklist_items`, `labels`, `card_labels`, `todo_lists`, `todo_items`, `notes`, `invitations` + RLS fn signatures incl. `can_access_card`, `owns_todo_list`, `can_edit_project`, `can_edit_card`, `shares_a_project_with`, `redeem_my_invitations`; hand-maintained until CLI regen) + `Profile`/`Project`/`ProjectMember`/`ProjectRole`/`InvitationRole`/`Column`/`Card`/`ChecklistItem`/`Label`/`CardLabel`/`TodoList`/`TodoItem`/`Note`/`Invitation` aliases
        ├── fontsource.d.ts     ← module decls for @fontsource CSS imports
        └── view-transitions.d.ts ← optional startViewTransition typing
```

---

## ⚠️ Open items / known issues

- **Push today's commit.** `3eaba47` ("fix: keep the slash menu and canvas text toolbar inside the viewport") is committed locally but not pushed — run `npm install && npm run typecheck && npm run build && git push` on Windows, then eyeball both fixes in a running `npm run dev` (a tall note + `/` at the bottom; a canvas text box near the top of the stack, before/after panning, desktop + phone-width).
- **Active backlog: `IMPROVEMENT-PLAN-2026-08.md` Tasks 26–38.** 13 self-contained session prompts (Notes/Canvas/Calendar UX + sharing + export). Task 26 (this session's fix, above) is done; the rest are queued in dependency order — open that file for the next prompt.
- **Standing device-bridge quirks** (see the `device-bridge-quirks` project memory file): a stale `.git/index.lock`/`HEAD.lock` blocks `git add`/`commit` fairly often on this mount — safe to `mv` it aside (not `rm`, which fails `Operation not permitted` here) if `ps aux | grep git` shows nothing actually running; and no device-bridge command can run longer than its tool-call timeout with no way to background it across calls, so a full `npm run typecheck`/`build` on this repo often can't be verified in-session — treat any such entry in the feature log as unverified until a Windows or from-scratch-Linux-sandbox run confirms it.
- **Task 15 (Marketing plan) is deliberately deferred** — not an oversight, revisit once the product's shape is more final.
