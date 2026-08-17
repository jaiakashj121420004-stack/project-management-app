# supabase/ — database migrations & auth config

SQL migrations live in [`migrations/`](./migrations), named `<timestamp>_<name>.sql`
and applied in order. They are the source of truth for the schema (plan.md §5)
and the Row Level Security policies (plan.md §6).

## Applying a migration

Pick whichever is easiest — they run the same SQL:

- **Dashboard (simplest):** Supabase → **SQL Editor** → paste the file's contents → **Run**.
- **CLI:** `npx supabase link --project-ref <ref>` once, then `npx supabase db push`.

After the schema changes, regenerate the typed client (optional but recommended):

```
npx supabase gen types typescript --project-id <ref> > src/types/database.ts
```

> Until you run the generator, `src/types/database.ts` is hand-maintained to
> mirror these migrations.

## Auth provider setup (one-time, in the dashboard) — required for Phase 2

**Auth → Providers**

- **Email:** enabled. For local testing you can turn *Confirm email* off so sign-up
  logs you straight in; leave it **on** for production.
- **Google:** enable it and paste your Google OAuth **Client ID + Secret**
  (Google Cloud Console → Credentials → OAuth client). Add Supabase's callback
  `https://<ref>.supabase.co/auth/v1/callback` as an authorized redirect URI in Google.

**Auth → URL Configuration**

- **Site URL:** your production origin (e.g. `https://aurora.pages.dev`).
- **Redirect URLs:** add every origin you sign in from, including
  `http://localhost:5173/**` for local dev and your `*.pages.dev` URL. The app
  redirects OAuth and password-reset links back to these origins.

The service_role key is **never** needed by the app and must never be committed
or shipped to the browser (plan.md §6).

## Due-date email reminders (Phase 9 — optional, opt-in)

Email reminders are the reliable, works-when-the-app-is-closed half of the Phase 9
reminder system (the other half, in-app browser notifications, needs no setup —
users just toggle it on in **Profile → Reminders**). Email needs a one-time
server setup. **Skip this entire section if you don't want email reminders** —
everything else works without it.

It has three pieces: a migration, an Edge Function, and a cron schedule.

### 1. Apply the migration

Run [`migrations/20260621090000_reminders.sql`](./migrations/20260621090000_reminders.sql)
(SQL Editor or `db push`). It adds reminder prefs to `profiles`, a
`reminder_sent_for` dedupe column to `cards`, and two **service-role-only**
SECURITY DEFINER RPCs (`due_reminder_candidates`, `mark_reminders_sent`).

Then run [`migrations/20260622140000_custom_reminders.sql`](./migrations/20260622140000_custom_reminders.sql)
for the **Pro custom timed reminders** (P1): `cards.due_at` (a full deadline
timestamp, backfilled from `due_date` at 09:00 UTC), the `card_reminders` table
(per-card offsets, gated by `project_is_pro` so only Pro boards can create them),
the `card_reminder_dispatches` dedupe ledger, and two more service-role-only RPCs
(`due_time_reminder_candidates`, `mark_time_reminders_sent`). The same Edge
Function below now handles both paths.

### 2. Deploy the Edge Function

The function lives in [`functions/send-due-reminders/`](./functions/send-due-reminders).
It must run **without JWT verification** (the cron, not a logged-in user, calls
it; it authenticates itself with a shared secret instead):

```bash
npx supabase functions deploy send-due-reminders --no-verify-jwt
```

Set its secrets (these are **server-side only — never put them in `.env` or the
frontend**). `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the
Edge runtime automatically; you only set these three:

```bash
npx supabase secrets set \
  RESEND_API_KEY=re_xxx \
  REMINDER_FROM_EMAIL="Aurora <reminders@your-verified-domain.com>" \
  CRON_SECRET="$(openssl rand -hex 32)"
```

| Secret | What it is |
| ------ | ---------- |
| `RESEND_API_KEY` | A [Resend](https://resend.com) API key (free tier). For a quick test you can omit `REMINDER_FROM_EMAIL` and the function falls back to Resend's `onboarding@resend.dev` sender. |
| `REMINDER_FROM_EMAIL` | A verified sender on your Resend domain. |
| `CRON_SECRET` | A random string the scheduler sends in the `x-cron-secret` header so only the cron can invoke the function. |

> Using a different email provider? Swap the `sendEmail()` call in
> `functions/send-due-reminders/index.ts` for your provider's API — nothing else
> changes.

### 3. Schedule it (pg_cron + pg_net)

In the SQL Editor, enable the extensions and schedule the function **every 10
minutes** — the Pro timed reminders need that precision, and the day-based digest
self-dedupes (via `cards.reminder_sent_for`) so it still emails each card only
once. Replace `<ref>` and `<CRON_SECRET>` with your project ref and the secret:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'aurora-due-reminders',
  '*/10 * * * *',                    -- every 10 minutes (matches the function's window)
  $$
  select net.http_post(
    url     := 'https://<ref>.functions.supabase.co/send-due-reminders',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>'),
    body    := '{}'::jsonb
  );
  $$
);
```

Each run (a) emails every opted-in assignee a digest of cards entering their lead
window and marks them, and (b) sends each Pro `channel='email'` custom reminder
whose offset moment just arrived, recording it in `card_reminder_dispatches` so it
fires once per `due_at`. To stop it: `select cron.unschedule('aurora-due-reminders');`.

> **Already had the daily job?** Reschedule it in place — same name, new cadence:
>
> ```sql
> select cron.unschedule('aurora-due-reminders');
> -- then re-run the cron.schedule(...) above with '*/10 * * * *'
> ```

## Recurring Kanban cards (optional)

A card can repeat (daily free, weekly/monthly/custom-interval Pro — same rule
shape as to-do recurrence, see `src/lib/recurrence.ts`). Unlike to-dos, a card
has no "day being viewed" to lazily reseed against, so this needs a real cron —
same three pieces as due-date reminders above, and skippable for the same
reason: **skip this section if you don't want cards to auto-repeat** — creating,
editing, and viewing cards works fine without it; only the "next occurrence
never gets created" bit needs this setup.

### 1. Apply the migration

Run [`migrations/20260817130000_card_recurrence.sql`](./migrations/20260817130000_card_recurrence.sql)
(SQL Editor or `db push`). It adds `recurrence_rule` (jsonb) and
`recurrence_last_run_on` (dedupe marker) to `cards`, the
`enforce_card_recurrence_plan` gate (daily free, the rest need the project on
Pro via `project_is_pro`), the SQL mirror of `ruleMatchesDate()`
(`recurrence_rule_matches_date`), and the **service-role-only** SECURITY
DEFINER RPC that does the actual work, `run_due_card_recurrences()`.

### 2. Deploy the Edge Function

The function lives in
[`functions/create-recurring-cards/`](./functions/create-recurring-cards) — a
thin, auth-checked trigger for the RPC above, same shape as
`send-due-reminders`. It also runs **without JWT verification**:

```bash
npx supabase functions deploy create-recurring-cards --no-verify-jwt
```

It only needs `CRON_SECRET` — reuse the **same value** already set for
`send-due-reminders` if you have both features on (it's just a shared secret,
not tied to one function):

```bash
npx supabase secrets set CRON_SECRET="$(openssl rand -hex 32)"
```

### 3. Schedule it (pg_cron + pg_net)

Unlike reminders, this only needs to run **once a day** — a card's recurrence is
date-grained, not time-grained. Any time works; just after midnight UTC keeps
"today" consistent with `due_date`'s convention elsewhere in the app:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'aurora-card-recurrences',
  '5 0 * * *',                       -- once a day, 00:05 UTC
  $$
  select net.http_post(
    url     := 'https://<ref>.functions.supabase.co/create-recurring-cards',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>'),
    body    := '{}'::jsonb
  );
  $$
);
```

Each run creates one fresh new card (unchecked checklist, same labels/priority/
assignee, no carried-over comments/attachments/time entries) for every template
card whose rule matches today and hasn't already fired today. To stop it:
`select cron.unschedule('aurora-card-recurrences');`.

## Automations (optional, Pro/Team)

Rule-builder automations (Task 23 — "when a card moves to Done, assign it to
nobody", etc.). Two of the three trigger types (a card moving to a column, a
checklist reaching 100%) are plain Postgres triggers on `cards`/
`checklist_items` — **already active as soon as the migration below is
applied, no extra setup needed.** Only the third trigger, **a card's due date
passing**, needs the same kind of cron as due-date reminders / recurring cards
(nothing "writes" at the moment a date passes, so there's no row event to hook
a trigger onto): **skip this section if you don't plan to use the
"due date passes" trigger** — the other two automation triggers work fully
without it.

### 1. Apply the migration

Run [`migrations/20260817140000_automation_rules.sql`](./migrations/20260817140000_automation_rules.sql)
(SQL Editor or `db push`). It adds the `automation_rules` table + RLS
(gated by `project_is_pro()` + `can_edit_project()` for create/update — see
the migration's own comments), the two inline triggers, and the
**service-role-only** SECURITY DEFINER RPC for the due-date path,
`run_due_date_automations()`.

### 2. Deploy the Edge Function

The function lives in [`functions/run-automations/`](./functions/run-automations)
— a thin, auth-checked trigger for the RPC above, same shape as
`create-recurring-cards`/`send-due-reminders`. It also runs **without JWT
verification**:

```bash
npx supabase functions deploy run-automations --no-verify-jwt
```

It only needs `CRON_SECRET` — reuse the **same value** already set for the
other cron functions if you have more than one on (it's just a shared secret,
not tied to one function):

```bash
npx supabase secrets set CRON_SECRET="$(openssl rand -hex 32)"
```

### 3. Schedule it (pg_cron + pg_net)

Every 10 minutes is generous enough that "the due date passed" never feels
delayed, while staying cheap to run:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'aurora-automations-due-date',
  '*/10 * * * *',
  $$
  select net.http_post(
    url     := 'https://<ref>.functions.supabase.co/run-automations',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>'),
    body    := '{}'::jsonb
  );
  $$
);
```

Each run fires the "due date passed" action at most once per (rule, card) —
tracked in `automation_rule_fires`, the same one-shot-dedupe idea as
`reminder_sent_for`/`recurrence_last_run_on`. To stop it:
`select cron.unschedule('aurora-automations-due-date');`.

## Dodo Payments billing (optional)

The app has a **Free** vs **Pro** plan. The free limits are enforced in the
database, and the only thing that flips a user to Pro is the **verified Dodo
webhook** — the browser never sets `profiles.plan`. Skip this whole section to
keep the app free + unlimited.

> **Dodo Payments replaced Stripe.** Dodo is a **Merchant of Record**: it is the
> seller of record, so it collects payment, **localizes the currency**, and
> **remits sales tax / VAT** for you. Stripe was never activated, so the switch
> needs no data migration.

Pieces: a migration, three Edge Functions, Dodo dashboard config, and secrets.
Do all of this in Dodo **Test mode** first (API base `https://test.dodopayments.com`);
flip to live later (`https://live.dodopayments.com`).

### 1. Apply the migration
Run [`migrations/20260622120000_dodo_billing.sql`](./migrations/20260622120000_dodo_billing.sql)
(SQL Editor or `db push`). It swaps the Stripe id columns on `profiles` for
`dodo_customer_id` / `dodo_subscription_id` and extends the billing-column guard
trigger so those (plus `plan` / `plan_status`) stay writable **only** by the
service role. (`plan`, `plan_status`, the free-tier limit triggers,
`current_plan()` and `project_is_pro()` are unchanged from the earlier
`20260621210000_billing.sql`, so apply that first if you haven't.)

### 2. Create the Dodo products (test mode)
In the Dodo dashboard (**Test mode**): create **two subscription products** —
"Aurora Pro Monthly" ($5.99 / month) and "Aurora Pro Annual" ($68.29 / year =
12 × $5.99 − 5%). Copy each **product id** (`pdt_…`):
- monthly → `DODO_PRODUCT_PRO_MONTHLY` (test value: `pdt_0NhalBvSKlS70L1sUMkur`)
- annual  → `DODO_PRODUCT_PRO_ANNUAL`  (test value: `pdt_0Nhalv2OMQi73YMxXuxm8`)

Product ids differ between test and live, which is why they're passed via env
(never hardcoded). Also copy your **API key** (Developer → API Keys) →
`DODO_PAYMENTS_API_KEY`. (If you only create the monthly product, annual checkout
safely falls back to it.)

### 3. Deploy the three functions
```bash
npx supabase functions deploy dodo-create-checkout
npx supabase functions deploy dodo-portal
npx supabase functions deploy dodo-webhook --no-verify-jwt
```
The webhook **must** be `--no-verify-jwt` (Dodo can't send a Supabase JWT; it
proves authenticity with a Standard Webhooks signature instead). The other two
require a logged-in user's JWT, so deploy them normally.

### 4. Add the webhook endpoint
Dodo → **Developer → Webhooks → Add endpoint**:
`https://<ref>.supabase.co/functions/v1/dodo-webhook`. The handler acts on the
subscription lifecycle events: `subscription.active`, `subscription.renewed`,
`subscription.on_hold`, `subscription.cancelled`, `subscription.expired`,
`subscription.failed`. Copy the endpoint's **Signing secret** (`whsec_…`) →
`DODO_WEBHOOK_SECRET`.

### 5. Set the secrets
```bash
npx supabase secrets set \
  DODO_PAYMENTS_API_KEY=xxx \
  DODO_WEBHOOK_SECRET=whsec_xxx \
  DODO_PRODUCT_PRO_MONTHLY=pdt_xxx \
  DODO_PRODUCT_PRO_ANNUAL=pdt_xxx \
  APP_URL=https://project-management-app-dev.pages.dev
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically. The
functions default to Dodo **test** mode; for production also set
`DODO_PAYMENTS_ENVIRONMENT=live` (it selects the `https://live.dodopayments.com`
API base).

### Go-live checklist (before charging real cards)
- Re-create the products in **live** mode, swap the **test** API key + product
  ids + `DODO_WEBHOOK_SECRET` (from the live endpoint) for live ones, and set
  `DODO_PAYMENTS_ENVIRONMENT=live`.
- Point `APP_URL` at your production origin; confirm the Supabase Auth **Site
  URL** + redirect allow-list match it.
- Have a lawyer review the `/terms` and `/privacy` pages (shipped as templates).
- Re-confirm the webhook signature check; ensure no `service_role` or Dodo key is
  in the frontend. Consider rate-limiting and the invitation email-ownership note
  (decision log, 2026-06-20) before going public.

## Pro feature foundation (P0 — required before any Pro feature)

Foundation only — no end-user Pro feature yet. It adds the database-side gate and
storage that the upcoming Pro features (custom reminders, collaboration, the Notes
Canvas — see [`../prompts.md`](../prompts.md)) build on.

### Apply the migration
Run [`migrations/20260622000000_pro_foundation.sql`](./migrations/20260622000000_pro_foundation.sql)
(SQL Editor or `db push`). It adds:
- **`project_is_pro(project)`** — a `SECURITY DEFINER` helper that returns whether
  the project **owner** is on Pro. It's the real gate for every future Pro table
  and the Storage policies below (the UI's `useIsPro()` / `<ProGate>` is UX only).
- A **private `canvas-media` Storage bucket** with RLS on `storage.objects`: any
  project **member** may read an object (so signed URLs work); only a member of a
  **Pro** board may insert/update/delete. The path convention is
  `<projectId>/<noteId>/<file>`; the policies parse the projectId from the first
  path segment.

No dashboard config is needed — the bucket is created by the migration. Because it
runs `create policy` on `storage.objects`, run it as the project owner (the SQL
Editor does this).

### File-size caps
The bucket's `file_size_limit` is a hard server ceiling of **100 MiB** (the largest
per-type cap). The finer per-type caps (**image ≤ 10 MB, audio ≤ 25 MB, video ≤
100 MB**) and the MIME allow-list live in
[`../src/lib/proFeatures.ts`](../src/lib/proFeatures.ts) and are enforced
client-side in [`../src/lib/storage.ts`](../src/lib/storage.ts) before upload — a
single bucket limit can't express per-type byte caps. Keep the migration's
`file_size_limit` in sync with `MEDIA_CAPS.video.maxBytes`.

## Pro collaboration (comments, reactions, review, activity, notifications)

Adds the Pro collaboration layer: threaded **comments** with @mentions, emoji
**reactions**, a card **review** flow, an append-only **activity log**, and a
**notification** inbox (the Topbar bell). All of it is Pro-gated on the board
owner's plan (`project_is_pro`) and streamed over Realtime.

Two one-time steps — a migration and (if email notifications are wanted) a
redeploy of the existing reminders function. **No new secret.**

### 1. Apply the migration
Run [`migrations/20260622160000_collaboration_pro.sql`](./migrations/20260622160000_collaboration_pro.sql)
(SQL Editor or `db push`). It:
- Creates `comments`, `comment_mentions`, `reactions`, `activity_log`,
  `notifications`, and adds `review_status` / `review_assignee_id` /
  `reviewed_by` / `reviewed_at` to `cards`.
- Adds the RLS (read = member; comments/reactions **INSERT** require
  `project_is_pro` — the real Pro gate) and the `SECURITY DEFINER` triggers that
  write the activity log + notifications (those tables have **no client INSERT
  policy** — only the triggers write them).
- **Realtime:** adds `comments`, `comment_mentions`, `reactions`, `activity_log`,
  and `notifications` to the `supabase_realtime` publication with `REPLICA
  IDENTITY FULL` (idempotent), exactly like Phase 8. No dashboard action needed
  if Realtime is already enabled for the project (it is by default).

### 2. (Optional) Email notifications
There is **no new Edge Function**. The existing `send-due-reminders` function
gained a third pass that emails un-emailed notifications (mentions / replies /
reviews) for users who have email reminders on, via the service-role RPCs
`notification_email_candidates` / `mark_notifications_emailed`. If you've already
set up due-date email reminders (Resend key + `CRON_SECRET` + the 10-min cron),
just **redeploy** the function to pick up the change:

```bash
supabase functions deploy send-due-reminders --no-verify-jwt
```

In-app notifications (the bell) need nothing server-side beyond the migration.

## Aurora MCP server (Claude Desktop/Code integration, Pro)

Lets a Pro+ user connect Claude Desktop or Claude Code straight to their Aurora
account — Claude can list/read/write their boards, to-dos, and notes. Full
design record (why a dedicated JWT signing key, why not OAuth/`generateLink`)
and the end-user "how do I connect Claude" steps live in
[SETUP-MCP.md](../SETUP-MCP.md). This section is the deploy checklist.

Two Edge Functions, one migration, and one Supabase Dashboard step (a new,
dedicated JWT signing key — do **not** reuse the project's default one).

### 1. Apply the migration

Run [`migrations/20260816120000_mcp_tokens.sql`](./migrations/20260816120000_mcp_tokens.sql)
(SQL Editor or `db push`). It adds `mcp_token_hash` / `mcp_token_created_at` /
`mcp_token_last_used_at` to `profiles` and a service-role-only write trigger,
mirroring `protect_calendar_feed_token()`.

### 2. Add a dedicated JWT signing key (one-time, dashboard)

Dashboard → **Auth → JWT Signing Keys** → add a new key (a generated shared
secret is fine; HS256). This is intentionally **separate** from the project's
default session-signing key — `mcp-server` mints short-lived (5 min) tokens
with this key only, so if the integration is ever compromised you can revoke
just this key without signing out every real user session. Copy the secret
(and the Key ID, if the dashboard shows one).

### 3. Deploy the two functions

```bash
supabase functions deploy mcp-token
supabase functions deploy mcp-server --no-verify-jwt
```

`mcp-token` stays JWT-verified (it's called by the signed-in app, like
`calendar-feed-token`). `mcp-server` is `--no-verify-jwt` — its callers present
Aurora's own access token, not a Supabase session JWT, so Supabase's platform
JWT gate would otherwise reject them before `mcp-server`'s own auth ever runs
(same reason as `calendar-feed` and `dodo-webhook`).

### 4. Set the secrets

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
injected by the Edge runtime automatically; you only set these:

```bash
npx supabase secrets set \
  APP_URL="https://your-app.pages.dev" \
  MCP_JWT_SIGNING_SECRET="<the secret from step 2>" \
  MCP_JWT_SIGNING_KEY_ID="<the Key ID from step 2, if shown>"
```

| Secret | What it is |
| ------ | ---------- |
| `APP_URL` | Only used by `mcp-token` for CORS (it's called from the signed-in app). |
| `MCP_JWT_SIGNING_SECRET` | The dedicated signing key's shared secret from step 2. `mcp-server` uses it to mint short-lived, per-request user access tokens so tool calls run under real Row Level Security — see the file header of `functions/mcp-server/index.ts` for the full rationale. |
| `MCP_JWT_SIGNING_KEY_ID` | Optional — the signing key's Key ID, sent as the minted token's `kid` header so verification picks the right key on a project with more than one active signing key. Safe to omit on a single-key project. |

### Rate limiting

Both functions use the same shared `rate_limit_hit()` sliding-window limiter as
the rest of this repo (no new infrastructure). `mcp-token` is capped like the
other self-serve account endpoints (10/min); `mcp-server` allows 60 tool calls/
minute per token — generous for an agentic client calling several tools per
turn, real enough to stop a runaway loop.

## Public read-only project share links (2026-08-16)

Lets a project owner turn on a `/share/:token` link that anyone can open —
no Aurora account — to see a stripped-down, read-only view of the board
(columns/cards/labels/due dates only). One new migration, one new Edge
Function. Full design rationale lives in the migration's own header comment.

### 1. Apply the migration

Run [`migrations/20260816150000_project_share_links.sql`](./migrations/20260816150000_project_share_links.sql)
(SQL Editor or `db push`). Adds `project_share_links` with owner-only RLS
(reuses the existing `is_project_owner()` helper — no new SECURITY DEFINER
function needed) and a trigger that only allows revoking, never repointing,
an existing link.

### 2. Deploy the function

```bash
supabase functions deploy project-share --no-verify-jwt
```

`--no-verify-jwt` because the callers are anonymous browsers hitting a plain
URL with no Supabase session (same reason as `calendar-feed`). Create/revoke
themselves need **no** new function — they're plain RLS-gated table writes
from the signed-in app, like any other owner-only mutation.

### 3. Secrets

Uses the same `APP_URL` secret already set for the other functions (CORS
allow-list origin) plus the Edge-runtime-provided `SUPABASE_URL` /
`SUPABASE_SERVICE_ROLE_KEY` — nothing new to set if you've deployed any other
function in this project already.

### Rate limiting

Same shared `rate_limit_hit()` limiter, keyed by the caller's forwarded IP
(there's no session to key on) — 30 requests/minute, generous for a real
viewer, capped against token-guessing.
