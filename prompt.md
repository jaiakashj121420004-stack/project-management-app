# prompt.md — Build Playbook (copy-paste prompts for Claude Code)

> Ordered prompts for building the **Aurora** project-management app. Work top to bottom. For each phase: meet the **Prerequisites**, switch Claude Code to the **Model**, paste the **Prompt**, then run the **Verification** before moving on.
>
> Prefer the interactive checklist? Open **`prompts.html`** in your browser — same content with checkboxes, copy buttons, and progress tracking.
>
> **Model guide:** **Opus 4.8** = architecture, security, and the design system (high stakes). **Sonnet 4.6** = standard feature build-out (fast + capable). **Haiku 4.5** = tiny mechanical tweaks. Every prompt already tells Claude Code to read `CLAUDE.md`, `plan.md`, and `memory.md` first so it has full context, and to update `memory.md` + commit when done.

---

## Phase 0 — Setup & infra

**Prerequisites**
- Node.js, Git, and accounts for GitHub, Supabase, Cloudflare. ✅ done
- Repo: `https://github.com/jaiakashj121420004-stack/project-management-app`
- Have your Supabase **Project URL** + **anon public key** ready (Settings → API). See **[SETUP.md](./SETUP.md)** for exactly where they go — keep them out of chat/git.

**Model:** 🟣 **Opus 4.8** — getting the foundation, secrets handling, and deploy pipeline right pays off for the whole project.

**Prompt**
```text
Read CLAUDE.md, plan.md, and memory.md fully before doing anything.

Scaffold the foundation of the Aurora project-management app in this repo.

1. Initialize a Vite + React + TypeScript project IN PLACE (do not nest it in a subfolder; keep the existing .md files at the repo root). Enable TypeScript strict mode.
2. Install and configure: Tailwind CSS, Framer Motion, dnd-kit, @tanstack/react-query, react-router-dom, @supabase/supabase-js, zod, date-fns, and vite-plugin-pwa. Wire Tailwind and PostCSS correctly.
3. Create a typed Supabase client in src/lib/supabase.ts that reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from import.meta.env. Add a .env.example documenting these vars. Create a real .env locally but DO NOT commit it.
4. Add a .gitignore covering node_modules, dist, .env, .env.local, and OS/editor cruft. Confirm no secrets are tracked.
5. Set up a clean folder structure: src/components, src/features, src/lib, src/hooks, src/pages, src/types, src/styles. Add a placeholder App that renders a simple "Aurora — coming soon" screen so the build works.
6. Add npm scripts for dev, build, preview, typecheck, and lint. Set up ESLint + Prettier with sensible TypeScript rules.
7. Initialize git, make a clean initial commit of the scaffold, then connect and push to the existing GitHub repo:
   git branch -M main
   git remote add origin https://github.com/jaiakashj121420004-stack/project-management-app.git
   git push -u origin main
   (If git asks for identity, set user.email and user.name first. Confirm .env is NOT tracked.)
8. Write a short README section (or docs note) on how to run locally and how to deploy to Cloudflare Pages (build command: npm run build, output dir: dist, plus the two VITE_ env vars in the Cloudflare dashboard).

Constraints: TypeScript strict, no `any`, no leftover boilerplate clutter. Keep components small.

When finished: update memory.md (mark Phase 0 done, set next step to Phase 1, update the file tree) and commit everything with a Conventional Commit message.
```

**Verification**
- `npm run dev` starts and the "coming soon" screen loads with no console errors.
- `npm run build` succeeds and produces `dist/`.
- `npm run typecheck` passes.
- `git status` is clean; `.env` is **not** tracked (`git ls-files | grep .env` shows only `.env.example`).
- (Optional now) connect the repo to Cloudflare Pages and confirm a successful deploy.

---

## Phase 1 — Design system & app shell

**Prerequisites**
- Phase 0 complete and committed.

**Model:** 🟣 **Opus 4.8** — this phase is the "jaw-dropping" foundation. Worth the strongest model.

**Prompt**
```text
Read CLAUDE.md, plan.md (especially section 4, the Aurora Design System — note 4.4 on depth, 3D & motion), and memory.md first.

Build the Aurora design system and the app shell. This is the visual foundation — it must look stunning, colorful, premium, animated, and three-dimensional, never a plain flat or dark-blue app.

1. Theme: set up Tailwind theme tokens + CSS variables for the full Aurora palette from plan.md (the six project accent gradients, dark/light base colors, glass surface values, semantic colors). Implement BOTH a luminous light mode AND a rich dark mode as first-class, with a ThemeToggle that persists the choice and cross-fades smoothly between them. Default to dark. Design and test every component in both themes.
2. Fonts: load Space Grotesk (or Sora) for display/headings and Inter for body, via a performant method. Set up a generous type scale.
3. Animated AuroraBackground: 3–4 large, softly blurred gradient "blobs" that continuously drift AND parallax subtly toward the pointer. Rich but not distracting. Honor prefers-reduced-motion.
4. Animated, flowing gradients: headings, primary buttons, and active states animate their gradient position (a slow "liquid" shimmer on a ~200% gradient, or a rotating conic gradient). Add a reusable animated gradient-border utility for key surfaces.
5. Core reusable components (in src/components), all typed, with full hover/focus/active states, working in BOTH themes:
   - GlassPanel and GlassCard — frosted translucent surfaces, blur, luminous border, layered shadow + accent glow. GlassCard has pointer-reactive 3D tilt (rotateX/rotateY following the cursor) with a shadow that shifts as it tilts.
   - GradientButton — looks raised and tactile: top inner highlight + layered drop shadows + accent glow + glossy animated gradient. Hover lifts it (translateY up, bigger shadow/glow); active presses it down (translateY, slight scale-down, smaller shadow). Include ghost/secondary variants.
   - Field/Input, Badge/Pill, Avatar, Modal/Sheet (spring-animated with Framer Motion), Spinner/Skeleton.
   - A motion wrapper utility for consistent spring transitions.
6. App shell layout: responsive sidebar/nav (collapsible on mobile, becomes a bottom bar or drawer), a top bar, and a main content area — all on glass over the aurora background. Must look great on phone AND desktop.
7. Build a /style-guide route that showcases every component, BOTH themes (with the toggle), all six accent gradients, the 3D buttons, the tilt cards, and the flowing gradients — so we can eyeball the system.
8. Make it deploy-ready: ensure `npm run build` is clean (no type or console errors), then commit and push to main so Cloudflare Pages builds it. Confirm the two VITE_ env vars are set in Cloudflare (SETUP.md §3).

Constraints: honor plan.md section 4 (especially 4.4) exactly. Depth and motion are defining features: flowing gradients, 3D tactile buttons, card tilt, layered shadows/glows. Both light and dark must be first-class. Every interactive element has hover/focus/active states. Fully responsive and touch-friendly. Gate heavy motion (tilt, parallax, flowing gradients) behind prefers-reduced-motion.

When finished: update memory.md (Phase 1 done, next step Phase 2, note the components created), commit, and push.
```

**Verification**
- Visit `/style-guide`: components render in **both** light and dark; the theme toggle persists and cross-fades; all six accent gradients display; glass + blur look correct.
- Gradients visibly **flow/animate** on headings and primary buttons.
- Buttons feel **3D**: they lift on hover and press down on click. Cards **tilt toward the cursor** with a shifting shadow.
- The aurora background drifts and parallaxes; toggling reduced-motion calms all of it.
- Resize to a phone width — layout adapts, nav is usable by touch.
- It genuinely looks impressive in both themes. If it looks generic, push back and iterate before moving on.
- **🚀 Deploy checkpoint (do this now):** if Cloudflare Pages isn't connected yet, connect it (SETUP.md §3). After your push, open the live `*.pages.dev` URL on your **computer and your actual phone** — both themes render, the aurora animates, and there are no console errors. This confirms your deploy pipeline works before you build features on top of it.

---

## Phase 2 — Auth (email/password + Google)

**Prerequisites**
- Phase 1 complete. In Supabase: enable Email and Google providers (Auth → Providers); add your Google OAuth credentials; set Site URL + redirect URLs for localhost and your Cloudflare domain.

**Model:** 🟣 **Opus 4.8** — authentication is security-critical; get it correct.

**Prompt**
```text
Read CLAUDE.md, plan.md (sections 5–6), and memory.md first.

Implement authentication using Supabase Auth.

1. SQL migration: create a `profiles` table (id references auth.users, display_name, avatar_url, created_at). Add a trigger that inserts a profile row automatically when a new auth user is created. Enable Row Level Security: a user may select/update only their own profile. Save migrations under supabase/migrations.
2. Beautiful Aurora-styled auth screens (using Phase 1 components): Sign Up, Log In, and Forgot Password — plus a "Continue with Google" button. Validate all inputs with Zod and show friendly inline errors.
3. Auth state: a useAuth hook / context exposing the current session and user, with loading states. Handle session persistence and refresh.
4. Routing: a ProtectedRoute wrapper. Unauthenticated users are redirected to login; authenticated users landing on auth pages go to the app. Add a Sign Out action in the nav with the user's avatar/name.
5. A minimal profile screen to edit display name (avatar upload can wait).

Constraints: never expose the service_role key. Rely on RLS, not client checks, for data protection. Treat all input as untrusted. Keep the screens on-brand (Aurora).

When finished: update memory.md (Phase 2 done, decisions if any, next step Phase 3) and commit, including the SQL migration.
```

**Verification**
- Sign up with email → a `profiles` row is auto-created (check Supabase table editor).
- Log out / log in works; refreshing the page keeps you logged in.
- "Continue with Google" completes the OAuth round-trip and logs you in.
- Visiting a protected route while logged out redirects to login.
- In SQL editor, confirm you cannot read another user's profile row (RLS enforced).

---

## Phase 3 — Projects (workspaces) + RLS

**Prerequisites**
- Phase 2 complete.

**Model:** 🟣 **Opus 4.8** — this establishes the multi-tenant RLS pattern every later table reuses. Critical to get right.

**Prompt**
```text
Read CLAUDE.md, plan.md (sections 5–6), and memory.md first.

Implement Projects (workspaces) with correct multi-tenant security.

1. SQL migration: create `projects` (id, owner_id, name, description, accent, created_at) and `project_members` (project_id, user_id, role in 'owner'|'editor'|'viewer', created_at; PK on project_id+user_id). When a project is created, the creator is inserted as an 'owner' member.
2. Create a SECURITY DEFINER function is_project_member(p_project_id uuid) that returns whether auth.uid() is a member — to avoid RLS recursion on project_members. Document why.
3. Enable RLS:
   - projects: a user can SELECT a project if is_project_member(id); INSERT if owner_id = auth.uid(); UPDATE/DELETE only if they're the owner.
   - project_members: a user can SELECT rows for projects they belong to; only owners can INSERT/DELETE members.
   Test that these policies do not recurse or error.
4. Frontend: a Projects dashboard listing the user's projects as vivid Aurora glass cards, each showing its accent gradient. "New Project" modal with name, description, and an accent-gradient picker (the six options from plan.md). Edit and delete (owner only).
5. Use TanStack Query for fetching/caching with optimistic create/update/delete. Validate with Zod.
6. Clicking a project opens a project route (board comes in Phase 4 — a placeholder is fine).

Constraints: all access governed by RLS, not client logic. Keep components small and typed. On-brand visuals.

When finished: update memory.md (Phase 3 done, note the RLS pattern + is_project_member helper as a decision, next step Phase 4) and commit with the migration.
```

**Verification**
- Create, rename, recolor, and delete a project from the UI; changes persist after refresh.
- With a second test account, confirm you **cannot** see the first account's projects (RLS works).
- No infinite-recursion errors from `project_members` policies.
- Accent gradients render per project.

---

## Phase 4 — Kanban board

**Prerequisites**
- Phase 3 complete.

**Model:** 🔵 **Sonnet 4.6** — standard feature build. (Switch to Opus if drag-and-drop ordering gets tricky.)

**Prompt**
```text
Read CLAUDE.md, plan.md, and memory.md first.

Build the Kanban board for a project.

1. SQL migration: `columns` (id, project_id, name, position, created_at) and `cards` (id, project_id, column_id, title, description, due_date nullable, assignee_id nullable, position, created_at). Enable RLS gating both by is_project_member(project_id). Seed a new project with default columns (To Do, In Progress, Done).
2. Board UI: columns laid out horizontally (scrollable on mobile), each a GlassPanel; cards are GlassCards carrying the project accent glow. Add column, rename column, delete column.
3. Cards: quick-add a card to a column; click a card to open a detail modal (title + description editable now; checklists/due dates arrive in Phase 5 — leave room).
4. Drag-and-drop with dnd-kit: reorder cards within a column and move cards between columns; reorder columns. Persist `position` (use a fractional or reindex strategy that avoids collisions). Use Framer Motion so cards lift/scale while dragging and columns reflow with spring physics.
5. Add a small celebration animation (e.g., a confetti burst) when a card is dropped into a "Done"-type column.
6. Optimistic updates via TanStack Query so the board feels instant.

Constraints: smooth on touch and mouse. Honor reduced-motion. Keep ordering logic robust and typed.

When finished: update memory.md (Phase 4 done, next step Phase 5) and commit with the migration.
```

**Verification**
- Add/rename/delete columns and cards; everything persists after refresh.
- Drag cards within and across columns, and reorder columns — order persists correctly.
- Dragging feels smooth on both desktop and a phone/touch device.
- Dropping into Done triggers the celebration; reduced-motion users don't get jarring effects.

---

## Phase 5 — Card details: to-dos, due dates, labels

**Prerequisites**
- Phase 4 complete. *(After this phase you have a genuinely usable MVP.)*

**Model:** 🔵 **Sonnet 4.6**

**Prompt**
```text
Read CLAUDE.md, plan.md, and memory.md first.

Enrich cards with to-do checklists, due dates, and labels.

1. SQL migration: `checklist_items` (id, card_id, text, is_done, position), `labels` (id, project_id, name, color), `card_labels` (card_id, label_id, PK both). RLS on all three gated via the parent project's membership.
2. Card detail modal: 
   - Checklist (the "to-do list" inside a card): add/edit/delete/reorder items, tick them off, with a progress bar (e.g., 3/5). 
   - Due date picker (date-fns). On the card face, show a due-date pill colored by urgency: neutral (future), warning (due soon), danger (overdue).
   - Labels: create project labels with colors, attach/detach them to cards, show as pills on the card face.
3. Board filtering/sorting: filter cards by label and by due status (overdue / due this week); a quick search by title.
4. Keep everything optimistic and on-brand.

Constraints: typed, validated (Zod), responsive, small components.

When finished: update memory.md (Phase 5 done — note "usable MVP reached", next step Phase 6) and commit with the migration.
```

**Verification**
- Add checklist items to a card, tick them, see the progress bar update; reload persists state.
- Set a due date; the card pill shows the right urgency color (test overdue vs. future).
- Create labels, attach to cards, filter the board by a label and by due status.
- Second account still can't access this project's cards (RLS).

---

## Phase 6 — Calendar view

**Prerequisites**
- Phase 5 complete.

**Model:** 🔵 **Sonnet 4.6**

**Prompt**
```text
Read CLAUDE.md, plan.md, and memory.md first.

Add a Calendar view of dated work.

1. A calendar (month and week toggle) rendering every card that has a due_date, across the current project (and optionally an "all projects" mode). Use date-fns for date math — no heavy calendar dependency unless clearly justified.
2. Cards appear on their due date as compact chips tinted by project accent / urgency. Click a chip to open the same card detail modal from Phase 5.
3. Allow drag-to-reschedule: dragging a card chip to another day updates its due_date (optimistic). Use Framer Motion for smooth movement.
4. Empty days and overflow ("+3 more") handled gracefully. Fully responsive: month grid on desktop, a sensible agenda/list layout on small phones.

Constraints: on-brand Aurora styling, reduced-motion safe, typed.

When finished: update memory.md (Phase 6 done, next step Phase 7) and commit.
```

**Verification**
- Cards with due dates appear on the correct calendar days.
- Switching month/week works; mobile shows a usable layout.
- Dragging a card to a new day changes its due date and persists.
- Clicking a chip opens the full card modal.

---

## Phase 7 — Notes / docs per project

**Prerequisites**
- Phase 6 complete.

**Model:** 🔵 **Sonnet 4.6** (a simple polish pass here could even use Haiku 4.5).

**Prompt**
```text
Read CLAUDE.md, plan.md, and memory.md first.

Add per-project Notes/docs.

1. SQL migration: `notes` (id, project_id, title, content, updated_at, created_at). RLS gated by project membership.
2. A Notes tab inside a project: list notes, create/rename/delete, and edit content. Use a clean, pleasant editor — markdown textarea with live preview is fine (avoid a heavy rich-text dependency unless justified). Autosave with a debounced update and a subtle "saved" indicator.
3. Notes list and editor styled on-brand (glass, readable typography, generous spacing).

Constraints: typed, validated, responsive, autosave must not thrash the database (debounce).

When finished: update memory.md (Phase 7 done, next step Phase 8) and commit with the migration.
```

**Verification**
- Create, edit, rename, and delete notes; content persists after refresh.
- Autosave fires on a sensible debounce (watch the network tab — not on every keystroke).
- Markdown preview renders; layout is readable on mobile.
- RLS confirmed against a second account.

---

## Phase 8 — Collaboration (members, roles, realtime)

**Prerequisites**
- Phase 7 complete.

**Model:** 🟣 **Opus 4.8** — sharing + roles + realtime touches security and concurrency. Use the strongest model.

**Prompt**
```text
Read CLAUDE.md, plan.md (sections 5–6), and memory.md first.

Add real-time collaboration.

1. Invitations: let a project owner invite a user by email to a project with a role (editor/viewer). Implement cleanly — e.g., an invitations table keyed by email that resolves to a project_members row when that user signs up / accepts. Update RLS so owners manage members and roles; editors can modify board content; viewers are read-only. Enforce role permissions in RLS, not just the UI.
2. Members UI: a project members panel showing avatars, roles, invite, change-role, and remove (owner only).
3. Realtime: subscribe to Supabase Realtime for the active project's columns, cards, checklist_items, labels, and notes so changes from other members appear live without refresh. Reconcile realtime events with TanStack Query caches without flicker or duplicates.
4. Presence (nice-to-have): show avatars of members currently viewing the board.

Constraints: roles enforced at the database layer (RLS). Realtime must be conflict-tolerant and not leak data across projects. Keep it on-brand.

When finished: update memory.md (Phase 8 done — note the invitations/roles design as a decision, next step Phase 9) and commit with the migration.
```

**Verification**
- Invite a second account as editor; it gains access; as viewer it cannot edit (verified even via direct API, not just UI).
- Open the board in two browsers/accounts — a change in one appears live in the other.
- Removing a member revokes access immediately.
- No cross-project data leakage in realtime channels.

---

## Phase 9 — PWA & reminders

**Prerequisites**
- Phase 8 complete.

**Model:** 🔵 **Sonnet 4.6**

**Prompt**
```text
Read CLAUDE.md, plan.md, and memory.md first.

Make it an installable PWA and add due-date reminders.

1. Configure vite-plugin-pwa: web manifest (Aurora icons, theme colors, name), installability on mobile + desktop, and a service worker that caches the app shell for offline loading. Verify the install prompt works.
2. Provide app icons and a maskable icon; set theme-color for light/dark.
3. Reminders for due dates: implement a reliable approach and document the trade-off — either (a) browser Notifications + a scheduled check, or (b) email reminders via a Supabase Edge Function on a cron schedule (pg_cron / scheduled function) that finds cards due soon and notifies assignees. Prefer the email/edge-function path for reliability; let me opt in.
4. Graceful offline UX: read-only cached view when offline, with a clear "offline" indicator and queued writes if feasible.

Constraints: don't break existing flows; keep bundle lean. Document any new env vars/secrets (kept out of git).

When finished: update memory.md (Phase 9 done, next step Phase 10) and commit.
```

**Verification**
- Install the app to your phone home screen and desktop; it launches full-screen with the Aurora icon.
- Load it offline — the shell appears with an offline indicator.
- Trigger a reminder for a card due soon and confirm you receive it.
- Lighthouse PWA check passes the installability criteria.

---

## Phase 10 — Polish & launch (landing + Stripe)

**Prerequisites**
- Phase 9 complete. Create a Stripe account (test mode) and grab test keys.

**Model:** 🟣 **Opus 4.8** — payment webhooks are security-sensitive, and the landing page needs to be a showpiece.

**Prompt**
```text
Read CLAUDE.md, plan.md (sections 6 and 8), and memory.md first.

Prepare the app to launch and (optionally) sell.

1. Marketing landing page (public, no auth) that is a true showcase of the Aurora aesthetic — hero with animated gradients, feature highlights, screenshots, and clear calls to action to sign up. Must be responsive and fast.
2. Billing with Stripe (test mode): define a free plan and a paid plan (e.g., limits on number of projects or members on free). Implement Stripe Checkout for upgrades and a customer portal for managing the subscription. Handle the webhook in a Supabase Edge Function and VERIFY the webhook signature; update the user's plan in the database from verified events only. Never trust client-side plan claims.
3. Enforce plan limits via RLS / server checks, not just UI.
4. Legal: add Terms of Service and Privacy Policy pages, plus basic rate-limiting considerations. Document production env vars and the go-live checklist (move Stripe to live keys, set production redirect URLs, etc.).

Constraints: webhook signature verification is mandatory. Secrets stay server-side and out of git. Keep everything on-brand.

When finished: update memory.md (Phase 10 done — project at launchable state, list any follow-ups) and commit.
```

**Verification**
- Landing page looks stunning and converts to a sign-up; great on mobile.
- Run a test-mode Stripe checkout → the webhook (signature verified) flips the account to paid in the DB.
- Free-plan limits are enforced server-side (try to exceed them via the UI and via direct calls).
- ToS/Privacy pages exist; go-live checklist is documented in `memory.md`/`plan.md`.

---

## After each phase (every time)

1. Run the **Verification** above.
2. Confirm `memory.md` was updated (done-log, next step, decisions, file tree).
3. Confirm a clean **git commit** exists (code + memory.md together).
4. Tick the phase off in `prompts.html` (or here) and move on.
