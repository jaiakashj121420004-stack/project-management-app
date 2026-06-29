# plan.md — Aurora Project Management App (Specification)

> **The spec: what we're building and how.** Stable reference. For *current state* see [memory.md](./memory.md); for the *build steps* see [prompt.md](./prompt.md); for *working rules* see [CLAUDE.md](./CLAUDE.md).

---

## 1. Vision

A modern project-management app for someone running many projects across many domains. Kanban boards, to-do lists, multiple projects/workspaces, due dates & reminders, a calendar view, and per-project notes — with real-time collaboration. It must:

- Work beautifully on **mobile and desktop** from one codebase (installable PWA).
- **Sync** across devices automatically.
- Be **free** to build, launch, and run for early users.
- Be **secure** and **clean** (no slop) so it can become a **sellable** product.
- Look **jaw-dropping** — colorful, premium, alive. Never a generic dark-blue dashboard.

---

## 2. Key decisions

| Decision | Choice | Why |
|---|---|---|
| App type | **Web app, installable PWA** | One codebase for phone + desktop; sync needs a server anyway; free to host; standard way to sell software. |
| Auth | **Email/password + Google** | Both, via Supabase Auth. Low friction, covers everyone. |
| Frontend host | **Cloudflare Pages** | Free, **commercial use allowed**, unlimited bandwidth, never expires. |
| Backend | **Supabase** | Postgres + Auth + RLS + Realtime; free tier permits commercial use, no card. |
| ❌ Avoid | **Vercel Hobby free tier** | Its terms **prohibit commercial/revenue use** — unusable for a sellable app without paying. |
| Payments | **Dodo Payments** (Merchant of Record) | Replaced Stripe. As MoR, Dodo is the seller of record — it localizes currency and remits sales tax/VAT for us. No monthly fee; per-transaction pricing. |
| **Docker?** | **No — not needed** | See below. |

### Why no Docker

Docker packages a *server you run yourself* so it behaves identically everywhere. **This app has no such server:**

- The **frontend** compiles to static files (HTML/CSS/JS) that Cloudflare Pages serves directly from the repo — nothing to containerize.
- The **backend** is Supabase, a fully managed cloud service — you don't run or deploy it.

So Docker would add real complexity (Dockerfiles, image builds, registries) for **zero benefit**, and could complicate the free Cloudflare deploy. The only place Docker shows up in this ecosystem is `supabase start`, which runs a *local* copy of Supabase in Docker for offline development — but we'll develop against a free **cloud** Supabase project instead, which is simpler for a beginner and needs no Docker at all.

**Revisit only if** we later add a custom backend server (e.g. a heavy background-job worker) that genuinely needs reproducible deployment. Until then: skip it.

---

## 3. Architecture & stack

**Shape:** a static React frontend talks directly to Supabase over HTTPS. Supabase is the entire backend — database, auth, real-time, and security policies. There is no server for us to write or operate.

```
[ Phone / Desktop browser ]
        │  (installable PWA, offline cache)
        ▼
[ React + TS frontend ]  ──hosted on──▶  Cloudflare Pages (free, static)
        │  Supabase JS client (HTTPS, anon key)
        ▼
[ Supabase ]  Postgres DB · Auth (email + Google) · Row Level Security · Realtime · Storage
        │
        ▼
[ Dodo Payments ]  (Merchant of Record — billing, currency & tax)
```

### Frontend

| Tool | Role |
|---|---|
| **React + TypeScript** | UI, with strict typing to kill bugs early. |
| **Vite** | Fast dev server + static production build. |
| **Tailwind CSS** | Utility styling for the Aurora design system. |
| **Framer Motion** | Spring physics, drag motion, transitions — core to the "jaw-dropping" feel. |
| **dnd-kit** | Accessible, modern drag-and-drop for Kanban. (Do **not** use the deprecated `react-beautiful-dnd`.) |
| **TanStack Query** | Server-state fetching, caching, optimistic updates. |
| **React Router** | Navigation between projects and views. |
| **vite-plugin-pwa** | Installability + offline caching. |
| **Zod** | Input validation. |
| **date-fns** | Lightweight date handling for due dates + calendar. |

### Backend — Supabase

Postgres database, Auth (email/password + Google OAuth), Row Level Security for multi-tenant isolation, Realtime for live collaboration, Storage for attachments (later). Accessed from the frontend with the public **anon** key; security is enforced by RLS, not by hiding the key.

---

## 4. Aurora Design System 🎨

The signature look. The goal is a *premium, luminous, colorful* feel — frosted glass floating over living gradient light. Implement these as Tailwind theme tokens + CSS variables so the whole app is consistent.

### 4.1 Concept

**"Frosted glass over an aurora."** Soft, animated multi-color gradient "light blobs" drift slowly in the background. Content sits on **glassmorphism** panels — translucent, blurred, with a thin luminous border. Each project carries its own **vivid accent gradient**, so the app feels colorful and personal, never monotone.

### 4.2 Color & gradients

**Project accent gradients** (each project picks one; used for headers, buttons, active states, card glows):

| Name | From → To |
|---|---|
| Aurora | `#7C3AED` → `#06B6D4` (violet → cyan) |
| Sunset | `#FF6B6B` → `#FFD93D` (coral → gold) |
| Bloom | `#EC4899` → `#8B5CF6` (pink → purple) |
| Lagoon | `#06B6D4` → `#10B981` (cyan → emerald) |
| Ember | `#F97316` → `#EF4444` (orange → red) |
| Galaxy | `#6366F1` → `#A855F7` (indigo → magenta) |

**Themes — both are first-class (required).** Ship a luminous **light** mode *and* a rich **dark** mode, with a persistent toggle and a smooth cross-fade when switching. Neither is a muddy navy; both are colorful and alive. Every component is designed and tested in both.

**Backgrounds**

- **Dark mode:** base `#0B0710` (deep aubergine-black, *not* navy) with 3–4 large blurred aurora blobs (violet `#7C3AED`, cyan `#06B6D4`, magenta `#EC4899`) at ~20–35% opacity, slowly animating.
- **Light mode:** base `#FAF7FF` (warm off-white) with pastel aurora blobs (soft violet, peach, mint) at low opacity.

**Glass surfaces**

- Dark: `rgba(255,255,255,0.06)` fill, `backdrop-blur: 16–24px`, 1px border `rgba(255,255,255,0.12)`, soft drop shadow + subtle inner glow.
- Light: `rgba(255,255,255,0.55)` fill, same blur, border `rgba(255,255,255,0.7)`.

**Semantic**: success `#10B981`, warning `#F59E0B`, danger `#EF4444`, info `#06B6D4`. Due-soon = warning, overdue = danger (used on cards/calendar).

### 4.3 Typography

- **Display / headings:** a bold modern face — **"Space Grotesk"** or **"Sora"** (both free, commercial-OK via Google Fonts / Fontshare). Big, confident, tight tracking.
- **Body / UI:** **"Inter"**. Highly legible at small sizes.
- Scale is generous: large page titles, clear hierarchy, lots of breathing room.

### 4.4 Depth, 3D & motion (elevated — a defining feature)

This app should feel **alive and three-dimensional**, not flat. Motion and depth are core to the brand, not decoration.

**Animated, moving gradients**

- Background aurora blobs drift continuously and **parallax** subtly toward the pointer / on scroll.
- Accent gradients **flow**: headings, primary buttons, and active states animate their gradient position (a slow "liquid" shimmer) — implemented via animated `background-position` on a `~200%` gradient, or a slowly rotating conic gradient.
- **Animated gradient borders** (rotating conic) on key surfaces: the active project card, the primary call-to-action.

**3D, tactile buttons & cards**

- Buttons look **raised and physical**: a top inner highlight + layered drop shadows for real elevation, a soft accent glow, and a glossy gradient surface.
  - **Hover:** lift (`translateY(-2…4px)`) + larger shadow + intensified glow.
  - **Press / active:** depress (`translateY(+1px)`, slight scale-down) with a smaller shadow — tactile feedback.
- Cards have **pointer-reactive 3D tilt** (`rotateX`/`rotateY` following the cursor) with a shadow that shifts as they tilt, so they feel like physical objects under glass. Dragged Kanban cards lift toward the viewer (scale + shadow + slight rotation).
- Use **layered, multi-step shadows** (never a single flat shadow) plus colored glows that pick up the project accent → genuine depth.
- **Radius:** `rounded-2xl`/`rounded-3xl` (16–24px) on cards, modals, buttons.

**Motion system (Framer Motion + CSS)**

- Spring physics on drag, hover, and layout changes; columns reflow smoothly.
- Page / modal transitions: fade + slide / scale with spring.
- A **celebration** (confetti / satisfying pop) when a card hits **Done**.
- Tasteful, never noisy. **Always gate heavy motion behind `prefers-reduced-motion`** — tilt, parallax, and flowing gradients calm down or stop for users who ask for that.

**Micro-details:** animated gradient text on key headings, animated gradient focus rings, subtle glass highlights, optional noise/grain overlay for richness.

### 4.5 Components to standardize early (Phase 1)

`AuroraBackground`, `GlassPanel`, `GlassCard`, `GradientButton`, `Avatar`, `Badge/Pill`, `Modal/Sheet`, `Input/Field`, `ThemeToggle`, motion wrappers. Build these once; reuse everywhere.

---

## 5. Feature scope & data model

Kept deliberately tight. Postgres tables:

| Table | Purpose | Key columns |
|---|---|---|
| `profiles` | User info (1:1 with `auth.users`) | `id`, `display_name`, `avatar_url` |
| `projects` | Workspaces / project ideas | `id`, `owner_id`, `name`, `description`, `accent` (gradient name), `created_at` |
| `project_members` | Access control + sharing | `project_id`, `user_id`, `role` (`owner`/`editor`/`viewer`) |
| `columns` | Kanban columns | `id`, `project_id`, `name`, `position` |
| `cards` | Tasks | `id`, `project_id`, `column_id`, `title`, `description`, `due_date`, `assignee_id`, `position`, `created_at` |
| `checklist_items` | To-do list inside a card | `id`, `card_id`, `text`, `is_done`, `position` |
| `labels` + `card_labels` | Tags / filtering | `name`, `color` / `card_id`, `label_id` |
| `notes` | Notes/docs per project | `id`, `project_id`, `title`, `content`, `updated_at` |
| `canvas_notes` | Infinite whiteboard (Pro) — **project OR personal** | `id`, `project_id?` (nullable), `owner_id`, `title`, `page_type`, `scene` (jsonb, denormalised fast-read), `doc_state` (BYTEA, **Yjs CRDT snapshot — live since P3.7**), `updated_at` |
| `canvas_members` | Per-canvas sharing (for personal canvases) | `canvas_id`, `user_id`, `role` (`editor`/`viewer`) |
| `comments` | Discussion on a card (collab) | `id`, `card_id`, `user_id`, `body`, `created_at` |

**Feature → data mapping:** Multiple projects → `projects`. Kanban → `columns` + `cards` (`position` for ordering). To-do lists → `checklist_items`. Due dates & reminders → `cards.due_date` (+ reminders in Phase 9). Calendar → query cards with a `due_date`. Notes → `notes`. Canvas → `canvas_notes`. Collaboration → `project_members` + Realtime.

**Canvas data + sharing model (Pro).** A canvas is decoupled from a project. `canvas_notes.project_id` is **nullable**: a **project canvas** carries a `project_id` and is shared via project membership (as today); a **personal canvas** has `project_id = NULL` and is owned by one user via `owner_id` (defaulted to `auth.uid()`, immutable — a canvas never re-parents). Notes remain project-only. A canvas is reachable three ways — **owner** (`owner_id`), **project membership** (if it has a project), or a **`canvas_members`** row — and the owner alone manages `canvas_members`. Sharing roles mirror projects (`editor`/`viewer`); the owner is `owner_id`, never a member row.

**Canvas real-time collaboration (Pro, P3.7) — Yjs CRDT over Supabase Realtime.** The canvas is live-multiplayer. Each note is one **`Y.Doc`** (a CRDT): a `Y.Array<Y.Map>` `elements` (each element a Y.Map of its flat fields — the same shape as the `scene` jsonb; array order is irrelevant, the rendered scene sorts by `z`), one top-level **`Y.XmlFragment` per TextBox** (bound to Tiptap via `@tiptap/extension-collaboration` so concurrent typing in a box merges), and a `meta` map for doc-level state (`pageType`). The React editor consumes the doc through `collab/useYjsCanvas.ts`, which preserves the old history surface (`scene`/`commit`/`undo`/`redo`) — `commit` **diffs** a whole new scene into minimal CRDT ops, undo/redo is a **`Y.UndoManager`** scoped to the local user's edits (so it never reverts a collaborator). **Transport is a thin custom provider** (`collab/SupabaseYjsProvider.ts`) over a single **private** Supabase Realtime *broadcast* channel `canvas:<noteId>`: a state-vector sync handshake on join, base64-encoded Yjs `update`s applied live (remote updates carry the provider as their transaction origin to avoid echo loops), and **awareness** (`y-protocols/awareness`, throttled) carrying each user's world-space cursor + selection + name/colour/avatar, rendered as live remote cursors + selection halos. **Persistence:** a debounced encode of the doc (`Y.encodeStateAsUpdate`) is written to `canvas_notes.doc_state` (BYTEA) **alongside** the denormalised `scene` jsonb (kept for fast non-realtime reads + thumbnails); on open the doc seeds from `doc_state` when present (else from `scene`), and Yjs merges make concurrent last-writes safe. **Large media bytes never enter the doc** — only the storage path / canonical embed URL + transform, exactly as in the jsonb scene. See §6 for how the channel is gated.

---

## 6. Security model

The rule: **the frontend is untrusted; the database enforces the rules.**

- **Auth:** Supabase Auth handles password hashing, sessions, and Google OAuth. Never roll our own.
- **Row Level Security on every table.** A row is accessible only if the current user (`auth.uid()`) is a member of that row's project. Conceptually, cards/columns/notes are gated by: *is `project_id` in the set of projects where I'm a member?*
- **Avoid the recursion gotcha:** policies on `project_members` that reference `project_members` can infinite-loop. Use a `SECURITY DEFINER` helper function (e.g. `is_project_member(project_id)`) to check membership cleanly. The standalone-canvas access paths follow the same pattern: `can_access_canvas` / `can_edit_canvas` / `is_canvas_owner` are SECURITY DEFINER helpers, so the `canvas_members` policies never sub-query `canvas_members` directly.
- **Canvas Pro-gating is DOUBLE and plan-aware.** Creating/editing a canvas requires Pro — a **project canvas** on the board owner's plan (`project_is_pro`), a **personal canvas** on the owner's own plan (`user_is_pro`); `canvas_is_pro` picks the right one for the UPDATE check, so autosave stops if the governing plan lapses. Read + delete stay membership/owner gated (cleanup survives a lapse), mirroring the `canvas-media` Storage policies. The UI gate (`<ProGate>`) is UX only; RLS is the real enforcement.
- **Canvas embeds are allow-listed (no arbitrary iframes).** Pasted media URLs are accepted only from a fixed provider allow-list (YouTube, Vimeo, Loom, SoundCloud); the iframe `src` is rebuilt from each provider's *canonical* embed endpoint plus the extracted id — never the user's raw string — and non-`http(s)`/unknown hosts are rejected. This blocks `javascript:`/`data:`/foreign-origin iframe injection (XSS/clickjacking), and a stored scene can't smuggle a hostile embed past the same parser on render. Uploaded/recorded media stays in the private `canvas-media` bucket behind signed URLs + Storage RLS (Pro-gated write, member-gated read).
- **Canvas realtime channel is RLS-gated (not just client-gated).** The P3.7 live-collaboration channel (`canvas:<noteId>`) is a **private** Supabase Realtime channel, so every broadcast message is authorised by RLS on `realtime.messages` (migration `20260629120000_canvas_realtime.sql`): **receiving** requires `can_access_canvas(noteId)` and **sending** requires `can_edit_canvas(noteId)` — the same SECURITY DEFINER helpers the table uses. A guessed `noteId` therefore can't subscribe to a board you can't access, and a viewer receives live edits but can't broadcast. The persisted `doc_state` is protected by the existing `canvas_notes` RLS. Public channels (presence, notifications) are unaffected (they skip `realtime.messages` authorisation).
- **Keys:** only the public **anon** key ships to the browser. The **`service_role`** key never leaves the server/dashboard.
- **Validation:** Zod on the client for UX; Postgres constraints + RLS on the server as the real guarantee.
- **Transport:** HTTPS everywhere (automatic on Cloudflare + Supabase).
- **Before charging money:** rate limiting, Terms of Service + Privacy Policy, and **verify Dodo webhook signatures** (Standard Webhooks HMAC) before any DB write.

---

## 7. Roadmap (build order)

Phases are sequenced so Phase 1 is a thin vertical slice through the whole stack (de-risks everything), and the app is genuinely usable by Phase 5. **The detailed, copy-paste build prompts live in [prompt.md](./prompt.md).**

0. **Setup & infra** — repo, Vite, Tailwind, Supabase project, Cloudflare deploy, git + doc workflow.
1. **Design system & app shell** — Aurora theme, glass components, motion primitives, layout. **Ends with the first live Cloudflare deploy — verify the `*.pages.dev` URL on desktop + phone.**
2. **Auth** — email/password + Google, protected routes, profile.
3. **Projects** — CRUD, workspaces, accent picker, RLS.
4. **Kanban board** — columns + cards + dnd-kit drag-and-drop + motion.
5. **Card details** — checklists (to-dos), due dates, labels. *(usable MVP)*
6. **Calendar view** — month/week view of dated cards.
7. **Notes/docs** — per-project notes.
8. **Collaboration** — invite members, roles, realtime live updates.
9. **PWA & reminders** — installable, offline, due-date reminders.
10. **Polish & launch** — landing page, Dodo Payments billing, plan limits, ToS/privacy.

---

## 8. Cost & scaling (honest)

- **Free covers** development, personal use, and early users (Supabase: 500 MB DB, 50k monthly users; Cloudflare: unlimited bandwidth). Realistically $0 until real traction.
- **At scale / on monetizing:** Supabase Pro ~$25/mo (removes the 7-day inactivity pause, raises limits), possibly a Cloudflare paid tier eventually, Dodo Payments per-transaction. These arrive only once there's revenue to cover them.
- **No lock-in:** Supabase + Postgres are open-source and self-hostable.
- Straight talk: "free forever at large scale" isn't real for any SaaS — but "free to build, launch, and reach first paying users, then cheap relative to revenue" is exactly this stack.

---

## 9. How the docs fit together

Four files, each with one job, cross-linked so none gets bloated and Claude always has full context:

- **CLAUDE.md** — *rules.* How to work; read every session; points here + to memory.md.
- **plan.md** (this file) — *spec.* What/how. Changes only when architecture/scope/design changes.
- **memory.md** — *state.* What's done, decisions log, next step. Updated after every change + committed.
- **prompt.md** — *playbook.* Ordered build prompts with model, prerequisites, and verification.

Reading CLAUDE.md → memory.md → plan.md gives complete context with no duplication.
