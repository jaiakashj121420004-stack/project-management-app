# ☀️ Wake-up checklist — paste these, in this order (2026-07-16)

Everything below was built and verified overnight. Run it on Windows from the repo root
(`C:\Users\jaiak\Desktop\CLAUDE WORKSPACE\Project Management app`). Nothing here was applied
for you — you're in control of every push. Estimated time: ~15–20 min.

Order matters: **DB first → secret → functions → build/commit/push.**

---

## 0. Sanity — see what's pending

```
npx supabase migration list
git status
```
You should see two new local migrations not yet Remote: `20260715140000_edge_hardening` and
`20260715150000_db_nits`, plus modified/new files under `src/`, `supabase/`, `public/`.

---

## 1. Apply the two new DB migrations to prod (Phases 4 + 5)

```
npx supabase db push
```
This applies:
- `20260715140000_edge_hardening.sql` — `processed_webhooks` (webhook idempotency) + `rate_limit_events` + `rate_limit_hit()` (shared rate limiter). Service-role only, RLS on.
- `20260715150000_db_nits.sql` — `admins` table + membership-based `is_admin()`, `safe_uuid()` + hardened `canvas-media`/`note-media` storage policies.

Verify:
```
npx supabase migration list
```
Both should now show under **Remote**. (Both were tested on a real Postgres 18 and re-run cleanly — idempotent.)

> Prefer the SQL Editor? Open each of the two files in `supabase/migrations/` and paste its contents into the Supabase SQL Editor instead. They're safe to re-run.

---

## 2. Set the required secret for the webhook fail-closed (L2)

The webhook now **rejects live events if `DODO_BUSINESS_ID` is unset** (fail-closed). Set it (find your business id in the Dodo dashboard):

```
npx supabase secrets set DODO_BUSINESS_ID=your_dodo_business_id_here
```
When you flip to production also ensure:
```
npx supabase secrets set DODO_PAYMENTS_ENVIRONMENT=live
```
(In `test` mode an unset business id is still allowed, so dev keeps working.)

---

## 3. Deploy the 4 edge functions (Phase 4 code)

```
npx supabase functions deploy dodo-create-checkout
npx supabase functions deploy dodo-portal
npx supabase functions deploy send-due-reminders
npx supabase functions deploy dodo-webhook --no-verify-jwt
```
(`dodo-webhook` keeps `--no-verify-jwt` — Dodo can't send a Supabase JWT; it's authenticated by the HMAC signature.)

> These call the tables from step 1. Deploying them before step 1 wouldn't crash (the rate limiter fails open and the idempotency insert is non-fatal), but do step 1 first anyway.

---

## 4. Build, commit, and push the frontend (Phases 2 + 3 + UI)

Cloudflare Pages auto-deploys on push — that's what ships `public/_headers` (CSP + headers) and `public/theme-init.js`.

```
npm run build
```
(If the build is clean, commit. Suggested grouped commits — or just `git add -A` and use the combined message.)

```
git add -A
git commit -m "feat(security): CSP + headers, edge-fn hardening, admins table, storage-cast safety; fix(canvas): collapsible mobile toolbar (Phases 3-5 + UI)"
git push
```

Prefer separate commits? Use these messages:
- `feat(security): add CSP + security headers and sandbox embed iframes (M2, L6)`
- `fix(security): harden edge functions — generic errors, webhook idempotency + business_id fail-closed, shared rate limit, hashed cron secret (M3, L2–L5)`
- `fix(security): admins table for is_admin, robust storage-path casts, localStorage docs (I1–I3)`
- `fix(canvas): collapse the canvas toolbar on mobile so it stops eating the screen`

---

## 5. Verify (5 min)

**Headers / CSP (Phase 3):**
```
curl -I https://project-management-app-dev.pages.dev/
```
Look for `content-security-policy`, `x-frame-options: DENY`, `x-content-type-options: nosniff`.
Then open the app in Chrome DevTools → Console and click through: a board, a note with a YouTube/Loom embed, a canvas with an embed, and make a realtime edit. **There should be no CSP violation errors, fonts should load, and Supabase REST + WebSocket should connect.** If one origin is blocked, widen only that directive in `public/_headers` (comments in the file explain each).

**Edge functions (Phase 4):** in Dodo test mode, replay a webhook delivery — the **second delivery should be a no-op** (idempotency). Trigger a checkout error path and confirm the browser only sees a generic "Something went wrong" (no internal detail). Confirm reminders still send.

**DB (Phase 5):** the admin gate still works for you (`jaiakashj121420004@gmail.com` was seeded into `admins`); media still loads; a deliberately malformed storage object name is denied, not a 500.

**Mobile UI:** on your phone, open a canvas — the toolbar now shows a **"Tools"** toggle and stays collapsed until tapped, so it no longer eats the canvas. (See `UI-UX-AUDIT-2026-07-16.md` for the bottom-nav and drawer items I flagged for you to eyeball — those weren't changed blind.)

---

## What each file is

| File | Phase | What |
|------|-------|------|
| `public/_headers` | 3 | CSP + security headers (Cloudflare) |
| `public/theme-init.js` + `index.html` | 3 | inline theme script externalised for strict CSP |
| `src/features/editor/nodes/NoteEmbedView.tsx`, `src/features/canvas/MediaLayer.tsx` | 3 | iframe `sandbox` |
| `supabase/migrations/20260715140000_edge_hardening.sql` | 4 | webhook idempotency + shared rate limiter |
| `supabase/functions/*` (all 4) | 4 | M3/L2/L3/L4/L5 hardening |
| `supabase/migrations/20260715150000_db_nits.sql` | 5 | admins table + safe_uuid + storage policies |
| `plan.md` | 5 | localStorage/retention note (I3) |
| `src/features/canvas/CanvasToolbar.tsx` | UI | collapsible mobile toolbar |
| `UI-UX-AUDIT-2026-07-16.md` | UI | audit + patches to eyeball on-device |
| `marketing-site/index.html` | — | premium marketing website (open in a browser) |
| `reports/Aurora_Publishing_Marketing_Revenue_Report.pdf` | — | app-store publishing + revenue model |
| `reports/Aurora_Penetration_Test_Options_Report.pdf` | — | pen-test options + pricing |

That completes the full 5-phase security remediation (H1–L6, I1–I3). 🎉
