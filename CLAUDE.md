# CLAUDE.md — How to work in this repo

> This file is read automatically at the start of every session. It is the **operating manual**, kept short on purpose. The deep detail lives in the files it links to.

## What this project is

**Aurora** — a modern, jaw-dropping project-management web app (Kanban boards, to-do lists, multiple projects, due dates, calendar, notes, collaboration). Delivered as an installable PWA that works on mobile **and** desktop, syncs across devices, is free to run, and is built to become a sellable product.

## The three docs (read in this order before doing anything)

1. **[memory.md](./memory.md)** — *current state.* What's built, what's in progress, the latest decisions, and the **next step**. Always read this first to know where we are.
2. **[plan.md](./plan.md)** — *the spec.* Architecture, full tech stack, the **Aurora design system**, data model, security model, and roadmap. The source of truth for *what* and *how*.
3. **[prompt.md](./prompt.md)** — *the build playbook.* The ordered, copy-paste prompts for each phase. Tells you exactly what to build next and how to verify it.

If these three are read, you have complete context. Do not duplicate their content elsewhere — link to it.

**Active multi-phase upgrade:** the Nvexis rebrand + notes/canvas expansion is tracked in **[NVEXIS-UPGRADE-PLAN.md](./NVEXIS-UPGRADE-PLAN.md)** (locked decisions, Phase 1 done, Phases 2–6 specs, and session/environment quirks). The audit-driven remediation (7 phases) is tracked in **[REMEDIATION-PLAN.md](./REMEDIATION-PLAN.md)** + **[PHASE-7-VERIFICATION.md](./PHASE-7-VERIFICATION.md)**. Read them before continuing that work. **Currently: ALL 7 remediation phases built (Phase 7 = verification & go-live, 2026-07-15: axe-core a11y suite + the executable Lighthouse/mobile/regression/re-score checklist; re-score targets Design 9.5 · Eng 9.5 · Security 9.5 pending the runtime evidence). The Nvexis Phases 3–6 + polish are also built (pending build/commit + 3 idempotent migrations `20260714180000_note_media`/`20260714200000_notes_folders_icon`/`20260714210000_note_cover`). Everything is PENDING the Windows `npm install` + build/test/commit (see `memory.md`). **Go-live gate #5 (prod env hygiene) is ✅ DONE (2026-07-15)** — verified against prod `rpwklsrdfqyisogbcdgg`: all 30 migrations applied (CLI history repaired), private buckets exist, Edge secrets set, reminders cron succeeding, anon-key-only confirmed (browser + Cloudflare). Remaining human-only go-live gates: Dodo LIVE keys, KYC, legal, one external pen-test (+ set a real `REMINDER_FROM_EMAIL` after verifying a Resend domain).**

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

> The app uses the **Nvexis "Almanac"** visual language. **Brand hierarchy (locked 2026-07-14): Nvexis = the company; Aurora = the product** (this app). Aurora is the hero everywhere in-app; "Nvexis" appears only as quiet attribution (footer, legal, "by Nvexis"). Do **not** reintroduce the old violet/cyan gradients, rainbow accents, Inter, or Space Grotesk.

- **Aesthetic = hybrid "glass over parchment."** Warm two-ink palette — **oxblood** (`#7A2A26` Day / `#C24A40` Night) on **parchment** `#ECE4D6` (Day) / **ink** `#181210` (Night). We KEEP frosted glassmorphism surfaces (warmed onto paper, not white frost) and a subtle **paper-grain** noise. Oxblood is the single accent ("one chroma in the room").
- **Type:** Fraunces (display/headings) · Spectral (body) · IBM Plex Mono (figures/eyebrows). **Never Inter.** Loaded via Google Fonts `<link>` in `index.html`.
- **Tokens** live in `src/styles/index.css` (CSS vars: Night = `:root/.dark`, Day = `.light`) + `tailwind.config.ts`. Per-project accents are an earthy family in `src/lib/accents.ts`. Logo = the **Aurora "A"-monogram** (Phase 1, 2026-07-14) — a Fraunces-style high-contrast serif A in an oxblood tile, outlined vector in `public/brand/aurora-*.svg`, rendered inline by `AuroraMark` in `components/shell/Brand.tsx` and rasterised into `favicon`/PWA/apple-touch/maskable icons (regenerate via `scripts/generate-icons.mjs`). The old Nvexis-prism PNGs were removed.
- **Motion & depth stay** (Framer Motion, 3D tactile buttons, card tilt, spring) but calmer/editorial; gate heavy motion behind `prefers-reduced-motion`.
- Full light **and** dark themes, both first-class (Day is the hero). Persist the choice; cross-fade on toggle.
- **Every screen is mobile-first** and verified on a phone (see `NVEXIS-UPGRADE-PLAN.md` §10).

## Stack at a glance (full version in `plan.md`)

React + TypeScript + Vite · Tailwind CSS + Framer Motion · dnd-kit (Kanban) · Tiptap + Yjs (rich text + realtime canvas) · Konva (canvas) · Supabase (Postgres + Auth + RLS + Realtime) · Cloudflare Pages (hosting) · **Dodo Payments** (Merchant of Record; replaced Stripe). **No Docker** — see `plan.md` for why.
