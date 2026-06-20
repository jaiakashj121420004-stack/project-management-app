# memory.md — Current State

> **The living memory of this project.** Read this first every session to know where things stand. **Update it after every meaningful change, then commit to git** (see [CLAUDE.md](./CLAUDE.md)). For the full spec see [plan.md](./plan.md); for build steps see [prompt.md](./prompt.md).
>
> Keep this file lean: it tracks *state*, not specification. Don't paste design or architecture here — link to `plan.md`.

---

## 📍 Status

- **Phase:** Phase 6 (Calendar view) — **done.** A new `features/calendar` module renders every card with a `due_date` across **all projects** (default) or a single project (a scope `<select>`), with a **Month / Week** toggle and prev/today/next navigation. Date math is pure **date-fns** (`dates.ts` — month/week day arrays, `toDateKey`, `periodLabel`, `groupCardsByDate`); no calendar dependency added. Cards show as compact **chips tinted by project accent** (left gradient bar) with an **urgency dot** (overdue=danger, due-soon=warning, via the Phase 5 `due.ts`); clicking a chip opens the **same Phase 5 `CardDetailModal`**. **Drag-to-reschedule** uses dnd-kit (`DraggableCardChip` ⇄ `DayCell` droppable, `pointerWithin`) writing `due_date` optimistically across the `['calendar-cards']`, `['board', id]`, and `['card-extras', id]` caches; the lifted clone is a Framer-Motion `DragOverlay` (reduced-motion safe). Overflowing days collapse to **"+N more"** → a `DayCardsModal`; empty days are still drop targets. **Responsive:** month/week grid on `≥640px`, a tap-to-open **agenda list** on small phones (`useMediaQuery`, so only one mounts and dnd droppables aren't duplicated). typecheck/lint/build clean.
- **Since Phase 6 (2026-06-20):** shipped a batch of user-requested fixes + extras on top of the Phase 6 baseline — (1) checklist/label **add bugfix** (nested-form), (2) deeper **3D buttons**, (3) **task priority** (open-ended P1+), and (4) a **daily to-do planner** tab. See done-log + decision-log. **Two new migrations to apply:** `20260620100000_card_priority.sql`, `20260620120000_todos.sql`. Phase 4 + 5 migrations are now applied live; typecheck passes on the dev machine.
- **Next step:** Run **Phase 7 (Notes/docs per project)** from [prompt.md](./prompt.md) / `prompts.html` — a `notes` table (RLS by membership) + a per-project Notes tab with markdown editor + debounced autosave. Apply the two new migrations above first, then run the live verifications (below).
- **Repo:** github.com/jaiakashj121420004-stack/project-management-app *(local `main` is ahead of origin — Phase 6 + the 2026-06-20 batch committed locally, **push pending**)*
- **Environment:** GitHub · Supabase · Cloudflare · Node.js — ready ✅ (see [SETUP.md](./SETUP.md))
- **App is deployable:** ✅ `npm run build` produces `dist/` (full design system + app shell + /style-guide). Cloudflare Pages not yet connected.
- **Last updated:** 2026-06-20.

---

## ✅ Done log

- [x] Requirements gathered (sync ✔, collaborators ✔, features ✔, free + sellable ✔).
- [x] Architecture & stack chosen — see `plan.md` §3.
- [x] Aurora design system defined — see `plan.md` §4.
- [x] Data model & security model drafted — see `plan.md` §5–6.
- [x] Roadmap + per-phase build prompts written — see `prompt.md`.
- [x] Foundation docs created: `CLAUDE.md`, `plan.md`, `memory.md`, `prompt.md`, `prompts.html`, `SETUP.md`.
- [x] Environment ready: GitHub repo, Supabase, Cloudflare, Node.js. Repo wired into Phase 0.
- [x] **Phase 0 — Setup & infra** — Vite + React + TS (strict) scaffolded in place; Tailwind/PostCSS, Framer Motion, dnd-kit, TanStack Query, React Router, supabase-js, Zod, date-fns, vite-plugin-pwa installed & wired; typed Supabase client; ESLint (flat) + Prettier; clean folder structure; README run/deploy docs; git initialized + first commit + pushed to GitHub.
- [x] **Phase 1 — Design system & app shell** — Full Aurora theme (CSS-var tokens for both first-class light/dark, six accent gradients, glass/semantic values), self-hosted fonts (Space Grotesk + Inter via @fontsource-variable), animated `AuroraBackground` (drifting blobs + pointer parallax + grain), flowing-gradient text/buttons + rotating conic gradient-border, and the core component library: `GlassPanel`, `GlassCard` (3D pointer tilt), `GradientButton` (3D tactile, variants/sizes), `Field`, `Badge`, `Avatar`, `Modal`, `Spinner`, `Skeleton`, `ThemeToggle` (persisted, View-Transitions cross-fade), `Reveal` motion wrapper. Responsive app shell (collapsible glass sidebar / mobile drawer + bottom nav + top bar). Routes: `/` (Boards), `/calendar`, `/notes` (placeholders), `/style-guide` showcase. All heavy motion gated behind `prefers-reduced-motion`.
- [x] **Phase 2 — Auth (email/password + Google)** — `profiles` table (1:1 with `auth.users`) + `handle_new_user()` SECURITY DEFINER trigger (auto-creates a profile on sign-up) + own-row RLS, as a migration under `supabase/migrations`. Aurora-styled **Sign Up / Log In / Forgot Password** screens (shared `AuthLayout` glass card on the aurora bg) plus a **Continue with Google** button and a **Set-new-password** screen for the recovery link; all inputs validated with Zod, friendly inline + form-level errors. `AuthProvider` + `useAuth` expose session/user/loading (Supabase `onAuthStateChange` + persistence/refresh); `useProfile`/`useUpdateProfile` (TanStack Query) back the nav + profile screen. `ProtectedRoute` / `PublicOnlyRoute` guards; a `UserMenu` (avatar → Profile / Sign out) replaced the placeholder avatar in the top bar. Minimal **Profile** screen edits the display name.
- [x] **Phase 3 — Projects (workspaces) + multi-tenant RLS** — `projects` (`owner_id`, `name`, `description`, `accent`, `created_at`) + `project_members` (`role` owner/editor/viewer, PK `project_id`+`user_id`) migration. An `after insert` trigger (`handle_new_project()`, SECURITY DEFINER) seeds the creator as an `owner` member. RLS: projects readable by members (`is_project_member(id)`), insertable for self, update/delete owner-only; members readable by fellow members, insert/delete owner-only (`is_project_owner(project_id)`). Both checks run through **SECURITY DEFINER** helpers so policies never sub-query `project_members` directly → no recursion. Frontend: a `features/projects` module — `ProjectsPage` dashboard (vivid Aurora glass `ProjectCard`s with accent gradients, stretched-link nav, owner-only edit/delete), `ProjectFormModal` (name + description `TextArea` + six-option `AccentPicker`), `DeleteProjectDialog`, `ProjectPage` route (accent-themed, board placeholder). Data via **TanStack Query** (`useProjects`/`useProject` + create/update/delete with optimistic cache writes), validated with **Zod**. New shared `TextArea` form primitive. `ProjectsPage` is now the index route; the old sample `Home` page was removed.
- [x] **Phase 4 — Kanban board** — `columns` (`project_id`, `name`, `position`, `created_at`) + `cards` (`project_id`, `column_id`, `title`, `description`, `due_date`, `assignee_id`, `position`, `created_at`) migration. RLS on both: every op gated on `is_project_member(project_id)` (the Phase 3 SECURITY DEFINER helper — no new recursion work). A `seed_project_columns()` SECURITY DEFINER `after insert` trigger gives new projects To Do/In Progress/Done; a one-time backfill seeds existing projects. Frontend `features/board` module: `Board` (DndContext + DragOverlay + confetti orchestrator), `BoardColumn` (glass panel, draggable grip, inline rename, delete dialog, quick-add composer), `BoardCard`/`CardSurface` (glass card with accent glow), `CardDetailModal` (title + description now; checklists/due/labels/assignee reserved for Phase 5), `DeleteColumnDialog`, `AddColumn`, `Confetti`. Ordering via fractional `position` midpoints (`ordering.ts` — `positionBetween`/`neighbourPosition`, no collisions). Data on a single `['board', projectId]` TanStack cache with optimistic add/rename/delete/move for columns and cards (`useBoard.ts`). dnd-kit: Mouse(distance) + Touch(press-delay) + Keyboard sensors, `closestCorners`, live cross-column preview in `onDragOver`, columns + within-column reflow via applied sortable transforms; confetti fires only when a card *enters* a Done-type column. Zod-validated inputs; all heavy motion behind reduced-motion.
- [x] **Phase 5 — Card details (to-dos, due dates, labels)** — `checklist_items` (id, card_id, text, is_done, position) + `labels` (id, project_id, name, color) + `card_labels` (card_id, label_id, composite PK) migration. RLS: `labels` gated on `is_project_member(project_id)`; `checklist_items` + `card_labels` gated on a new SECURITY DEFINER helper `can_access_card(card_id)` that resolves the card's project once (keeps policies flat, no cross-table RLS re-entry). Label `color` is a name constrained by a CHECK (like `projects.accent`), mapped to a hex in `src/lib/labelColors.ts`. Frontend (extends `features/board`): one optimistic `['card-extras', projectId]` cache ({labels, checklist, cardLabels}) via `cardExtras.api.ts` + `useCardExtras.ts`; `due.ts` (urgency status/label helpers, date-fns); rebuilt `CardDetailModal` with `DueDateField`, `CardLabelsSection` (attach/detach + inline create/delete with a swatch picker), and `Checklist` (`ChecklistItemRow`, nested dnd-kit reorder, progress bar); `LabelPill` presentational; `CardSurface` now shows label swatches, a urgency-colored due pill, and a "done/total" tally; `BoardToolbar` (title search + due chips + label chips) with `display:none` filtering so drag ordering stays correct. Card due date persists via the extended `useUpdateCard` (now writes `due_date`). typecheck/lint/build clean.
- [x] **Phase 6 — Calendar view** — `features/calendar` module. **No new migration** (reuses `cards.due_date`). `api.ts`: `fetchDatedCards()` (one query, `due_date is not null`, RLS-scoped across every project) + `updateCardDueDate()`. `useCalendar.ts`: a `['calendar-cards']` query plus `useRescheduleCard` / `useUpdateCalendarCard` / `useDeleteCalendarCard` — each optimistic and **cross-cache** (patches the project's `['board', id]` and, on delete, `['card-extras', id]` too, so changes show instantly on return to the board). `dates.ts`: date-fns helpers (month/week day arrays, `toDateKey` local `YYYY-MM-DD`, `periodLabel`, `groupCardsByDate`). UI: `CalendarPage` (DndContext orchestrator, view/scope/cursor state, both modals), `CalendarToolbar` (title + period, month/week segmented toggle, prev/today/next, project scope select), `CalendarGrid` → `DayCell` (droppable day, accent today-pill, "+N more"), `CardChip`/`DraggableCardChip` (accent bar + urgency dot; presentational chip backs grid/overlay/agenda/peek), `AgendaList` (mobile), `DayCardsModal` (day overflow). New shared hook `src/hooks/useMediaQuery.ts`. Calendar route wired in `App.tsx` (replaced the placeholder). typecheck/lint/build clean.
- [x] **Post-Phase-6 batch (2026-06-20, user-requested)** — **(1) Bugfix:** the card modal couldn't add checklist items or labels — both composers were `<form>`s **nested inside the modal's own `<form>`** (invalid HTML), so clicking "+" bubbled up and submitted/closed the card (looked like a reload). Converted both to plain inputs with explicit click + Enter handlers (`Checklist.tsx`, `CardLabelsSection.tsx`). **(2) 3D buttons read flat at rest** — deepened the resting/hover/active shadow stacks in `.btn-3d`/`.btn-3d-soft` and increased the lift travel (`index.css`, `GradientButton.tsx`). **(3) Task priority** — open-ended integer `cards.priority` (P1 = highest, no upper bound), `PriorityField` picker (P1–P10 quick + "Higher…" custom), tier-colored `P#` pill on the card face; flows through the shared `updateCardDetail`, so the board **and** calendar persist it (`lib/priority.ts` + migration `20260620100000_card_priority.sql`). **(4) Daily to-do planner** — new `features/todos` module + sidebar **To-Do** tab: per-day, **multiple named lists** (Personal/Work…), each its own checklist (add/tick/delete, rename/delete list), day navigation; **private to the user** via own-row RLS + an `owns_todo_list()` SECURITY DEFINER helper (migration `20260620120000_todos.sql`). Verified by inspection + dev-machine `npm run typecheck` (the sandbox file-mirror desynced, so in-session `tsc` was unreliable — same flaky-mount issue as the 2026-06-18 incident).
- [ ] Phase 7 — Notes/docs
- [ ] Phase 8 — Collaboration
- [ ] Phase 9 — PWA & reminders
- [ ] Phase 10 — Polish & launch

---

## 🧠 Decision log

> One line per decision. Full reasoning lives in `plan.md`.

- **2026-06-20** — **Daily to-do planner = a private, non-project feature.** Lists/items belong to **one user**, not a project, so RLS is the simple **own-rows** pattern (like `profiles`), not membership. `todo_lists.user_id` **defaults to `auth.uid()`** so inserts omit it; `todo_items` gate through a new SECURITY DEFINER **`owns_todo_list(list_id)`** helper (resolves the list's owner once — same "keep policies flat" rationale as `can_access_card`). The model is **per-day, multi-list**: a `(list_date, name)` list holds items, so a day can have several named lists (Personal/Work). State is one cache **per day** (`['todos', dateKey]` → `{lists, items}`), optimistic like the board. No drag-reorder (append by fractional `position`); kept out of the project nav as its own sidebar tab + `/todos` route.
- **2026-06-20** — **Task priority is an open-ended integer, not an enum.** Per the request ("P1…P10 and beyond if more tasks"), `cards.priority` is a nullable `integer >= 1` (1 = most urgent, NULL = unset) — no fixed set, so big boards can use P11+. UI: `PriorityField` offers P1–P10 quick chips + a "Higher…" number input; `lib/priority.ts` is the single source of `formatPriority`/tier→color used by both the picker and the card-face pill. It **rides the existing `updateCardDetail`** path (added one column to the patch), so the board's `useUpdateCard` and the calendar's `useUpdateCalendarCard` both persist it with no new mutation. **Card-modal add bug (same day):** the checklist + label composers were `<form>`s nested in the modal's `<form>` — invalid HTML that made "+" submit the outer card form; the fix (here and the pattern going forward) is **no nested `<form>`s** — list composers use a div + click/Enter handlers.
- **2026-06-18** — **Phase 6 Calendar view:** No schema change — the calendar is a **read/rewrite over `cards.due_date`** (populated since Phase 5). **One query feeds the whole view:** `fetchDatedCards()` selects every card with a non-null `due_date` (RLS scopes it to the user's projects), and the **scope** (all-projects vs one project) is a client-side filter, so switching scope costs nothing. **Cross-cache mutations** are the key design: a card lives simultaneously in `['calendar-cards']`, its project's `['board', id]`, and `['card-extras', id]`, so reschedule/edit/delete patch **all relevant caches optimistically** (and invalidate them on settle) — drag a card to a new day here and it's already moved when you open the board. **Drag-to-reschedule** uses dnd-kit's low-level `useDraggable`/`useDroppable` (not Sortable — there's no intra-day order to persist): each chip is draggable, each `DayCell` is a droppable keyed by its `toDateKey` (`YYYY-MM-DD`), and drop sets `due_date` to that key. Only the in-grid chip registers a draggable for a given id; the lifted clone, agenda rows, and overflow-modal rows reuse the **presentational `CardChip`** (no hook) so there's never a duplicate-draggable-id. **Chips encode two signals at once:** project identity (accent gradient bar, via `accentVars`) and urgency (a danger/warning dot from the Phase 5 `due.ts`). **Clicking a chip opens the exact Phase 5 `CardDetailModal`** (imported from `features/board`), wired to the calendar's own mutations — full reuse, no fork. **Responsiveness** is a JS media-query split (`useMediaQuery('(min-width:640px)')`) rather than CSS `hidden`, specifically so the month grid's dnd droppables and the agenda don't both mount; mobile gets a tap-to-open agenda where rescheduling happens via the card's existing date picker. **Date math is all date-fns**, local-time throughout (`toDateKey`/`isToday`/`parseISO` all align with `due.ts`'s `startOfToday`), so a card sits on the same day it was set to regardless of timezone — no heavy calendar lib. **Filename gotcha:** the helpers file was first named `calendarGrid.ts`, which collides with the `CalendarGrid.tsx` component on case-insensitive Windows/macOS filesystems (tsc errors) — renamed to `dates.ts`. **Reduced-motion** gates the drag-overlay spring; the grid otherwise relies on the global reduced-motion CSS.
- **2026-06-18** — **Card delete wired + working-tree corruption recovery (bugfix):** Cards couldn't be deleted. The data layer (`removeCard` in `api.ts` / `useDeleteCard` in `useBoard.ts`) has existed since Phase 4 but was **never surfaced in the UI** — `CardDetailModal` only had Cancel/Save and `Board` never imported `useDeleteCard`. Added a destructive **Delete** action to the modal footer (left of Cancel/Save) with an **inline confirm** step (no nested modal), following the column-delete convention (`accent="ember"` + `AlertTriangle`, `text-danger`). Wired `useDeleteCard` into `Board` via `handleDeleteCard` (delete → close modal) plus a new **`useRemoveCardExtras(projectId)`** helper in `useCardExtras.ts` that drops the deleted card's checklist items + label links from the `['card-extras']` cache, mirroring the DB's `on delete cascade`. Touched only `CardDetailModal.tsx`, `Board.tsx`, `useCardExtras.ts`. **Incident:** while verifying, `src/features/projects/ProjectPage.tsx` (760 NUL bytes on one line) and `src/types/database.ts` (truncated at line 113) were found **corrupted in the working tree but clean at HEAD** — restored both via `git show HEAD:<path> > <path>`. Cause looked like a flaky file mount (also broke `git status` with a bad `…0000` object and fed `tsc` shifting truncation errors); the fix was therefore verified by **direct file inspection** rather than a clean typecheck. **TODO on a stable machine: `git status`, `npm run typecheck && npm run build`, then live-test deleting a card.**
- **2026-06-18** — **Phase 5 Card details (usable MVP):** Three new tables. `labels` is project-scoped (gated on **`is_project_member(project_id)`** — the verbatim pattern); `checklist_items` and `card_labels` hang off a **card**, which carries `project_id` but the rows don't, so rather than have their policies sub-query `public.cards` (re-entering cards' RLS) they gate through a **new SECURITY DEFINER helper `can_access_card(card_id)`** that resolves the card's project once and reuses `is_project_member` — same hardening (`search_path=''`, schema-qualified) and same "keep policies flat" rationale as the Phase 3 helpers. **This is the pattern any future card-child table (comments, attachments) reuses.** Label **color is a name** (`violet`…`slate`) constrained by a CHECK, mapped to a hex in **`src/lib/labelColors.ts`** — mirrors how `projects.accent` is stored; keeps the DB decoupled from exact swatches. **State = one `['card-extras', projectId]` cache** ({labels, checklist, cardLabels}) parallel to `['board', id]`: the board reads it for card-face label pills + checklist progress, the modal reads + mutates the same snapshot (instant optimistic, unit rollback). New-label-then-attach uses **`mutateAsync` then attach with the real id** to avoid an FK race on the temp id. **Due date** is part of the card row, so it saves through the board cache (extended `useUpdateCard`/`updateCardDetail` to write `due_date`), not card-extras; urgency (`due.ts`) is overdue→danger / ≤2 days→warning / else neutral, "due this week" = next 7 days. **Filtering hides non-matching cards with `display:none`** (kept mounted in the SortableContext) instead of removing them, so drag `neighbourPosition` still reads the full ordered lists and never mis-positions relative to a hidden card. Checklist reorder is a **nested dnd-kit DndContext** (the modal is a sibling of, not inside, the board's DndContext, so no context clash), reusing `positionBetween`. `database.ts` hand-extended with the three tables + `can_access_card` + `ChecklistItem`/`Label`/`CardLabel` aliases.
- **2026-06-18** — **Phase 4 Kanban:** `columns`/`cards` are the first per-project content tables and reuse the Phase 3 pattern **verbatim** — RLS on every op gated by **`is_project_member(project_id)`**, so no new recursion-avoidance work. **Membership = full board access** for now; viewer-read-only and role limits arrive with collaboration (Phase 8). New projects get **To Do / In Progress / Done** via a `seed_project_columns()` SECURITY DEFINER `after insert` trigger (independent of `on_project_created`, so firing order is irrelevant); a one-time backfill seeds pre-existing projects. **Ordering = fractional `position`** (`double precision`): an item moved between two neighbours takes the **midpoint** of their positions, so a reorder writes **one row** and never collides — chosen over full reindex for cheap, trivially-optimistic moves. Float64 midpoints survive ~50 inserts into the *same* gap; a periodic rebalance is deferred to Phase 10. All position math lives in **`ordering.ts` + `Board.tsx`**; mutations take explicit positions and stay dumb. **State = one `['board', projectId]` TanStack cache** ({columns, cards}) so the DnD layer and every mutation read/patch one consistent snapshot (instant optimistic updates, unit rollback). **dnd-kit**: Mouse(distance 6) + Touch(delay 200/​tol 8) + Keyboard sensors (taps open a card, swipes scroll, long-press drags); `closestCorners`; cross-column card moves are previewed live in `onDragOver` (canonical multi-container pattern) while within-column + column reflow comes from applied sortable transforms; the lifted clone is a **`DragOverlay`** (scale/rotate via Framer spring). **Confetti** (`Confetti.tsx`, keyed-remount burst, no effect setState) fires only when a card *enters* a Done-type column (`isDoneColumn` name match), gated by reduced-motion. `database.ts` hand-extended with `columns`/`cards` + `Column`/`Card` aliases.
- **2026-06-18** — **Phase 3 RLS bugfix (found in live verification):** creating a project returned **403 / 0 rows**. Root cause: on `INSERT ... RETURNING`, Postgres applies the `projects` **SELECT** policy to the new row, but the creator's `owner` row in `project_members` (written by the `after insert` trigger) is **not yet visible** at that instant, so a membership-only SELECT policy failed the read-back and rolled the whole insert back. Fix: broadened the `projects` select policy to `using (owner_id = auth.uid() or is_project_member(id))` — the owner clause is true the moment the row exists, so RETURNING succeeds. Migration `20260618120000_projects.sql` patched + applied live. (Also: this project's Supabase uses the **legacy anon JWT** key, not the new `sb_publishable_` key, which was rejected as "Invalid API key".) **Later per-project tables that rely on the same create-then-return pattern should gate SELECT on the owning row's creator too, not membership alone.**
- **2026-06-18** — Phase 3 multi-tenant RLS: **membership is the unit of access.** A row is visible only to members of its project, checked via the **`is_project_member(project_id)`** SECURITY DEFINER helper; ownership-gated writes use a sibling **`is_project_owner(project_id)`** helper. Both are `security definer`/`set search_path = ''` so their bodies read the tables as the table owner (bypassing RLS), which is what **breaks the `project_members` self-recursion gotcha** (plan.md §6) — policies call the functions instead of sub-querying `project_members`. The creator is made an `owner` member by an `after insert` SECURITY DEFINER trigger (`handle_new_project()`), not client logic, so the trigger can insert the membership before the "owners-only" member policy would otherwise allow it. **This is the canonical pattern every later table (columns, cards, notes, …) reuses.** Accent stored as `text` with a CHECK to the six gradient names; typed as `AccentName` in `database.ts` (hand-maintained). Projects dashboard replaced the placeholder `Home`; project list/detail use TanStack Query with **optimistic** create/update/delete (temp `crypto.randomUUID()` swapped for the server row on success, rolled back on error).
- **2026-06-18** — Phase 2 auth: **session state lives in `AuthProvider`** (Supabase `getSession()` + `onAuthStateChange`; supabase-js handles persistence + token refresh). **Profile data is separate** — a TanStack Query (`useProfile`) shared by the nav `UserMenu` and the profile screen, so an edit updates both. `profiles` is protected by **own-row RLS** (`select`/`update`, `authenticated` role only); inserts happen solely via the **`handle_new_user()` SECURITY DEFINER trigger** (search_path pinned to `''`, all refs schema-qualified). Client route guards (`ProtectedRoute`/`PublicOnlyRoute`) are **UX only — RLS is the real protection** (plan.md §6). Added a **reset-password completion screen** (`/reset-password`) so the Forgot-Password flow actually works end-to-end. `src/types/database.ts` is **hand-maintained** to mirror the migration until regenerated via the Supabase CLI.
- **2026-06-18** — Phase 1 theming runs on **CSS variables** (channel triplets wired into Tailwind tokens) under `.dark`/`.light` on `<html>`; an inline bootstrap script in `index.html` sets the class pre-paint (no flash). Theme switch cross-fades via the **View Transitions API** (falls back to a CSS transition; disabled under reduced-motion). Added libs: **@fontsource-variable** (self-hosted fonts, PWA-friendly), **lucide-react** (icons), **clsx + tailwind-merge** (the `cn()` helper). Accent system lives in `src/lib/accents.ts` (the six gradients + `accentVars()`); components read `--accent-*` so any subtree can be re-accented.
- **2026-06-18** — Phase 0 used **Tailwind CSS v3** (mature `tailwind.config.ts` + `postcss.config.js` token workflow) rather than v4's CSS-first config, since Phase 1's design system (`plan.md` §4) is built around config tokens. Scaffold built **in place** (no subfolder); path alias `@/* → src/*`; PWA kept minimal (full manifest/offline in Phase 9).
- **2026-06-18** — Phase 1 now ends with a **live-deploy checkpoint** (verify the `*.pages.dev` URL on desktop + phone) to de-risk deployment early.
- **2026-06-18** — Design **elevated** per request: light + dark both first-class (persisted, cross-fade); animated **flowing gradients**, **3D tactile buttons** (raised, hover-lift, press), and **pointer-reactive card tilt**. Spec in `plan.md` §4.4; `prompts.html` demos it.
- **2026-06-18** — Web app delivered as **PWA** (one codebase, sync, sellable). 
- **2026-06-18** — Auth = **email/password + Google** (Supabase Auth).
- **2026-06-18** — Host = **Cloudflare Pages**; backend = **Supabase**. Avoid Vercel Hobby (bans commercial use).
- **2026-06-18** — **No Docker** — nothing self-hosted to containerize (`plan.md` §2).
- **2026-06-18** — Design = **Aurora**: animated gradients + glassmorphism + vivid per-project accents + spring motion.

*(Add new decisions on top as they happen.)*

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
├── prompt.md             ← build prompts per phase
├── prompts.html          ← interactive prompt tracker (open in browser)
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
│       └── 20260620120000_todos.sql        ← todo_lists + todo_items + owns_todo_list() helper + own-row RLS — 2026-06-20
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
    │   ├── forms/              ← Field (labeled input), TextArea (multiline sibling)
    │   ├── feedback/           ← Spinner, Skeleton
    │   ├── motion/             ← Reveal wrapper
    │   ├── theme/              ← ThemeProvider, theme-context, ThemeToggle
    │   └── shell/              ← AppShell, Sidebar, SidebarNav, Topbar, BottomNav, Brand, navItems
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
    │       ├── ProjectsPage.tsx    ← dashboard (index route): grid of cards, empty/loading/error states
    │       ├── ProjectCard.tsx     ← vivid Aurora glass card, stretched link, owner edit/delete actions
    │       ├── ProjectFormModal.tsx← create/edit modal (key-remount re-seeds; no reset effect)
    │       ├── AccentPicker.tsx    ← six-gradient radiogroup picker
    │       ├── DeleteProjectDialog.tsx ← owner-only delete confirmation
    │       └── ProjectPage.tsx     ← /projects/:id route (accent-themed header + <Board>)
    │   └── board/             ← Phase 4 Kanban + Phase 5 card-details feature module
    │       ├── index.ts            ← barrel (Board)
    │       ├── ordering.ts         ← fractional position helpers (positionBetween/neighbour) + isDoneColumn
    │       ├── due.ts              ← due-date urgency status/label helpers (date-fns) — Phase 5
    │       ├── schemas.ts          ← Zod column-name / card / checklist-text / label-name schemas
    │       ├── api.ts              ← board Supabase data layer (fetchBoard + column/card CRUD + moves; updateCardDetail writes due_date)
    │       ├── cardExtras.api.ts   ← Phase 5 data layer (labels / checklist_items / card_labels; RLS-governed)
    │       ├── useBoard.ts         ← TanStack hooks on one ['board', id] cache; optimistic add/rename/delete/move (incl. due_date)
    │       ├── useCardExtras.ts    ← TanStack hooks on one ['card-extras', id] cache; optimistic label/checklist/attach ops
    │       ├── Board.tsx           ← DndContext orchestrator (sensors, drag handlers, DragOverlay, confetti, toolbar, filtering, modals)
    │       ├── BoardToolbar.tsx    ← Phase 5 filter/search bar (title search + due chips + label chips)
    │       ├── BoardColumn.tsx     ← sortable column: grip, inline rename, delete, card list, quick-add composer
    │       ├── BoardCard.tsx       ← sortable card wrapper; passes face (labels + checklist) + hidden
    │       ├── CardSurface.tsx     ← presentational glass card: priority pill, label swatches, urgency due pill, checklist tally (also DragOverlay clone)
    │       ├── LabelPill.tsx       ← presentational colored label pill (card face / modal / filter)
    │       ├── CardDetailModal.tsx ← edit title/description/due-date + Priority + Labels + Checklist sections
    │       ├── DueDateField.tsx    ← native date picker, on-brand, with clear + urgency hint
    │       ├── PriorityField.tsx   ← priority picker: P1–P10 chips + "Higher…" custom — 2026-06-20
    │       ├── CardLabelsSection.tsx ← attach/detach labels + inline create/delete (swatch picker)
    │       ├── Checklist.tsx       ← progress bar + reorderable list (nested dnd-kit) + add composer
    │       ├── ChecklistItemRow.tsx ← one to-do: grip, tick box, click-to-edit text, delete
    │       ├── DeleteColumnDialog.tsx ← confirm column (+ its cards) delete
    │       ├── AddColumn.tsx       ← trailing add-column composer
    │       └── Confetti.tsx        ← reduced-motion-aware celebration burst
    │   └── calendar/          ← Phase 6 Calendar view feature module
    │       ├── index.ts            ← barrel (CalendarPage)
    │       ├── api.ts              ← fetchDatedCards (all dated cards, RLS-scoped) + updateCardDueDate
    │       ├── useCalendar.ts      ← ['calendar-cards'] query + reschedule/update/delete (cross-cache optimistic: calendar + board + card-extras)
    │       ├── dates.ts            ← date-fns helpers (month/week day arrays, toDateKey, periodLabel, groupCardsByDate)
    │       ├── CalendarPage.tsx    ← DndContext orchestrator: view/scope/cursor state, grid↔agenda, card + day-overflow modals
    │       ├── CalendarToolbar.tsx ← title + period, month/week toggle, prev/today/next, project scope select
    │       ├── CalendarGrid.tsx    ← 7-col day grid (desktop/tablet; month + week variants)
    │       ├── DayCell.tsx         ← droppable day: accent today-pill, chips, "+N more" overflow
    │       ├── CardChip.tsx        ← presentational accent/urgency chip + DraggableCardChip (dnd-kit) wrapper
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
    ├── hooks/
    │   ├── useTheme.ts         ← theme context hook
    │   ├── useAuth.ts          ← auth context hook
    │   └── useMediaQuery.ts    ← subscribe to a CSS media query (Calendar grid↔agenda switch) — Phase 6
    ├── lib/
    │   ├── supabase.ts         ← typed Supabase client (reads VITE_ env, throws if missing)
    │   ├── accents.ts          ← six accent gradients + accentVars()
    │   ├── labelColors.ts      ← label palette (8 named colors → hex) + withAlpha() — Phase 5
    │   ├── priority.ts         ← open-ended task priority: format + tier→color (P1+) — 2026-06-20
    │   ├── cn.ts               ← clsx + tailwind-merge helper
    │   ├── motion.ts           ← spring presets + variants
    │   └── theme.ts            ← theme storage/apply logic
    ├── pages/                  ← StyleGuide, Placeholder
    ├── styles/
    │   └── index.css           ← Aurora tokens (both themes), glass/button/gradient utilities, blobs, reduced-motion
    └── types/
        ├── database.ts         ← Supabase DB types (`profiles`, `projects`, `project_members`, `columns`, `cards` [+`priority`], `checklist_items`, `labels`, `card_labels`, `todo_lists`, `todo_items` + RLS fn signatures incl. `can_access_card`, `owns_todo_list`; hand-maintained until CLI regen) + `Profile`/`Project`/`ProjectMember`/`ProjectRole`/`Column`/`Card`/`ChecklistItem`/`Label`/`CardLabel`/`TodoList`/`TodoItem` aliases
        ├── fontsource.d.ts     ← module decls for @fontsource CSS imports
        └── view-transitions.d.ts ← optional startViewTransition typing
```

---

## ⚠️ Open items / known issues

- **Visual eyeball still pending.** The build/typecheck/lint pass and routes serve 200, but the design was not viewed in a browser this session (no GUI here). Run `npm run dev` and open `/style-guide` to confirm both themes, the 3D buttons, card tilt, and flowing gradients look right before building features on top (per `prompt.md` Phase 1 verification).
- **Connect Cloudflare Pages** (SETUP.md §3) — build command `npm run build`, output `dist`, plus the two `VITE_` env vars. Then do the Phase 1 live-deploy checkpoint (open the `*.pages.dev` URL on desktop + phone).
- **Supabase keys:** local `.env` still holds placeholders — set real values (Settings → API) before auth can talk to the project.
- **Apply the Phase 2 migration & configure Auth (one-time, dashboard).** Run `supabase/migrations/20260618093000_profiles.sql` (SQL Editor or `supabase db push`), then enable **Email** + **Google** providers and add **redirect URLs** (localhost + `*.pages.dev`) — steps in [supabase/README.md](./supabase/README.md). Until done, the auth screens render but sign-in calls will fail.
- **Phase 2 live verification still pending** (needs real keys + a browser): sign-up auto-creates a `profiles` row, login persists across refresh, Google OAuth round-trip, protected-route redirect, and confirming you can't read another user's profile via SQL (RLS). See prompt.md → Phase 2 Verification.
- **Apply the Phase 3 migration (one-time, dashboard).** Run `supabase/migrations/20260618120000_projects.sql` (SQL Editor or `supabase db push`) after the profiles one. No new dashboard config needed beyond Phase 2.
- **Phase 3 live verification — partially done (2026-06-18).** Real keys now in `.env`, both migrations applied live, Email provider on. Confirmed: sign-in works, profile row auto-created, session persists on reload, and **creating a project now works** (after the 403/RETURNING-policy bugfix above) — shows with the Owner badge. **Still pending: the two-user RLS checks** — with two test users confirm: creating a project auto-adds the creator as an `owner` member; a non-member sees nothing (`select * from projects` returns only their own); a non-owner member can read but not update/delete; only the owner can add/remove members; and crucially that selecting/inserting on `project_members` raises **no** "infinite recursion detected in policy" error. Then eyeball the dashboard — card accents, create/edit/delete, optimistic updates, the accent picker, and the per-project route — in a browser (both themes).
- **Apply the Phase 4 migration (one-time, dashboard).** Run `supabase/migrations/20260618140000_kanban.sql` after the earlier two (SQL Editor or `supabase db push`). No new dashboard config. It also **backfills default columns** into any project created before Phase 4, so existing boards appear immediately.
- **Phase 4 live verification still pending** (needs a browser): open a project → board shows To Do/In Progress/Done; add/rename/delete a column; quick-add cards; open a card and edit title/description (persists + optimistic); drag a card within a column, across columns, and reorder columns (smooth on mouse **and** touch, persists on reload); dropping a card into **Done** fires confetti (and respects reduced-motion); confirm a non-member still can't read another project's columns/cards (RLS) and that no `project_members` recursion error appears.
- **Apply the Phase 5 migration (one-time, dashboard).** Run `supabase/migrations/20260618160000_card_details.sql` after the earlier three (SQL Editor or `supabase db push`). No new dashboard config. It adds `checklist_items` + `labels` + `card_labels`, the `can_access_card()` helper, and their RLS.
- **Phase 5 live verification still pending** (needs a browser): open a card → add checklist items, tick them, watch the progress bar + the card-face "3/5" update, reorder items, reload persists; set a due date → the card pill shows the right urgency color (test overdue vs. due-soon vs. future) and clearing it works; create labels with colors, attach/detach → pills show on the card face; use the toolbar to filter by a label and by Overdue / Due-this-week, and search by title; confirm a second account still can't read this project's checklist_items/labels/card_labels (RLS) and no recursion error appears.
- **Phase 6 live verification still pending** (needs a browser): open **Calendar** from the nav → cards with due dates land on the correct days; toggle **Month / Week** and use prev/today/next; switch the **project scope** (All projects ↔ one project) and confirm chips filter + retint; **drag a chip to another day** and confirm the due date changes, persists on reload, and is already moved when you open that project's board; a day with many cards shows **"+N more"** opening the day popover; **click a chip** → the full Phase 5 card modal opens (edit/delete works and reflects back on the calendar); shrink to a phone width → the **agenda list** appears and tapping a chip still opens the card. No new migration for this phase.
- **2026-06-20 migrations.** `20260620100000_card_priority.sql` applied live ✓. **`20260620120000_todos.sql` — apply before using the To-Do tab** (adds `todo_lists` + `todo_items` + `owns_todo_list()` + own-row RLS; idempotent).
- **2026-06-20 batch verification (browser):** checklist/label **add no longer reloads** the card; 3D buttons visibly lift on hover / press on click; set a card **priority** (P1 / P2 / a custom P11+) → tier-colored `P#` pill shows on the card face and persists on reload; **To-Do** tab → add several named lists for a day (Personal/Work), add/tick/delete items, navigate days, and confirm a **second account can't see your lists** (own-row RLS).
- **Bundle size:** the single JS chunk is now ~880 kB (258 kB gzip) — still a build warning, not an error. Code-splitting is a Phase 10 polish item.
- (Log bugs, blockers, and TODOs here as they appear, with enough detail to resume cold.)

---

## ▶️ Next step (do this next)

Open `prompt.md` (or `prompts.html`) → **Phase 7 — Notes/docs per project**: a `notes` table (id, project_id, title, content, updated_at, created_at) with RLS gated by membership, plus a per-project Notes tab — list/create/rename/delete notes, a clean markdown-textarea editor with live preview, and **debounced autosave** (don't thrash the DB) with a subtle "saved" indicator. Reuse the existing optimistic-cache + Zod + glass patterns; keep it responsive.

Migrations through Phase 5 are applied live; the **2026-06-20** `card_priority` migration too. **Still to apply: `20260620120000_todos.sql`** (for the To-Do tab). Then run the **Phase 4–6 + 2026-06-20-batch live verifications** in the open-items list above (board CRUD + drag-and-drop; checklists/due-dates/labels/**priority**; toolbar filtering/search; calendar month/week/scope/drag-reschedule; the **To-Do** tab; RLS isolation against a second account). Earlier one-time setup (real `.env` keys, profiles + projects migrations, Email/Google providers) is done. **Also push `main` to origin** — it's ahead by Phase 6 + the 2026-06-20 batch.
