# Aurora

A modern, installable PWA for project management — Kanban boards, to-do lists, due dates, a calendar, notes, and real-time collaboration. Built to look stunning and to become a sellable product.

> **Working on this repo?** Read [CLAUDE.md](./CLAUDE.md) (rules), then [memory.md](./memory.md) (state), then [plan.md](./plan.md) (spec). One-time account/key setup lives in [SETUP.md](./SETUP.md).

## Tech stack

React + TypeScript + Vite · Tailwind CSS · Framer Motion · dnd-kit · TanStack Query · React Router · Supabase (Postgres + Auth + RLS + Realtime) · Zod · date-fns · vite-plugin-pwa. Hosted on Cloudflare Pages. Full rationale in [plan.md](./plan.md) §3.

## Run locally

Requires Node.js 20+ and npm.

```bash
npm install                 # install dependencies
cp .env.example .env        # then fill in your Supabase values (Settings → API)
npm run dev                 # start the dev server at http://localhost:5173
```

Set these two **public** variables in `.env` (the anon key is safe in the browser — Row Level Security protects the data; never put the `service_role` key here):

| Variable                 | Where to find it                          |
| ------------------------ | ----------------------------------------- |
| `VITE_SUPABASE_URL`      | Supabase dashboard → Settings → API → URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API → anon public key |

## Scripts

| Command             | Does                                            |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Start the Vite dev server with HMR.             |
| `npm run build`     | Type-check and produce a static build in `dist/`. |
| `npm run preview`   | Serve the production build locally.             |
| `npm run typecheck` | Type-check the project without emitting.        |
| `npm run lint`      | Lint with ESLint.                               |
| `npm run format`    | Format with Prettier.                           |

## Deploy to Cloudflare Pages

Cloudflare Pages is free, allows commercial use, and serves the static build directly (see [plan.md](./plan.md) §2).

1. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**, and select this repository.
2. Build settings:
   - **Framework preset:** Vite (or None)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. Add the two environment variables under **Settings → Environment variables** (Production *and* Preview):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. Every push to `main` triggers a new build; pull requests get preview URLs.

The build emits a PWA manifest and service worker, so the deployed app is installable on mobile and desktop. The full manifest, icons, and offline strategy are finished in Phase 9.
