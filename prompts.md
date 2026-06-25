# prompts.md — Pro Features Build Playbook

> Ordered, copy-paste prompts for building the **Pro-only** feature set on top of Aurora:
> a collaborative **Notes Canvas** (mini OneNote/whiteboard), **custom timed reminders**, and
> **Pro collaboration** (comments, @mentions, review/approval, activity log, reactions).
>
> Same conventions as [prompt.md](./prompt.md): for each phase, meet the **Prerequisites**, switch
> Claude Code to the **Model**, paste the **Prompt**, then run the **Verification** before moving on.
> Every prompt assumes Claude Code reads `CLAUDE.md`, `plan.md`, and `memory.md` first, and ends by
> updating `memory.md` + committing (Conventional Commits), per the golden workflow rules.
>
> **Model guide:** 🟣 **Opus 4.8** = architecture, security/RLS, data model, multiplayer. 🔵 **Sonnet 4.6**
> = standard feature build-out. 🟢 **Haiku 4.5** = tiny mechanical tweaks.

---

## Locked decisions (2026-06-21)

These were decided with the user; build to them and don't re-litigate without asking.

1. **Canvas engine = Custom** — `react-konva` (canvas, drag/resize/rotate, pinning, layers) + `perfect-freehand` (stylus) + `Tiptap` (rich text) + custom audio/video/image elements + a page-background layer. All MIT/free. (tldraw rejected: $6,000/yr commercial; Excalidraw rejected: no native rich text / audio-video / page types.)
2. **Live multiplayer = Yes (Yjs).** One `Y.Doc` per canvas note, synced over Supabase Realtime, with live cursors (awareness). Tiptap rich-text elements bind to fragments of the same `Y.Doc`.
3. **Audio/video = Both** — in-app record/upload (stored in Supabase Storage, Pro-gated, size-capped) **and** paste-to-embed links (YouTube/Vimeo/Loom/SoundCloud).
4. **Collaboration = all four** — threaded comments, @mentions + notifications, review/approval workflow, activity log + reactions.

---

## New dependencies (all MIT / free)

Install as each phase needs them (not all upfront):

- `react-konva` + `konva` — the canvas, transformer (resize/rotate), drag, hit-testing.
- `perfect-freehand` — pressure-sensitive stylus strokes (P3.2).
- `@tiptap/react` + `@tiptap/pm` + `@tiptap/starter-kit` + `@tiptap/extension-highlight` + `@tiptap/extension-text-style` — rich text (P3.3). **Tiptap v3 note:** StarterKit already bundles Underline + Link (don't add them separately), and `extension-text-style` now ships color via TextStyleKit (the old standalone `extension-color` is gone). For multiplayer text: `@tiptap/extension-collaboration` + `@tiptap/extension-collaboration-caret` (v3 renamed `-cursor` → `-caret`).
- `yjs` + `y-protocols` — CRDT document + awareness (P3.7). Transport is a **thin custom provider over Supabase Realtime broadcast** (don't add a heavyweight provider; `y-supabase` is immature — reference only).
- Audio/video recording uses the browser **MediaRecorder API** (no dependency).

Keep the bundle in check: **lazy-load the entire canvas module** (`React.lazy` + dynamic import) so Konva/Tiptap/Yjs never ship to users who don't open a canvas. The app is already over the bundle-size warning (see memory.md).

---

## The Pro-gating principle (read before every phase)

Every feature here is **Pro-only and must be gated twice**:

- **In the UI** — a `useIsPro()` hook (reads `profiles.plan === 'pro'` via the existing `useProfile`) hides/locks the feature and routes free users to the existing `UpgradeModal`. For shared resources, the **board owner's plan governs** (same rule as the existing member limit).
- **At the database (the real gate)** — a new `SECURITY DEFINER` helper `public.project_is_pro(p_project_id uuid) returns boolean` that resolves the project's `owner_id` → `profiles.plan = 'pro'`. Use it in RLS `WITH CHECK` on every new Pro table (and in Storage policies). Written `security definer`, `set search_path = ''`, schema-qualified — exactly like the existing `is_project_member` / `can_edit_project` helpers. **Never trust the client for plan status.**

This keeps the product sellable: a free user can't create canvas notes, custom reminders, or comments by hitting the API directly.

---

## Storage & cost guardrails

The canvas (images, recorded audio/video) is the **first use of Supabase Storage** and the main cost driver (egress). Bake guardrails in from the start:

- One **private** bucket `canvas-media`, path-keyed `‹projectId›/‹noteId›/‹uuid›.ext`, served via **signed URLs**; Storage RLS checks `is_project_member` + `project_is_pro`.
- Enforce **per-file size caps** (e.g. image ≤ 10 MB, audio ≤ 25 MB, video ≤ 100 MB) client-side **and** in the Storage policy.
- Track per-project storage in a `usage` view; surface "X of Y GB used" on the canvas and the billing page. (Fair-use caps protect margins — Pro is $5.99/mo; see the pricing analysis in memory.md.)
- Prefer **embeds over uploads** for long video (a YouTube/Loom link costs you nothing).

---

## Phase map

- **P0** — Pro foundation: `project_is_pro()` + `useIsPro()` + Storage bucket & policies.
- **P1** — Custom timed reminders (due date **+ time**, multiple arbitrary offsets).
- **P2** — Pro collaboration (comments, @mentions + notifications, review/approval, activity log, reactions).
- **P3** — Pro Notes Canvas, sub-phased P3.1 → P3.7.

Suggested order is P0 → P1 → P2 → P3 (smallest/highest-value first; the canvas is the largest).

---

## Phase P0 — Pro foundation (gating + storage)

**Prerequisites**
- The billing work is in place (`plans.ts`, `profiles.plan`, `current_plan()`, `UpgradeModal`). The Pro price/annual change has been built (see memory.md).

**Model:** 🟣 **Opus 4.8** — security/RLS + Storage policies are high-stakes.

**Prompt**
```text
Read CLAUDE.md, plan.md (Security), and memory.md fully first.

Build the Pro-feature foundation. This is gating + storage only — no end-user feature yet.

1. Migration `supabase/migrations/<ts>_pro_foundation.sql`:
   - Add SECURITY DEFINER helper public.project_is_pro(p_project_id uuid) returns boolean — resolves
     the project's owner_id and returns (that owner's profiles.plan = 'pro'). Use `set search_path = ''`,
     schema-qualified refs, mirroring is_project_member / can_edit_project. Grant execute to authenticated.
   - Create a PRIVATE Storage bucket 'canvas-media' (insert into storage.buckets if not exists).
   - Storage RLS on storage.objects for bucket 'canvas-media': a member of the object's project may SELECT;
     INSERT/UPDATE/DELETE require is_project_member AND project_is_pro for the project encoded in the path
     (path convention: '<projectId>/<noteId>/<file>'). Parse projectId via split_part(name,'/',1)::uuid.
   - Enforce per-file size caps in the INSERT policy if feasible (else document the client-side cap).
2. Frontend: add src/features/billing/useIsPro.ts exposing useIsPro() (reads useProfile().plan === 'pro')
   and a small <ProGate> component that renders children for Pro users and an upgrade CTA (opens the
   existing UpgradeModal) otherwise. Export from the billing barrel.
3. Add src/lib/proFeatures.ts documenting which features are Pro and the storage caps (single source of truth,
   imported by UI). Reference it from plans.ts feature lists where relevant.
4. Add a tiny src/lib/storage.ts helper: uploadCanvasMedia(projectId, noteId, file) -> { path }, and
   signedUrl(path) -> string, using supabase.storage. Validate file type + size against proFeatures caps
   BEFORE upload; throw a typed error the UI can show.

Constraints: TypeScript strict, no any. RLS is the real gate — the UI gate is UX only. Don't weaken any
existing policy. Keep helpers flat (no policy re-entry), following the existing SECURITY DEFINER pattern.

When finished: update memory.md (new helper, bucket, useIsPro, storage helper; note this unblocks P1–P3),
and commit. Apply the migration in the Supabase SQL editor (note it as a one-time step in memory.md open items).
```

**Verification**
- As a **free** user, a direct `insert` into a Pro table or a `canvas-media` upload is **rejected** by RLS; as a **Pro** user (or a member of a Pro owner's board) it succeeds.
- `useIsPro()` returns the right value; `<ProGate>` shows the upgrade CTA for free users.
- A signed URL round-trips an uploaded test file; an oversized file is rejected client-side with a friendly error.
- `npm run typecheck && npm run build` clean.

---

## Phase P1 — Custom timed reminders (Pro)

Free keeps the current fixed day-based reminder (`reminder_lead_days`). **Pro unlocks**: a due **time** (not just date) and **multiple, arbitrary offsets** ("2h before", "90m before", "15m before"), on both email and browser channels.

**Prerequisites**
- P0 done. Existing reminder system in place: `cards.due_date` (date), `profiles.reminder_emails_enabled/reminder_lead_days`, `cards.reminder_sent_for`, Edge Function `send-due-reminders` on daily pg_cron, browser `useDueReminders`, `AssigneeField`.

**Model:** 🟣 **Opus 4.8** for the migration + cron + Edge Function (correctness-critical); 🔵 Sonnet for the UI.

**Prompt**
```text
Read CLAUDE.md, plan.md, and memory.md first (especially the Phase 9 reminders design + decision log).

Add Pro custom timed reminders. Do NOT break the existing free day-based reminder.

DATA MODEL — migration `supabase/migrations/<ts>_custom_reminders.sql`:
1. Add cards.due_at timestamptz (nullable). Keep cards.due_date for back-compat; treat due_at as the
   source of truth when present. Backfill due_at = due_date::timestamp at 09:00 local-ish (document the choice).
2. New table card_reminders (id uuid pk, card_id uuid fk on delete cascade, offset_minutes int not null
   check (offset_minutes >= 0), channel text check (channel in ('email','push')) default 'email',
   created_by uuid, created_at). A card can have many. RLS: can_edit_card(card_id) to write; reads
   gated on card membership. INSERT additionally requires project_is_pro(project of the card) — free users
   can't create custom offsets.
3. Dispatch dedupe: table card_reminder_dispatches (card_reminder_id, due_at, sent_at, pk(card_reminder_id, due_at))
   so a given reminder fires once per due_at instance and re-arms if due_at changes.
4. Update the due_reminder_candidates RPC (or add a new one) to compute, per pending card_reminder, whether
   now() is within [due_at - offset_minutes, due_at - offset_minutes + window] and not yet dispatched.

CRON + EDGE FUNCTION:
5. Reschedule pg_cron for send-due-reminders from daily to EVERY 10 MINUTES (document the SQL in supabase/README).
   Make the function idempotent and window-based (tolerance = the 10-min interval). Mark dispatches sent.
6. Keep the existing free daily digest path working (day-based) alongside the new precise path.

FRONTEND:
7. In the card modal (features/board/CardDetailModal): a DueDateField upgrade that adds a TIME picker
   (due_at). For Pro users, a "Reminders" section to add/remove multiple offsets — quick chips
   (15m, 30m, 1h, 2h, 1 day) + a custom value + channel (email/push). Gate behind <ProGate>; free users
   see the existing single day-based control with an upgrade hint.
8. Extend the browser features/reminders/useDueReminders to also fire on time-based offsets (poll the
   user's upcoming card_reminders, fire one Notification per (reminder, due_at), localStorage dedupe).
9. Thread due_at through the board + calendar caches/mutations exactly like due_date today.

Constraints: TS strict, Zod-validate offsets/time. RLS + project_is_pro enforce Pro. No secret in the client.

When finished: update memory.md (data model, cron change, files) and commit. Note the migration + the pg_cron
reschedule as one-time Supabase steps in open items.
```

**Verification**
- A Pro user sets a due date **with a time** and **two** offsets (e.g. 2h + 15m); both fire (browser + email) at the right moments, once each; changing `due_at` re-arms them.
- A free user still gets the day-based reminder and sees an upgrade hint for custom offsets; a direct API insert into `card_reminders` as a free user is **rejected** by RLS.
- pg_cron runs every 10 min; no duplicate sends (dispatch table works).
- `npm run typecheck && npm run build` clean.

---

## Phase P2 — Pro collaboration (comments, mentions, review, activity, reactions)

**Prerequisites**
- P0 done. Existing collaboration in place: `project_members`, roles, `useProjectRealtime` (debounced invalidation), `usePresence`, the Resend email path.

**Model:** 🟣 **Opus 4.8** for the schema/RLS/notifications; 🔵 Sonnet for the UI.

**Prompt**
```text
Read CLAUDE.md, plan.md (Security), and memory.md first (Phase 8 collaboration + realtime patterns).

Add Pro collaboration. All of it is Pro-gated (project_is_pro on the board owner) and realtime.

DATA MODEL — migration `supabase/migrations/<ts>_collaboration_pro.sql`:
1. comments (id, project_id, card_id nullable, canvas_note_id nullable, author_id, body text,
   parent_id nullable self-fk for threads, created_at, edited_at). Exactly one of card_id/canvas_note_id set.
   RLS: read = is_project_member(project_id); write = can_edit_project OR author owns the row;
   INSERT requires project_is_pro(project_id).
2. comment_mentions (comment_id, mentioned_user_id) — populated from @mentions parsed server-side or on insert.
3. reactions (id, target_type in ('comment','card'), target_id, user_id, emoji, unique(target_type,target_id,user_id,emoji)).
4. review: add cards.review_status text check in ('none','in_review','approved','changes_requested') default 'none',
   cards.review_assignee_id, cards.reviewed_by, cards.reviewed_at. A request-review / approve / request-changes flow.
5. activity_log (id, project_id, actor_id, verb, target_type, target_id, meta jsonb, created_at) — append-only;
   read = is_project_member; insert via SECURITY DEFINER triggers on cards/comments/etc. (not client-writable).
6. Add the new tables to the supabase_realtime publication (REPLICA IDENTITY FULL), like Phase 8.

NOTIFICATIONS:
7. notifications (id, user_id, kind, payload jsonb, read_at, created_at), own-row RLS. On @mention,
   review request, or reply: insert a notification (DB trigger) AND optionally email via the existing Resend
   path (an Edge Function or extend send-due-reminders' infra). In-app: a bell in the Topbar with an unread count.

FRONTEND (features/collaboration):
8. A CommentThread component (card modal + later the canvas): threaded list, composer with @mention autocomplete
   (project members), edit/delete own, realtime via useProjectRealtime (add the new tables to its invalidation map).
9. Reactions (emoji bar) on comments and cards.
10. A review control on the card: request review (pick a member), approve / request changes; show a colored
    review badge on the card face. Surface review state in the board toolbar filters.
11. An activity feed (per project + per card) and a notifications dropdown.
12. Gate everything behind <ProGate>; free boards see the feature with an upgrade CTA.

Constraints: TS strict, Zod-validate. RLS + project_is_pro are the real gates. Reuse the realtime + email infra;
no new secrets in the client. Keep components small.

When finished: update memory.md (tables, realtime additions, files) and commit. Note the migration + realtime
enablement as one-time Supabase steps.
```

**Verification**
- Two members on a **Pro** board: a comment, an @mention (notifies + emails the mentioned user), a reply, and a reaction all appear **live** without refresh; a free board shows the upgrade CTA and a direct comment insert is **rejected** by RLS.
- Review flow: request review → assignee sees it → approve / request changes updates the badge live; activity log records each event; the actor can't forge `activity_log` rows.
- Notification bell shows unread counts and marks read.
- `npm run typecheck && npm run build` clean.

---

## Phase P3 — Pro Notes Canvas (sub-phased)

A new **Pro-only** sidebar destination — a per-project collaborative canvas (mini OneNote/whiteboard).
Build the sub-phases in order; each is independently shippable behind `<ProGate>`. Keep the whole module
**lazy-loaded**.

> Naming: call the module `features/canvas` and the nav tab **"Canvas"** (distinct from the existing markdown
> "Notes" tab). Confirm the label with the user if unsure.

### P3.1 — Canvas foundation (Konva, pages, persistence)

**Model:** 🟣 **Opus 4.8** — sets the element/data model everything else builds on.

**Prompt**
```text
Read CLAUDE.md, plan.md, and memory.md first.

Create the Pro Notes Canvas foundation. No freehand/text/media yet — just the canvas, pages, elements
scaffold, and persistence.

DATA MODEL — migration `supabase/migrations/<ts>_canvas.sql`:
1. canvas_notes (id, project_id, title, page_type text check in ('blank','ruled','grid','dotted') default 'blank',
   doc_state bytea null  -- Yjs binary snapshot (P3.7), scene jsonb not null default '{}'  -- denormalized
   elements for fast read/thumbnail, created_at, updated_at, updated_by). updated_at via a touch trigger.
2. RLS: read = is_project_member(project_id); write = can_edit_project(project_id); INSERT/UPDATE require
   project_is_pro(project_id). (Free users can't create canvases.)

FRONTEND (features/canvas, lazy-loaded):
3. Install react-konva + konva. Add a Canvas route + a "Canvas" sidebar nav item (Pro-gated; free users see
   <ProGate> upgrade CTA). A per-project canvas list (like Notes) + an editor.
4. CanvasStage: an infinite, pan/zoom Konva Stage on the aurora/glass background. A background layer that renders
   the selected page_type (blank/ruled/grid/dotted) as a tiled pattern that pans with the canvas.
5. An element model in TypeScript: a discriminated union CanvasElement = Stroke | TextBox | ImageEl | MediaEl,
   each with id, x, y, width, height, rotation, z, locked. Store the elements array in scene jsonb. (Strokes/text/
   media bodies arrive in later sub-phases — stub the renderers now.)
6. Selection + transform: Konva Transformer for move/resize/rotate of a selected element; a floating glass toolbar
   (add-element placeholder, page-type switcher, zoom controls, undo/redo).
7. Undo/redo via a local command stack (will be replaced by Yjs history in P3.7 — keep the API swappable).
8. Persistence: debounced autosave of scene jsonb to canvas_notes (like the notes editor's 700ms autosave +
   flush-on-unmount). One ['canvas', noteId] TanStack cache.

Constraints: TS strict, no any. Lazy-load the module so Konva never ships to non-canvas users. Honor
prefers-reduced-motion. Match Aurora glass/gradient styling. Touch + stylus + mouse all pan/zoom/select.

When finished: update memory.md (canvas table, module, element model) and commit. Note the migration as a
one-time Supabase step.
```

**Verification**
- A Pro user creates a canvas, switches page type (blank/ruled/grid/dotted), pans/zooms on mouse **and** touch; a placeholder element can be selected, moved, resized, rotated; changes autosave and survive reload.
- A free user sees the upgrade CTA; a direct `canvas_notes` insert as free is **rejected** by RLS.
- The canvas chunk is **lazy-loaded** (verify it's a separate bundle). `npm run typecheck && npm run build` clean.

### P3.1b — Layout: full-width editors + Edit/View toggle (Notes & Canvas)

**Model:** 🔵 **Sonnet 4.6** — layout/markup only, no data changes.

**Prompt**
```text
Read CLAUDE.md, plan.md, and memory.md first.

Layout refactor for the per-project Notes and Canvas tabs so each editor uses the FULL width and
editing vs. viewing is one toggle. Works on phone, tablet, iPad, and desktop. Markup/layout only —
do NOT touch data, RLS, autosave, or Pro-gating.

SHARED — both src/features/notes/NotesPanel.tsx and src/features/canvas/CanvasPanel.tsx (they mirror each other):
1. Remove the two-column `grid lg:grid-cols-[18rem_minmax(0,1fr)]` layout and the <aside> side list entirely.
2. At the top of the tab add one header row: a compact glass dropdown picker (match the existing
   src/components/forms/GlassSelect.tsx styling) whose button shows the selected item's title + a chevron;
   opening it shows a glass popover listing every note/canvas (title + a small subtitle — notes: the
   snippet or "Empty note"; canvas: "Grid page · 2m ago"), click one to switch. Next to the picker keep the
   count ("Notes · 3") and the "+ New" GradientButton. Close on select, outside-click, and Escape; keyboard-navigable.
3. Below the header, the selected editor/canvas renders FULL width on every breakpoint.
4. Keep the loading spinner, error panel, and the empty state (no items → the existing create CTA / viewer copy).
   Keep "most-recent selected by default" and delete→fall-back-to-next behavior. Since there's no side list now,
   remove the mobile back-arrow (onBack) from the editors and the swap-list-for-editor logic.

NOTES (NoteEditor.tsx) — single pane + toggle on ALL sizes:
5. Make the Edit / Preview segmented toggle show on every breakpoint (remove lg:hidden). Labels: "Edit" (Pencil)
   and "Preview" (Eye); Preview = read-only rendered markdown.
6. Show only the ACTIVE pane at full width: remove lg:grid-cols-2 and the `hidden lg:block` overrides.
   Edit = the markdown textarea full-width; Preview = rendered markdown full-width. No side-by-side anywhere.
7. The active pane fills the available height (grows to fill the tab). Viewers (canEdit=false) keep the single
   read-only rendered view, no toggle. Default mode = Edit.

CANVAS (CanvasEditor.tsx) — fill the space + view toggle:
8. Make the Konva stage FILL the available area: remove the fixed `h-[58vh] sm:h-[66vh]` cap and the heavy
   GlassPanel padding around it; the stage container grows to fill the tab's content height (flex column with the
   stage area flex-1, min-height ~75vh; stage stays `absolute inset-0`). Keep the floating toolbar overlay +
   onViewportChange recentring.
9. Add an Edit / View segmented toggle (same control as notes; only for canEdit users). In View mode render the
   stage read-only (pan/zoom only, like canEdit=false) and hide the editing controls (add, undo/redo, lock,
   delete, page-type switcher); keep the zoom controls + zoom/page indicator. Default = Edit.

CONSTRAINTS: TS strict, no any; small focused components. Keep autosave (debounce + flush-on-unmount), the save
indicator, inline title editing, delete-confirm, and ALL RLS/Pro gating exactly as-is. Match Aurora glass/gradient
+ spring motion; honor prefers-reduced-motion. Canvas module stays lazy-loaded. Touch + stylus + mouse all work.

When finished: `npm run typecheck && npm run lint && npm run build` must be clean; update memory.md (note the
full-width picker layout + Edit/View toggle) and commit.
```

**Verification**
- Desktop **and** a narrow (mobile) width: the dropdown picker switches items; the editor/canvas uses full width; "+ New" and the count are present.
- Notes toggles Edit ↔ Preview as a single full-width pane (no split anywhere). A viewer sees only the read-only render.
- Canvas fills the content area; Edit ↔ View hides/shows the edit controls; pan/zoom works in both modes.
- `npm run typecheck && npm run lint && npm run build` all clean.

### P3.1c — Standalone & shareable canvases

> Canvases become independent of projects: a canvas can belong to a project (shared via project membership,
> as today) OR be a personal, project-free canvas owned by one user and shared with specific people via its
> own members list. **Notes stay project-only.** Build AFTER P3.1b (reuses the full-width canvas editor +
> picker). Two prompts: data model first, then the sharing UI.

#### P3.1c-1 — Data model + standalone canvases + aggregated Canvas page

**Model:** 🟣 **Opus 4.8** — changes the canvas data model + RLS.

**Prompt**
```text
Read CLAUDE.md, plan.md, and memory.md first.

Make canvases independent of projects. A canvas may belong to a project (shared via project membership,
as today) OR be a personal canvas with NO project, owned by one user. Notes are unchanged (project-only).
This prompt = data model, RLS, and the standalone/aggregated UI. Sharing UI is the NEXT prompt, but create
the canvas_members table + its RLS now.

MIGRATION supabase/migrations/<ts>_canvas_standalone.sql:
1. canvas_notes: add `owner_id uuid references auth.users(id) on delete cascade`; BACKFILL existing rows from
   each canvas's project owner; then `set default auth.uid()` and `set not null`. Make `project_id` NULLABLE.
   Add index (owner_id, updated_at desc).
2. New table canvas_members (mirror project_members, for independent-canvas sharing): canvas_id → canvas_notes
   on delete cascade, user_id → auth.users on delete cascade, role text not null default 'editor'
   check in ('editor','viewer'), created_at, primary key (canvas_id, user_id), index on (user_id). The OWNER
   is canvas_notes.owner_id (NOT a member row).
3. SECURITY DEFINER helpers (sql, stable, `set search_path=''`, grant execute to authenticated) — same style as
   the existing project helpers (is_project_member / can_edit_project / project_is_pro):
   - user_is_pro(uuid): profiles.plan='pro' for that user.
   - canvas_is_pro(uuid): project canvas → project_is_pro(project_id); independent → user_is_pro(owner_id).
   - is_canvas_owner(uuid): canvas_notes.owner_id = auth.uid().
   - can_access_canvas(uuid): owner OR (project_id not null AND is_project_member) OR row in canvas_members.
   - can_edit_canvas(uuid): owner OR (project_id not null AND can_edit_project) OR canvas_members.role='editor'.
4. Extend touch_canvas_notes() to RAISE if project_id or owner_id changes (immutable — stops moving a canvas
   between project/independent to dodge the Pro gate or sharing).
5. Replace canvas_notes RLS:
   - SELECT: can_access_canvas(id).
   - INSERT: (project_id not null AND can_edit_project(project_id) AND project_is_pro(project_id))
             OR (project_id is null AND owner_id = auth.uid() AND user_is_pro(auth.uid())).
   - UPDATE: using can_edit_canvas(id); with check can_edit_canvas(id) AND canvas_is_pro(id).
   - DELETE: (project_id not null AND can_edit_project(project_id)) OR is_canvas_owner(id).
6. canvas_members RLS: SELECT using can_access_canvas(canvas_id); INSERT/UPDATE/DELETE gated by
   is_canvas_owner(canvas_id).

FRONTEND:
7. types/database.ts + features/canvas/api.ts + useCanvas.ts: project_id is now string|null; add owner_id. New
   queries: my independent canvases (project_id is null AND owner_id = me) AND an aggregated list for the
   top-level page = independent canvases + canvases across all my projects, each labeled with its project name or
   "Personal". Add create-independent-canvas (project_id null); keep create-project-canvas.
8. Rewrite CanvasHome (/canvas) from a project PICKER into the real Canvas workspace using the SAME full-width
   dropdown-picker + editor from P3.1b: the picker lists ALL my canvases grouped/labeled (Personal vs each
   project); "+ New" creates a PERSONAL canvas; selecting any opens it in the full-width editor inline. Keep it
   Pro-gated (<ProGate>) and keep the editor lazy-loaded (CanvasHome stays Konva-free; dynamic-import the editor
   like ProjectPage does).
9. The per-project Canvas tab (CanvasPanel) is unchanged except its writes now flow through can_edit_canvas RLS.

CONSTRAINTS: TS strict, no any. Double Pro-gate (UI + RLS). Match Aurora styling; canvas editor stays lazy-loaded.
Note the migration as a one-time Supabase step. Update plan.md (canvas data model + sharing model) and memory.md,
then commit.
```

**Verification**
- A Pro user creates a PERSONAL canvas from /canvas (no project), edits it, reloads — it persists and appears under "Personal".
- The /canvas picker shows personal canvases AND canvases from every project, each labeled; opening any works.
- A free user sees the upgrade CTA; a direct insert of an independent canvas as a free user is **rejected** by RLS.
- Existing project canvases still work (owner_id backfilled). `npm run typecheck && npm run lint && npm run build` clean.

#### P3.1c-2 — Sharing UI for independent canvases

**Model:** 🔵 **Sonnet 4.6**.

**Prompt**
```text
Read CLAUDE.md, plan.md, and memory.md first.

Add sharing to INDEPENDENT (project-free) canvases, mirroring the project Share flow. Project canvases keep
using project membership — only independent canvases get this.

MIGRATION supabase/migrations/<ts>_canvas_sharing_profiles.sql:
1. shares_a_canvas_with(uuid) SECURITY DEFINER: true if the current user and the given user co-own/co-share any
   canvas (owner↔member or member↔member). Same style as shares_a_project_with.
2. Extend the profiles SELECT policy to ALSO allow `public.shares_a_canvas_with(id)` (so the members panel can
   show shared users' names/avatars). Keep the existing own-row + shares_a_project_with clauses intact.

FRONTEND:
3. features/canvas members api + hooks: list a canvas's members (join profiles for name/avatar/email), add member
   by email (look up the profile by email like the project invite does; insert into canvas_members with a role),
   change role, remove member. Owner-only (RLS enforces it; hide controls for non-owners).
4. A "Share" control on an INDEPENDENT canvas (owner only) opening a glass modal: current members + roles + remove,
   plus an invite-by-email row with an editor/viewer GlassSelect. Reuse the project members panel components/styling
   where possible. Show member avatars on the canvas header.
5. Shared editors can edit; shared viewers get the read-only (View) canvas; non-members can't load it (RLS).

CONSTRAINTS: TS strict, no any. Owner-only management (UI + RLS). Match Aurora styling. Update memory.md + commit.
```

**Verification**
- An owner shares a personal canvas with another user as editor → that user sees it in their /canvas list and can edit; as viewer they can only view.
- Removing a member revokes access immediately; a non-member gets nothing (RLS).
- Only the owner sees the Share/manage controls. `npm run typecheck && npm run lint && npm run build` clean.

### P3.2 — Freehand / stylus

**Model:** 🔵 **Sonnet 4.6**.

**Prompt**
```text
Read CLAUDE.md, plan.md, and memory.md first.

Add pressure-sensitive freehand drawing to the canvas (features/canvas).

1. Install perfect-freehand. Capture pointer events on the Stage (pointerdown/move/up); collect [x,y,pressure]
   points. Use real stylus pressure when present (simulatePressure:false when pointer is a pen), else simulate.
2. Render each stroke as a Konva Line/Path from getStroke(); store strokes as Stroke elements in scene (points,
   color, size, thinning, smoothing). Strokes are first-class elements: selectable, movable, resizable, lockable,
   z-ordered — like any other element.
3. A pen toolbar: color, size, and a few presets (pen/marker/highlighter — highlighter = translucent, multiply).
   An eraser (stroke-level erase). Palm rejection: ignore touch while a pen is active.
4. Performance: draw the in-progress stroke on a dedicated layer; commit to the scene on pointerup. Keep it
   smooth on a tablet.

Constraints: TS strict. Reduced-motion safe. Don't regress pan/zoom/select from P3.1 (tool modes: select vs draw).

When finished: update memory.md and commit.
```

**Verification**
- Drawing with a stylus varies width by pressure; marker/highlighter look right; eraser removes strokes; strokes can be selected, moved, resized, locked; smooth on a touch device. Build clean.

### P3.3 — Rich text (Tiptap)

**Model:** 🔵 **Sonnet 4.6**.

**Prompt**
```text
Read CLAUDE.md, plan.md, and memory.md first.

Add rich-text elements to the canvas.

1. Install @tiptap/react, @tiptap/pm, @tiptap/starter-kit, @tiptap/extension-highlight, @tiptap/extension-text-style. (Tiptap v3: Underline + Link are already in StarterKit; color comes from text-style/TextStyleKit — do NOT add extension-underline/link/color separately.)
2. A TextBox element renders a Tiptap editor as an HTML overlay positioned/scaled to the element's box on the
   Konva stage (sync transform: x/y/width/rotation/zoom). Double-click to edit, click-away to commit.
3. A formatting toolbar (appears on selection): bold, italic, underline, highlight, text color, link (paste/enter
   URL — sanitize href to http/https/mailto, like the existing notes markdown renderer), lists.
4. Store the TextBox body as Tiptap JSON in the element. Keep it movable/resizable/rotatable/lockable/z-ordered.
   (In P3.7 this body becomes a Yjs fragment for collaborative editing — structure it so that swap is clean.)

Constraints: TS strict. XSS-safe links. The overlay must stay aligned during pan/zoom/rotate. Match Aurora type.

When finished: update memory.md and commit.
```

**Verification**
- Add a text box, type, apply bold/italic/underline/highlight/color/link; move/resize/rotate it and the text stays aligned; a `javascript:` link is rejected; reload persists. Build clean.

### P3.4 — Images

**Model:** 🔵 **Sonnet 4.6**.

**Prompt**
```text
Read CLAUDE.md, plan.md, and memory.md first.

Add images to the canvas.

1. Add image via file picker, paste, or drag-drop. Validate type/size against proFeatures caps; upload to the
   'canvas-media' bucket via lib/storage (path '<projectId>/<noteId>/<uuid>.<ext>'); store an ImageEl element
   referencing the storage path (NOT a data URL).
2. Render via a signed URL (cache the URL); show a skeleton while loading. Move/resize (keep aspect by default,
   shift to free-resize)/rotate/lock/z-order like any element. Crop is optional/stretch goal.
3. Handle upload errors + oversize with friendly inline messages. Free users blocked by <ProGate> + Storage RLS.

Constraints: TS strict. Never inline large images into scene jsonb — always Storage + signed URL.

When finished: update memory.md and commit.
```

**Verification**
- Add/paste/drop an image; it uploads, renders via signed URL, moves/resizes/rotates/locks; oversize is rejected; reload persists; a free user can't upload (RLS). Build clean.

### P3.5 — Audio & video (record/upload + embeds)

**Model:** 🟣 **Opus 4.8** — MediaRecorder + storage + embed sanitization.

**Prompt**
```text
Read CLAUDE.md, plan.md, and memory.md first.

Add audio + video to the canvas. Support BOTH in-app record/upload AND external embeds (the locked decision).

1. RECORD/UPLOAD: a MediaEl (kind 'audio'|'video', source 'file'). Record via MediaRecorder (audio: webm/opus;
   video: webm/vp9) with a clear record/stop UI + duration + a size meter against the cap. Or upload a file.
   Validate type/size (caps in proFeatures), upload to 'canvas-media', store the storage path. Render an inline
   audio/video player (signed URL) as a movable/resizable/lockable element.
2. EMBED: a MediaEl (source 'embed'). Paste a YouTube/Vimeo/Loom/SoundCloud URL; parse + validate the provider
   (allow-list only), store the canonical embed URL, render a responsive iframe element. Reject unknown hosts.
3. Respect storage caps + show usage. Prefer embeds for long video (document this in the UI hint).

Constraints: TS strict. Allow-list embed providers (no arbitrary iframes — XSS/clickjacking). Permissions UX for
the mic/camera. Free users blocked by <ProGate> + RLS. Lazy-load recorder code.

When finished: update memory.md and commit.
```

**Verification**
- Record a short audio note and a short video; both upload, play inline, and move/resize; an oversize recording is blocked. Paste a YouTube + a Loom link → both embed and play; a non-allow-listed URL is rejected. Free user blocked. Build clean.

### P3.6 — Pin / lock / z-order / element management

**Model:** 🟢 **Haiku 4.5** or 🔵 Sonnet.

**Prompt**
```text
Read CLAUDE.md, plan.md, and memory.md first.

Polish element management on the canvas.

1. Pin/lock: a locked element can't be moved/resized/selected by normal drag (toggle in a context menu / toolbar);
   a "pin to canvas" affordance for background-anchored elements.
2. Z-order: bring-forward / send-backward / to-front / to-back; multi-select (marquee + shift-click) with group
   move/transform; align/distribute (stretch goal); duplicate, delete, copy/paste.
3. A right-click / long-press context menu and keyboard shortcuts (Del, Cmd/Ctrl+C/V/Z/Shift+Z, arrows nudge).
4. A small layers/element list panel (optional) for selecting + reordering + toggling lock/visibility.

Constraints: TS strict. Keyboard + touch + stylus parity. Don't regress earlier sub-phases.

When finished: update memory.md and commit.
```

**Verification**
- Lock prevents edits; z-order changes stacking; marquee multi-select group-moves; duplicate/delete/copy-paste and shortcuts work on mouse, touch, and keyboard. Build clean.

### P3.7 — Live multiplayer (Yjs + Supabase Realtime + cursors)

**Model:** 🟣 **Opus 4.8** — the hardest, highest-stakes sub-phase.

**Prompt**
```text
Read CLAUDE.md, plan.md, and memory.md first (especially the Phase 8 realtime design).

Make the canvas collaborative in real time with Yjs over Supabase Realtime. Convert the local scene to a CRDT.

1. Install yjs + y-protocols. Model one Y.Doc per canvas note: a Y.Array<Y.Map> 'elements' (each element a Y.Map
   of its fields), and for each TextBox a Y.XmlFragment bound to Tiptap via @tiptap/extension-collaboration
   (+ @tiptap/extension-collaboration-caret — v3 name). Replace P3.1's local scene state with bindings to this Y.Doc; replace the local
   undo stack with Y.UndoManager.
2. TRANSPORT: write a THIN custom Yjs provider over a Supabase Realtime channel `canvas:<noteId>`:
   - On join: load the persisted doc_state (bytea) from canvas_notes and Y.applyUpdate to seed.
   - Broadcast local Yjs updates (Y.on('update')) over the channel; apply remote updates.
   - AWARENESS (y-protocols/awareness): broadcast cursor position, selection, name/color, avatar; render live
     remote cursors + selection halos on the stage. Reuse the existing presence avatar styling.
3. PERSISTENCE: debounce-encode Y.encodeStateAsUpdate and save to canvas_notes.doc_state (bytea); also write the
   denormalized scene jsonb for fast non-realtime reads/thumbnails. Last-write is safe (Yjs merges). Handle
   reconnect: re-seed from doc_state, then resume live.
4. CONFLICTS/PERF: Yjs handles concurrent edits; ensure large image/media bodies are NOT in the Y.Doc (only the
   storage path + transform are). Throttle awareness + update broadcasts. Cap channel payload size.
5. Gating: only members of a Pro board join the channel (project_is_pro + membership). RLS already protects
   doc_state.

Constraints: TS strict. Don't leak across notes (channel keyed per noteId). Reduced-motion for cursor animations.
Keep it smooth with 3–5 concurrent editors. Document the provider design in memory.md (it's novel for this repo).

When finished: update memory.md (the Yjs model + provider + the doc_state column usage) and commit.
```

**Verification**
- Two browsers open the same canvas: strokes, text edits, image moves, and page-type changes appear **live** in both, with visible remote cursors + selection; closing/reopening re-seeds from `doc_state` with no loss; edits in a **different** canvas never bleed in; smooth with 3+ editors. A non-member / free board can't join (RLS). Build clean.

---

## Final step — GO-LIVE (do this LAST, after P3 is built)

> **Decision (2026-06-22): build everything first, then launch.** None of this happens mid-build — it only matters once P3 (the canvas) is done and you're ready to charge real customers. Most of it is on Dodo's side or is content, not code. Until then the app runs fine on Dodo **TEST** mode + the manual Pro-flip.

**Payments — switch Dodo from TEST → LIVE:**
- Complete Dodo **KYC / business verification** (Dashboard → Verification: product + payout details; ~24–72h).
- In Dodo **Live mode**, recreate the two Pro products (monthly $5.99 / annual $68.29) → new **live** product ids; add a **live webhook** endpoint (`…/functions/v1/dodo-webhook`) → copy its signing secret.
- `supabase secrets set DODO_PAYMENTS_ENVIRONMENT=live`, `DODO_PAYMENTS_API_KEY=<live>`, `DODO_PRODUCT_PRO_MONTHLY`/`ANNUAL=<live ids>`, `DODO_WEBHOOK_SECRET=<live>`; redeploy `send-due-reminders --no-verify-jwt` for the prod email path; test a checkout end-to-end.

**Required pages (Dodo activation needs these):**
- Add a **Refund / Cancellation policy** page and a **Contact** page (support email) as `features/marketing` routes (reuse `LegalPage`), linked in the footer.
- Finalize **Terms** & **Privacy** (remove the "template / lawyer-review" banner; ideally a real legal review before charging).
- Provide at least one **social link** (founder LinkedIn / product X / GitHub) for the Dodo verification form.

**Polish & launch checks:**
- **Pricing/caps:** confirm `proFeatures.ts` storage caps match the $5.99 economics; surface usage on the billing page.
- **Update `plan.md`** to fold in the new architecture (canvas data model, Yjs provider, Pro-gating helper, reminders model, collaboration schema) — golden rule #4. Keep `prompts.html` in sync if used.
- **Security pass:** RLS on every new table + Storage; confirm `project_is_pro` can't be bypassed.
- **Performance:** load-test the realtime canvas; **Lighthouse** + bundle check (canvas must stay lazy-loaded).
- Optional: a **custom domain** (more legit than `*.pages.dev`).
