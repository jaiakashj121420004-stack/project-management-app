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

In the SQL Editor, enable the extensions and schedule a daily run (e.g. 8am UTC).
Replace `<ref>` and `<CRON_SECRET>` with your project ref and the secret above:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'aurora-due-reminders',
  '0 8 * * *',                       -- daily at 08:00 UTC
  $$
  select net.http_post(
    url     := 'https://<ref>.functions.supabase.co/send-due-reminders',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>'),
    body    := '{}'::jsonb
  );
  $$
);
```

Each run emails every assignee who opted in a digest of their cards due within
their chosen lead window, then marks those cards so they aren't emailed again for
the same due date. To stop it: `select cron.unschedule('aurora-due-reminders');`.

## Stripe billing (Phase 10 — optional)

Phase 10 adds a **Free** vs **Pro** plan. The free limit (3 projects) is enforced
in the database, and the only thing that flips a user to Pro is the **verified
Stripe webhook** — the browser never sets `profiles.plan`. Skip this whole
section to keep the app free + unlimited.

Pieces: a migration, three Edge Functions, Stripe dashboard config, and secrets.

### 1. Apply the migration
Run [`migrations/20260621210000_billing.sql`](./migrations/20260621210000_billing.sql)
(SQL Editor or `db push`). It adds `plan` + Stripe id columns to `profiles`, a
trigger enforcing the free 3-project cap, a trigger that makes the billing
columns writable **only** by the service role, and the `current_plan()` helper.

### 2. Create the Stripe product (test mode)
In the Stripe dashboard (toggle **Test mode**): **Products → add product**
"Aurora Pro" with a **recurring** monthly price. Copy:
- the **Price ID** (`price_…`) → `STRIPE_PRICE_PRO`
- your **secret key** (`sk_test_…`, Developers → API keys) → `STRIPE_SECRET_KEY`

Enable the **Customer Portal** (Settings → Billing → Customer portal) so "Manage
billing" works.

### 3. Deploy the three functions
```bash
npx supabase functions deploy create-checkout-session
npx supabase functions deploy create-portal-session
npx supabase functions deploy stripe-webhook --no-verify-jwt
```
The webhook **must** be `--no-verify-jwt` (Stripe can't send a Supabase JWT; it
proves authenticity with a signature instead). The other two require a logged-in
user's JWT, so deploy them normally.

### 4. Add the webhook endpoint
Stripe → **Developers → Webhooks → Add endpoint**:
`https://<ref>.supabase.co/functions/v1/stripe-webhook`, listening for exactly:
`checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`. Copy its **Signing secret** (`whsec_…`) →
`STRIPE_WEBHOOK_SECRET`.

### 5. Set the secrets
```bash
npx supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_xxx \
  STRIPE_WEBHOOK_SECRET=whsec_xxx \
  STRIPE_PRICE_PRO=price_xxx \
  APP_URL=https://project-management-app-dev.pages.dev
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

### Go-live checklist (before charging real cards)
- Swap the **test** key/price/webhook for **live** ones (and update
  `STRIPE_WEBHOOK_SECRET` from the live endpoint).
- Point `APP_URL` at your production origin; confirm the Supabase Auth **Site
  URL** + redirect allow-list match it.
- Have a lawyer review the `/terms` and `/privacy` pages (shipped as templates).
- Re-confirm the webhook signature check; ensure no `service_role` key is in the
  frontend. Consider rate-limiting and the invitation email-ownership note
  (decision log, 2026-06-20) before going public.
