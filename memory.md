# memory.md — Current State

> **The living memory of this project.** Read this first every session to know where things stand. **Update it after every meaningful change, then commit to git** (see [CLAUDE.md](./CLAUDE.md)). For the full spec see [plan.md](./plan.md); for build steps see [prompt.md](./prompt.md).
>
> Keep this file lean: it tracks *state*, not specification. Don't paste design or architecture here — link to `plan.md`.

---

## 📍 Status

- **Phase:** Phase 1 (Design system & app shell) — **done.** Aurora theme, components, and shell build/typecheck/lint clean and run.
- **Next step:** Run **Phase 2 (Auth — email/password + Google)** from [prompt.md](./prompt.md) / `prompts.html`.
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
- [ ] Phase 2 — Auth
- [ ] Phase 2 — Auth
- [ ] Phase 3 — Projects
- [ ] Phase 4 — Kanban board
- [ ] Phase 5 — Card details (to-dos, due dates, labels)
- [ ] Phase 6 — Calendar view
- [ ] Phase 7 — Notes/docs
- [ ] Phase 8 — Collaboration
- [ ] Phase 9 — PWA & reminders
- [ ] Phase 10 — Polish & launch

---

## 🧠 Decision log

> One line per decision. Full reasoning lives in `plan.md`.

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
    │   ├── forms/              ← Field (labeled input + validation states)
    │   ├── feedback/           ← Spinner, Skeleton
    │   ├── motion/             ← Reveal wrapper
    │   ├── theme/              ← ThemeProvider, theme-context, ThemeToggle
    │   └── shell/              ← AppShell, Sidebar, SidebarNav, Topbar, BottomNav, Brand, navItems
    ├── features/               ← feature modules (Phase 3+)
    ├── hooks/
    │   └── useTheme.ts         ← theme context hook
    ├── lib/
    │   ├── supabase.ts         ← typed Supabase client (reads VITE_ env, throws if missing)
    │   ├── accents.ts          ← six accent gradients + accentVars()
    │   ├── cn.ts               ← clsx + tailwind-merge helper
    │   ├── motion.ts           ← spring presets + variants
    │   └── theme.ts            ← theme storage/apply logic
    ├── pages/                  ← Home, StyleGuide, Placeholder
    ├── styles/
    │   └── index.css           ← Aurora tokens (both themes), glass/button/gradient utilities, blobs, reduced-motion
    └── types/
        ├── database.ts         ← Supabase DB types (placeholder; regenerate per plan.md §5)
        ├── fontsource.d.ts     ← module decls for @fontsource CSS imports
        └── view-transitions.d.ts ← optional startViewTransition typing
```

---

## ⚠️ Open items / known issues

- **Visual eyeball still pending.** The build/typecheck/lint pass and routes serve 200, but the design was not viewed in a browser this session (no GUI here). Run `npm run dev` and open `/style-guide` to confirm both themes, the 3D buttons, card tilt, and flowing gradients look right before building features on top (per `prompt.md` Phase 1 verification).
- **Connect Cloudflare Pages** (SETUP.md §3) — build command `npm run build`, output `dist`, plus the two `VITE_` env vars. Then do the Phase 1 live-deploy checkpoint (open the `*.pages.dev` URL on desktop + phone).
- **Supabase keys:** local `.env` holds placeholders — set real values (Settings → API) before auth/data work in Phase 2+.
- (Log bugs, blockers, and TODOs here as they appear, with enough detail to resume cold.)

---

## ▶️ Next step (do this next)

Open `prompt.md` (or `prompts.html`) → **Phase 2 — Auth (email/password + Google)** (Opus 4.8). First eyeball `/style-guide` in the browser and connect Cloudflare Pages for the live-deploy checkpoint. Then: in Supabase enable Email + Google providers and set redirect URLs; build the `profiles` table + auto-insert trigger + RLS migration, the Aurora-styled Sign Up / Log In / Forgot Password screens, a `useAuth` hook/context, `ProtectedRoute`, and a minimal profile screen. When done, tick it off here and commit.
