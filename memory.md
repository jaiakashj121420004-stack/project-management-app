# memory.md — Current State

> **The living memory of this project.** Read this first every session to know where things stand. **Update it after every meaningful change, then commit to git** (see [CLAUDE.md](./CLAUDE.md)). For the full spec see [plan.md](./plan.md); for build steps see [prompt.md](./prompt.md).
>
> Keep this file lean: it tracks *state*, not specification. Don't paste design or architecture here — link to `plan.md`.

---

## 📍 Status

- **Phase:** Phase 4 (Kanban board) — **done.** `columns` + `cards` migration (RLS gated on `is_project_member(project_id)`, a SECURITY DEFINER trigger seeds To Do/In Progress/Done on every new project + a backfill for existing ones). A full board UI under `src/features/board`: horizontally-scrollable accent-themed columns (add / inline-rename / delete), quick-add cards, a card detail modal (title + description, with a placeholder section reserved for Phase 5), dnd-kit drag-and-drop (reorder cards within & across columns, reorder columns) with a DragOverlay lift + spring overlay, fractional `position` ordering (no collisions), optimistic TanStack updates on one `['board', id]` cache, and a confetti burst when a card lands in a "Done"-type column. All motion gated behind reduced-motion. typecheck/lint/build clean.
- **Next step:** Run **Phase 5 (Card details — checklists, due dates, labels)** from [prompt.md](./prompt.md) / `prompts.html`. First (one-time) apply the Phase 4 migration (`20260618140000_kanban.sql`) after the earlier two — no new dashboard config needed — then do the Phase 4 live verification (below).
- **Repo:** github.com/jaiakashj121420004-stack/project-management-app *(main pushed; in sync)*
- **Environment:** GitHub · Supabase · Cloudflare · Node.js — ready ✅ (see [SETUP.md](./SETUP.md))
- **App is deployable:** ✅ `npm run build` produces `dist/` (full design system + app shell + /style-guide). Cloudflare Pages not yet connected.
- **Last updated:** 2026-06-18.

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
- [ ] Phase 5 — Card details (to-dos, due dates, labels)
- [ ] Phase 6 — Calendar view
- [ ] Phase 7 — Notes/docs
- [ ] Phase 8 — Collaboration
- [ ] Phase 9 — PWA & reminders
- [ ] Phase 10 — Polish & launch

---

## 🧠 Decision log

> One line per decision. Full reasoning lives in `plan.md`.

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
│       └── 20260618140000_kanban.sql    ← columns + cards + member-gated RLS + seed-default-columns trigger + backfill
└── src/
    ├── App.tsx                 ← routes (AppShell layout → Home / Calendar / Notes / StyleGuide)
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
    │   └── board/             ← Phase 4 Kanban feature module
    │       ├── index.ts            ← barrel (Board)
    │       ├── ordering.ts         ← fractional position helpers (positionBetween/neighbour) + isDoneColumn
    │       ├── schemas.ts          ← Zod column-name / card title+description schemas
    │       ├── api.ts              ← Supabase data layer (fetchBoard + column/card CRUD + moves; RLS-governed)
    │       ├── useBoard.ts         ← TanStack hooks on one ['board', id] cache; optimistic add/rename/delete/move
    │       ├── Board.tsx           ← DndContext orchestrator (sensors, drag handlers, DragOverlay, confetti, modals)
    │       ├── BoardColumn.tsx     ← sortable column: grip, inline rename, delete, card list, quick-add composer
    │       ├── BoardCard.tsx       ← sortable card wrapper (useSortable)
    │       ├── CardSurface.tsx     ← presentational glass card w/ accent glow (also the DragOverlay clone)
    │       ├── CardDetailModal.tsx ← edit title+description; placeholder section reserved for Phase 5
    │       ├── DeleteColumnDialog.tsx ← confirm column (+ its cards) delete
    │       ├── AddColumn.tsx       ← trailing add-column composer
    │       └── Confetti.tsx        ← reduced-motion-aware celebration burst
    ├── hooks/
    │   ├── useTheme.ts         ← theme context hook
    │   └── useAuth.ts          ← auth context hook
    ├── lib/
    │   ├── supabase.ts         ← typed Supabase client (reads VITE_ env, throws if missing)
    │   ├── accents.ts          ← six accent gradients + accentVars()
    │   ├── cn.ts               ← clsx + tailwind-merge helper
    │   ├── motion.ts           ← spring presets + variants
    │   └── theme.ts            ← theme storage/apply logic
    ├── pages/                  ← StyleGuide, Placeholder
    ├── styles/
    │   └── index.css           ← Aurora tokens (both themes), glass/button/gradient utilities, blobs, reduced-motion
    └── types/
        ├── database.ts         ← Supabase DB types (`profiles`, `projects`, `project_members`, `columns`, `cards` + RLS fn signatures; hand-maintained until CLI regen) + `Profile`/`Project`/`ProjectMember`/`ProjectRole`/`Column`/`Card` aliases
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
- **Bundle size:** the single JS chunk is now ~819 kB (243 kB gzip) — grew with dnd-kit; still a build warning, not an error. Code-splitting is a Phase 10 polish item.
- (Log bugs, blockers, and TODOs here as they appear, with enough detail to resume cold.)

---

## ▶️ Next step (do this next)

Open `prompt.md` (or `prompts.html`) → **Phase 5 — Card details** (checklists / to-dos, due dates, labels). The `cards` table already has nullable `due_date` + `assignee_id`; Phase 5 adds `checklist_items`, `labels` + `card_labels` (all member-gated on `is_project_member(project_id)` — the same Phase 3/4 pattern) and fills the placeholder section already left in `CardDetailModal`.

Before that, apply the **Phase 4 migration** (`20260618140000_kanban.sql`) in the Supabase dashboard, then run the **Phase 4 live verification** in the open-items list above (board renders default columns, column/card CRUD, drag-and-drop on mouse + touch persists on reload, confetti on Done, RLS isolation). The earlier one-time setup (real `.env` keys, profiles + projects migrations, Email/Google providers) is already done.
