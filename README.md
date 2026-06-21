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

## Installable PWA & offline

The build emits a full web manifest, Aurora app icons (incl. a maskable icon), and a service worker, so the deployed app is **installable** on mobile and desktop and runs full-screen with the Aurora icon.

- **Install:** open the live site → use the browser's *Install app* / *Add to Home Screen* prompt.
- **Offline:** the app shell is precached, and the TanStack Query cache is persisted to `localStorage`, so opening the app offline shows a **read-only cached view** with a clear "You're offline" indicator. Writes aren't queued — they resume when you reconnect. (The persisted cache is wiped on sign-out so nothing leaks on shared devices.)
- **Updates:** a new deploy shows a one-tap "A new version is available — Reload" prompt rather than reloading mid-edit.
- **Icons:** regenerate from brand colors anytime with `node scripts/generate-icons.mjs` (zero dependencies; writes into `public/`).

## Due-date reminders

Two complementary options, both opt-in from **Profile → Reminders**:

1. **Browser notifications** — zero setup; fire while Aurora is open in the browser/installed app.
2. **Email reminders** — reliable and work even when the app is closed, via a Supabase Edge Function on a daily cron that emails each assignee their due-soon cards. This needs a one-time server setup (a Resend API key + secrets + a `pg_cron` schedule) documented in [supabase/README.md](./supabase/README.md#due-date-email-reminders-phase-9--optional-opt-in). **No reminder secrets ever go in `.env` or the frontend** — they live only in the Supabase dashboard.
