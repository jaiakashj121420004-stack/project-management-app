# CLAUDE.md — How to work in this repo

> This file is read automatically at the start of every session. It is the **operating manual**, kept short on purpose. The deep detail lives in the files it links to.

## What this project is

**Aurora** — a modern, jaw-dropping project-management web app (Kanban boards, to-do lists, multiple projects, due dates, calendar, notes, collaboration). Delivered as an installable PWA that works on mobile **and** desktop, syncs across devices, is free to run, and is built to become a sellable product.

## The three docs (read in this order before doing anything)

1. **[memory.md](./memory.md)** — *current state.* What's built, what's in progress, the latest decisions, and the **next step**. Always read this first to know where we are.
2. **[plan.md](./plan.md)** — *the spec.* Architecture, full tech stack, the **Aurora design system**, data model, security model, and roadmap. The source of truth for *what* and *how*.
3. **[prompt.md](./prompt.md)** — *the build playbook.* The ordered, copy-paste prompts for each phase. Tells you exactly what to build next and how to verify it.

If these three are read, you have complete context. Do not duplicate their content elsewhere — link to it.

**First-time environment setup** (accounts, keys, git remote, Cloudflare) lives in [SETUP.md](./SETUP.md) — a one-time human checklist, separate from the build prompts.

## 🔴 Golden workflow rules (non-negotiable)

1. **Before starting:** read `memory.md` (state) and the relevant section of `plan.md` (spec). Never start blind.
2. **After every meaningful change:** update **`memory.md`** — move the item to the done-log, note any new decision, record the new *next step*, and update the file-structure section if files were added.
3. **Then commit to git immediately.** Never end a unit of work with uncommitted changes. Use Conventional Commits:
   - `feat: add kanban drag-and-drop`
   - `fix: correct RLS policy on cards`
   - `docs: update memory.md after phase 4`
   - `style:`, `refactor:`, `chore:` as appropriate.
   - It's fine (encouraged) to commit code **and** the `memory.md` update together.
4. **Update `plan.md` only** when the architecture, scope, data model, security model, or design system actually changes — and say so in the commit + memory.md decision log.
5. **Keep these docs lean.** `memory.md` is state, `plan.md` is spec, `CLAUDE.md` is rules. Put new info in exactly one place and link to it.

## Coding standards (anti-slop)

- **TypeScript everywhere, `strict` on.** No `any`. Model your types from the data model in `plan.md`.
- Small, focused components and functions. One responsibility each. No 500-line files.
- Validate all user input with **Zod** before it touches the database.
- No dead code, no commented-out blocks, no `console.log` left in commits.
- Meaningful names. Comment *why*, not *what*.
- Every feature works on **mobile and desktop** (responsive, touch-friendly).

## Security rules (this is a sellable, multi-user product)

- **Row Level Security (RLS) ON for every table.** A user may only read/write rows for projects they are a member of. See `plan.md` → Security.
- Never put the Supabase **`service_role`** key in the frontend. Only the public **anon** key ships to the browser (RLS protects the data).
- Secrets live in `.env` (gitignored) locally and in Cloudflare/Supabase dashboards in production. **Never commit secrets.**
- Validate input on the client (Zod) *and* rely on DB constraints + RLS on the server. Treat the frontend as untrusted.

## Design rules (this app must look stunning — see `plan.md` → Aurora Design System)

- This is **not** a plain flat app and **never** a generic dark-blue dashboard. Honor the **Aurora** aesthetic: animated multi-color gradient backgrounds, frosted glassmorphism surfaces, vivid per-project accent gradients, bold display typography, and smooth spring motion.
- Every screen should feel premium and alive. Motion (Framer Motion) on drag, hover, and state changes is part of the spec, not a nice-to-have.
- **Depth & motion are defining features, not decoration:** flowing/animated gradients, 3D tactile buttons (raised, with hover-lift and a press state), pointer-reactive card tilt, and layered shadows/glows. See `plan.md` §4.4. Gate heavy motion behind `prefers-reduced-motion`.
- Full light **and** dark themes — both first-class, luminous and colorful, neither a muddy navy. Persist the choice; cross-fade on toggle.

## Stack at a glance (full version in `plan.md`)

React + TypeScript + Vite · Tailwind CSS + Framer Motion · dnd-kit (Kanban) · Supabase (Postgres + Auth + RLS + Realtime) · Cloudflare Pages (hosting) · Stripe (payments, later). **No Docker** — see `plan.md` for why.
