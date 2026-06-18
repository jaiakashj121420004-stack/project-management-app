# memory.md — Current State

> **The living memory of this project.** Read this first every session to know where things stand. **Update it after every meaningful change, then commit to git** (see [CLAUDE.md](./CLAUDE.md)). For the full spec see [plan.md](./plan.md); for build steps see [prompt.md](./prompt.md).
>
> Keep this file lean: it tracks *state*, not specification. Don't paste design or architecture here — link to `plan.md`.

---

## 📍 Status

- **Phase:** Phase 0 (Setup & infra) — **done.** Scaffold builds, typechecks, lints, and runs.
- **Next step:** Run **Phase 1 (Design system & app shell)** from [prompt.md](./prompt.md) / `prompts.html`.
- **Repo:** github.com/jaiakashj121420004-stack/project-management-app *(git initialized locally + first commit made; remote push still pending)*
- **Environment:** GitHub · Supabase · Cloudflare · Node.js — ready ✅ (see [SETUP.md](./SETUP.md))
- **App is deployable:** ✅ `npm run build` produces `dist/` (a "Aurora — coming soon" placeholder). Cloudflare Pages not yet connected.
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
- [x] **Phase 0 — Setup & infra** — Vite + React + TS (strict) scaffolded in place; Tailwind/PostCSS, Framer Motion, dnd-kit, TanStack Query, React Router, supabase-js, Zod, date-fns, vite-plugin-pwa installed & wired; typed Supabase client; ESLint (flat) + Prettier; clean folder structure; README run/deploy docs; git initialized + first commit.
- [ ] Phase 1 — Design system & app shell
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
    ├── App.tsx           ← placeholder "Aurora — coming soon" screen
    ├── main.tsx          ← React root
    ├── vite-env.d.ts     ← typed import.meta.env (VITE_SUPABASE_*)
    ├── components/       ← reusable UI (Phase 1+)
    ├── features/         ← feature modules (Phase 3+)
    ├── hooks/            ← shared hooks
    ├── lib/
    │   └── supabase.ts   ← typed Supabase client (reads VITE_ env, throws if missing)
    ├── pages/            ← route pages
    ├── styles/
    │   └── index.css     ← Tailwind directives + base styles
    └── types/
        └── database.ts   ← Supabase DB types (placeholder; regenerate per plan.md §5)
```

---

## ⚠️ Open items / known issues

- **Push to GitHub remote still pending.** Git is initialized locally with the Phase 0 commit, but `origin` is not yet added/pushed. Before pushing: `git branch -M main`, add the remote from `prompt.md` Phase 0 step 7, then `git push -u origin main`. Confirm `.env` stays untracked.
- **Connect Cloudflare Pages** (SETUP.md §3) when ready — build command `npm run build`, output `dist`, plus the two `VITE_` env vars.
- **Supabase keys:** local `.env` currently holds placeholders — set real values (Settings → API) before auth/data work in Phase 2+.
- (Log bugs, blockers, and TODOs here as they appear, with enough detail to resume cold.)

---

## ▶️ Next step (do this next)

Open `prompt.md` (or `prompts.html`) → **Phase 1 — Design system & app shell** (Opus 4.8). Build the Aurora theme tokens, light/dark themes, animated background, glass components, 3D buttons, and the app shell, then deploy to Cloudflare and verify the live `*.pages.dev` URL on desktop + phone. When done, tick it off here and commit.
