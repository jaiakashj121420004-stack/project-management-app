# CLAUDE.md — How to work in this repo

> This file is read automatically at the start of every session. It is the **operating manual**, kept short on purpose. The deep detail lives in the files it links to.

## What this project is

**Aurora** — a modern, jaw-dropping project-management web app (Kanban boards, to-do lists, multiple projects, due dates, calendar, notes, collaboration). Delivered as an installable PWA that works on mobile **and** desktop, syncs across devices, is free to run, and is built to become a sellable product.

## The three docs (read in this order before doing anything)

1. **[memory.md](./memory.md)** — *current state.* What's built, what's in progress, the latest decisions, and the **next step**. Always read this first to know where we are.
2. **[plan.md](./plan.md)** — *the spec.* Architecture, full tech stack, the **Aurora design system**, data model, security model, and roadmap. The source of truth for *what* and *how*.
3. **[prompt.md](./prompt.md)** — *the build playbook.* The ordered, copy-paste prompts for each phase. Tells you exactly what to build next and how to verify it.

If these three are read, you have complete context. Do not duplicate their content elsewhere — link to it.

**Active multi-phase upgrade:** the Nvexis rebrand + notes/canvas expansion is tracked in **[NVEXIS-UPGRADE-PLAN.md](./NVEXIS-UPGRADE-PLAN.md)** (locked decisions, Phase 1 done, Phases 2–6 specs, and session/environment quirks). Read it before continuing that work. **Currently: Phases 1–6 built + a 2026-07-14 polish pass. Phases 1–2 are LIVE; Phases 3–6 (block editor + custom colours, notes/canvas sharing, canvas minimap/frames/outline, extras) plus the polish (toggle blocks, note Markdown export, slash-menu templates, emoji icons on notes/folders, note cover images, Pro audio/video embeds, images with drag-resize, Library-card icons, canvas jump-to-element + named Frame elements, unified highlight swatches) are written + type-verified via review subagents and PENDING build/commit + 3 idempotent migrations (`20260714180000_note_media`, `20260714200000_notes_folders_icon`, `20260714210000_note_cover`) on Windows — see `memory.md`. Remaining: runtime-test, then go-live (Dodo LIVE keys, KYC, legal).**

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

## Design rules — **Nvexis "The Almanac"** (rebranded 2026-07-13; see `DESIGN-GUIDELINES.md` + `NVEXIS-UPGRADE-PLAN.md`)

> The app was rebranded from the old colorful "Aurora" look to the **Nvexis** brand. The name stays *Aurora* (a Nvexis product line); only the look is Nvexis. Do **not** reintroduce the old violet/cyan gradients, rainbow accents, Inter, or Space Grotesk.

- **Aesthetic = hybrid "glass over parchment."** Warm two-ink palette — **oxblood** (`#7A2A26` Day / `#C24A40` Night) on **parchment** `#ECE4D6` (Day) / **ink** `#181210` (Night). We KEEP frosted glassmorphism surfaces (warmed onto paper, not white frost) and a subtle **paper-grain** noise. Oxblood is the single accent ("one chroma in the room").
- **Type:** Fraunces (display/headings) · Spectral (body) · IBM Plex Mono (figures/eyebrows). **Never Inter.** Loaded via Google Fonts `<link>` in `index.html`.
- **Tokens** live in `src/styles/index.css` (CSS vars: Night = `:root/.dark`, Day = `.light`) + `tailwind.config.ts`. Per-project accents are an earthy family in `src/lib/accents.ts`. Logo = the **Nvexis prism** (`public/brand/*`, sidebar `Brand` mark, `favicon`/PWA icons).
- **Motion & depth stay** (Framer Motion, 3D tactile buttons, card tilt, spring) but calmer/editorial; gate heavy motion behind `prefers-reduced-motion`.
- Full light **and** dark themes, both first-class (Day is the hero). Persist the choice; cross-fade on toggle.
- **Every screen is mobile-first** and verified on a phone (see `NVEXIS-UPGRADE-PLAN.md` §10).

## Stack at a glance (full version in `plan.md`)

React + TypeScript + Vite · Tailwind CSS + Framer Motion · dnd-kit (Kanban) · Tiptap + Yjs (rich text + realtime canvas) · Konva (canvas) · Supabase (Postgres + Auth + RLS + Realtime) · Cloudflare Pages (hosting) · **Dodo Payments** (Merchant of Record; replaced Stripe). **No Docker** — see `plan.md` for why.
