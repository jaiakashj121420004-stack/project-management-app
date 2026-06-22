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
