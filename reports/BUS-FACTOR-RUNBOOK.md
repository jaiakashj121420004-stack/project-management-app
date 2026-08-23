# BUS-FACTOR-RUNBOOK.md — if I disappear tomorrow

> Operational "who has access to what, and how do I get back in" knowledge that
> lives only in the maintainer's head right now. This is **not** the spec —
> for architecture read [plan.md](./plan.md), for current build state read
> [memory.md](./memory.md), for day-to-day workflow rules read
> [CLAUDE.md](./CLAUDE.md). This doc only covers what those don't: access,
> redeploy-from-scratch, third-party contacts, migration workflow, and
> fire-drill triage. No secret values are printed here — only where they live.

---

## 1. Where every secret/credential lives

Golden rule (from `SETUP.md`): the app only ships two **public** values to the
browser — `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Everything else
below is server-side-only and must never appear in the frontend, `.env`, or a
commit.

| What | Where it lives | Notes |
| --- | --- | --- |
| Supabase project | Dashboard, project ref **`rpwklsrdfqyisogbcdgg`** | Settings → API for URL/anon key. `service_role` key and DB password: Settings → API / Settings → Database — **never commit, never paste into chat**. |
| Supabase `service_role` key | Supabase dashboard only | Injected automatically into Edge Functions at runtime (`SUPABASE_SERVICE_ROLE_KEY`) — never set it manually as a frontend var. |
| Supabase Edge Function secrets | Supabase dashboard → Edge Functions → Secrets (or `npx supabase secrets set`) | See §1a for the full list of which secrets exist. |
| GitHub repo | <https://github.com/jaiakashj121420004-stack/project-management-app> | Account handle `jaiakashj121420004-stack`. Two-factor authentication **enabled** 2026-08-23 (confirmed via Settings → Password and authentication, "Two-factor authentication: Enabled"; preferred method set to passkey). Recovery codes were downloaded — keep them outside this repo. |
| Cloudflare Pages | Project **`project-management-app-dev`** → `https://project-management-app-dev.pages.dev` | Custom domain `aurora.nvexis.com` is live on top of this (see §1b). Build command `npm run build`, output dir `dist`, env vars = the same two `VITE_` values. Auto-deploys on push to `main`. |
| Cloudflare account / DNS | Cloudflare dashboard | Also holds DNS for `nvexis.com` (nameservers cut over from Namecheap — see §1b). |
| Domain registrar | Namecheap, registrant of `nvexis.com` | Nameservers now point at Cloudflare; renewal/ownership still lives at Namecheap. |
| Dodo Payments (billing, Merchant of Record) | Dodo dashboard | Test mode is live and verified end-to-end (webhook → Pro upgrade). **Live mode is not yet active** — KYC (Individual account) was submitted and was under review as of 2026-07-19; check status before assuming live billing works. |
| Resend (transactional email) | Resend dashboard | Used for due-date/reminder emails via the `send-due-reminders` function. Sending domain `mail.nvexis.com` verified 2026-08-23 (DKIM/SPF/DMARC in Cloudflare DNS); `REMINDER_FROM_EMAIL` is set to `Aurora <reminders@mail.nvexis.com>` in Supabase Edge Function secrets. |
| Google Cloud / Google OAuth | Google Cloud Console, project **`aurora-499806`** | Auth Platform → Branding holds the "Sign in with Google" app name/logo/authorized domain (`nvexis.com`) config. OAuth Client ID starts `594602749460-q15m...` — must match the Client ID configured in Supabase's Google auth provider. |
| `.env` (local dev secrets) | Project root, gitignored | Copy from `.env.example`. Holds only the two `VITE_` values — nothing else belongs here (see the header comment in `.env.example` for the full list of what's deliberately excluded). |

### 1a. Supabase Edge Function secrets that exist today

Grouped by feature (full setup instructions for each are in
`supabase/README.md`):

- **Email reminders:** `RESEND_API_KEY`, `REMINDER_FROM_EMAIL` (set to
  `Aurora <reminders@mail.nvexis.com>`, 2026-08-23), `CRON_SECRET`.
- **Dodo Payments billing:** `DODO_PAYMENTS_API_KEY`, `DODO_WEBHOOK_SECRET`,
  `DODO_PRODUCT_PRO_MONTHLY`, `DODO_PRODUCT_PRO_ANNUAL`,
  `DODO_PRODUCT_TEAM_MONTHLY`, `DODO_PRODUCT_TEAM_ANNUAL`, `APP_URL`
  (currently `https://aurora.nvexis.com`), `DODO_PAYMENTS_ENVIRONMENT`
  (unset = test mode; set to `live` to go live), `DODO_BUSINESS_ID` (optional
  fail-closed check on the webhook — confirm whether it's been set).
- **Aurora MCP server (Connect Claude):** `MCP_JWT_SIGNING_SECRET`,
  `MCP_JWT_SIGNING_KEY_ID` — signed with a **dedicated** JWT signing key
  (Supabase Dashboard → Auth → JWT Signing Keys), deliberately separate from
  the project's default session-signing key so it can be revoked without
  logging out real users.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically
  into every Edge Function — never set these by hand.

### 1b. ✅ RESOLVED (2026-08-16) — secret-hygiene incident, closed

`Aurora DODO PAYMENTS ks.txt` (tracked in git since `c926f22`) held a real
live Dodo API key, the Dodo webhook signing secret, and the dedicated
**MCP JWT signing secret** in plaintext. Confirmed exposed (git history on
GitHub, and briefly in a chat transcript while diagnosing it). **Full
remediation completed same day:**

1. **Rotated all three credentials at the source:**
   - Dodo dashboard → Developer → API Keys: old live key revoked, new one
     issued.
   - Dodo dashboard → Developer → Webhooks: signing secret rotated
     (new `whsec_...`).
   - Supabase Dashboard → Auth → JWT Keys: the dedicated MCP standby key
     was retired and revoked; a new HS256 standby key was created (imported
     from a locally-generated random secret so the value was known
     end-to-end), leaving the project's real session-signing **CURRENT KEY**
     (ECC P-256) untouched throughout — no user was ever logged out.
2. **New values set** via `npx supabase secrets set` for
   `DODO_PAYMENTS_API_KEY`, `DODO_WEBHOOK_SECRET`,
   `MCP_JWT_SIGNING_SECRET`, and `MCP_JWT_SIGNING_KEY_ID`.
3. **File removed from the repo** and git-ignored going forward
   (`Aurora*ks*.txt` pattern + exact filename added to `.gitignore`),
   committed as `bdeb552` and pushed to `main`.
4. `DODO_BUSINESS_ID` and the `pdt_...` product ids from the same file are
   identifiers, not credentials — left unchanged, no rotation needed.

**Optional remaining cleanup:** the *old, now-rotated* values still exist in
git history prior to `bdeb552`. They're inert (rotated), so this is hygiene
rather than urgent — a `git filter-repo`/BFG history scrub + force-push
would fully remove them if desired.

A second, similar file (`Aurora payment api.txt`) was found and safely
deleted earlier because it was gitignored and untracked — no rotation was
needed for that one.

---

## 2. Redeploy from scratch (new machine / environment lost)

1. **Clone:**
   ```
   git clone https://github.com/jaiakashj121420004-stack/project-management-app.git
   cd project-management-app
   npm install
   ```
2. **Local env:** copy `.env.example` → `.env`, fill in
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from Supabase dashboard →
   Settings → API (project ref `rpwklsrdfqyisogbcdgg`).
3. **Verify locally:**
   ```
   npm run typecheck
   npm run build
   ```
   Per `CLAUDE.md`, always run these on Windows via Command Prompt in the
   project folder as the real gate — this repo has a pre-existing `rolldown`
   native-binding mismatch when `node_modules` is installed over a mounted/
   bridged folder, so a cloud sandbox's `npm run build` can't be fully
   trusted; Windows-native is the source of truth.
4. **Reconnect Supabase (if the project itself is intact, just relinking a
   new machine):**
   ```
   npx supabase link --project-ref rpwklsrdfqyisogbcdgg
   npx supabase migration list     # confirms Local == Remote
   ```
   If migrations are out of sync, apply missing ones from
   `supabase/migrations/` in filename (timestamp) order — see §4.
5. **Reconnect Cloudflare Pages:** Workers & Pages → the existing
   `project-management-app-dev` project should already be connected to the
   GitHub repo and auto-deploying; if it needs to be recreated: Create →
   Pages → Connect to Git → this repo. Build command `npm run build`, output
   `dist`, env vars = the two `VITE_` values. Re-add the custom domain
   `aurora.nvexis.com` if it's a fresh Pages project (DNS at Cloudflare
   already points there via the Namecheap nameserver cutover, so this should
   just be "add custom domain" in the Pages project, not a DNS re-setup).
6. **Re-set Edge Function secrets** (see §1a for the full list) — these live
   only in the Supabase dashboard and are **not** recoverable from git; if a
   Supabase project is truly rebuilt from scratch (not just relinked), every
   secret in §1a must be regenerated/re-entered from each provider's
   dashboard (Resend, Dodo, and a freshly-generated MCP JWT signing key).
7. **Redeploy all Edge Functions** (from `supabase/functions/`):
   ```
   npx supabase functions deploy calendar-feed
   npx supabase functions deploy calendar-feed-token
   npx supabase functions deploy dodo-change-plan
   npx supabase functions deploy dodo-create-checkout
   npx supabase functions deploy dodo-portal
   npx supabase functions deploy dodo-webhook --no-verify-jwt
   npx supabase functions deploy mcp-server --no-verify-jwt
   npx supabase functions deploy mcp-token
   npx supabase functions deploy send-due-reminders --no-verify-jwt
   npx supabase functions deploy track-event
   ```
   (`--no-verify-jwt` only on the four listed — they're called by webhooks/
   cron/external tokens, not a logged-in Supabase session. Get this wrong and
   the function 401s on every legitimate call.)
8. **Re-schedule the reminders cron** (pg_cron, one-time SQL — see
   `supabase/README.md` → "Due-date email reminders" §3 for the exact
   `cron.schedule(...)` call, using the new `CRON_SECRET`).
9. **Auth provider config** (Supabase dashboard → Auth): re-enable Email +
   Google providers, re-add the Google OAuth Client ID/Secret (from Google
   Cloud project `aurora-499806`), and re-add redirect URLs
   (`localhost:5173`, the `*.pages.dev` URL, `aurora.nvexis.com`).
10. **Push:** `git push` — Cloudflare auto-deploys on push to `main`.

---

## 3. Third-party contacts / outage / billing

| Service | Support | Account identity |
| --- | --- | --- |
| **Supabase** | <https://supabase.com/dashboard/support> or status page <https://status.supabase.com> | Project ref `rpwklsrdfqyisogbcdgg`, org tied to the account signed up with `jaiakashj121420004@gmail.com`. |
| **Cloudflare** | <https://dash.cloudflare.com> → Support, status <https://www.cloudflarestatus.com> | Account holds both the Pages project and `nvexis.com` DNS. |
| **Dodo Payments** | Dodo dashboard → support/chat (Merchant of Record — they also own tax/VAT compliance, so billing disputes and refunds largely route through their support, not a payment processor). | Business/individual KYC account under the same signup email. `DODO_BUSINESS_ID` (if set) is the account-level identifier used in webhook validation. |
| **Resend** | <https://resend.com/docs> / dashboard support | No verified sending domain yet — outage here just means reminder emails silently don't send (the app itself is unaffected, in-app notifications still work). |
| **GitHub** | <https://support.github.com> | Repo: `jaiakashj121420004-stack/project-management-app`. |
| **Google Cloud (OAuth)** | <https://console.cloud.google.com> → Support | Project `aurora-499806`. An outage/lockout here breaks "Sign in with Google" only — email/password auth is unaffected. |
| **Namecheap** | <https://www.namecheap.com/support/> | Registrant of `nvexis.com`; only relevant for domain renewal/transfer, DNS itself is now managed at Cloudflare. |

---

## 4. Migration history / how schema changes are applied

Source of truth: [`supabase/migrations/`](./supabase/migrations), files named
`<timestamp>_<name>.sql`, applied **in filename order**. As of the last
audit, all 30+ local migrations are applied to prod and `supabase migration
list` confirms Local == Remote.

**Applying a new migration** (either works, they run the same SQL):
- **Dashboard:** Supabase → SQL Editor → paste the file → Run.
- **CLI:** `npx supabase link --project-ref rpwklsrdfqyisogbcdgg` (once), then
  `npx supabase db push`.

**Checking sync state:** `npx supabase migration list` — flags any local
migration not yet applied to prod, or vice versa.

**After a schema change**, regenerate the typed client (optional but
recommended, per `supabase/README.md`):
```
npx supabase gen types typescript --project-id rpwklsrdfqyisogbcdgg > src/types/database.ts
```
Until that's run, `src/types/database.ts` is hand-maintained to mirror the
migrations — check it's in sync after any schema change.

**RLS is the security model** — every table has Row Level Security on;
`supabase/tests/rls_regression.test.sql` plus a separate
`.github/workflows/rls-tests.yml` CI job guard against regressions. See
`plan.md` §6 for the full policy design, not duplicated here.

---

## 5. If something is on fire

**Where errors/logs actually surface today** (no Sentry or third-party error
tracker is wired up — this is the full list):

- **Frontend runtime errors:** nowhere centralized. The only signal is what a
  user reports, or what you catch by opening the live site's browser
  DevTools console yourself (`aurora.nvexis.com`).
- **Cloudflare Pages build/deploy failures:** Cloudflare dashboard → Workers
  & Pages → `project-management-app-dev` → Deployments tab — build logs per
  deploy.
- **Edge Function errors:** Supabase dashboard → Edge Functions → select the
  function → Logs tab (also reachable via `npx supabase functions logs
  <name>`).
- **Database/RLS errors:** Supabase dashboard → Logs → Postgres logs, or SQL
  Editor for direct inspection. `admin_audit_log` table records admin
  actions specifically (no UI to browse it yet — query it directly).
- **Cron job health:** SQL Editor →
  `select * from cron.job_run_details order by start_time desc limit 20;`
  to confirm `aurora-due-reminders` last ran and succeeded.
- **Webhook delivery:** Dodo dashboard → Developer → Webhooks → delivery log
  for `dodo-webhook`; cross-check against
  `select * from processed_webhooks order by created_at desc;` for dedup
  confirmation.

**Fastest path to rolling back a bad deploy:**

1. Cloudflare dashboard → Workers & Pages → `project-management-app-dev` →
   Deployments → find the last known-good deployment → **Rollback to this
   deployment** (instant, no rebuild needed). This only reverts the static
   frontend, not the database.
2. If the bad deploy also shipped a migration: migrations in this repo are
   additive/idempotent by convention (see the pattern in
   `supabase/migrations/`) — a schema rollback is not a one-command
   operation. Check the specific migration file for what it changed and write
   a reverse migration rather than trying to "undo" via the dashboard.
3. If a bad Edge Function deploy is the problem: redeploy the previous
   working version from git (`git checkout <prev-commit> --
   supabase/functions/<name> && npx supabase functions deploy <name>`).
4. For a Dodo webhook regression specifically: Dodo's dashboard lets you
   replay/redeliver webhook events after the fix is deployed — use it to
   catch up any missed `subscription.*` events rather than reconstructing
   state by hand.

---

## 6. Where the rest of the knowledge lives

- **Current build state, latest decisions, next step:** [memory.md](./memory.md)
- **Architecture, data model, design system, full security model:** [plan.md](./plan.md)
- **Day-to-day workflow rules (commit discipline, coding standards):** [CLAUDE.md](./CLAUDE.md)
- **First-time environment setup (new contributor, from zero):** [SETUP.md](./SETUP.md)
- **Connecting a user's Claude to their own Aurora account (MCP server):** [SETUP-MCP.md](./SETUP-MCP.md)
- **Edge Function / migration / secrets setup detail for every feature:** [supabase/README.md](./supabase/README.md)

This file's only job is what those don't cover: who has access to what, and
how to get back in. Keep it updated whenever a credential, account, or
deploy target changes — it goes stale fast otherwise.
