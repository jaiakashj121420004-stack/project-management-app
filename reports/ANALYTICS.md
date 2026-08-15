# ANALYTICS.md — funnel event schema reference

> Reference doc for the minimal funnel-tracking layer added 2026-08-15 (see
> `memory.md`'s done-log entry for the same date for the design decisions). This
> is a schema reference, not a spec — read `src/lib/analytics.ts` and
> `supabase/functions/track-event/index.ts` for the actual implementation.

## What this is (and isn't)

A thin, privacy-respecting funnel-tracking layer — eight allow-listed events,
one Postgres table, no dashboard. It exists to answer "where do people drop off
between landing on the site and paying," not to be a general analytics
platform. No page-view auto-tracking, no session replay, no click-heatmaps, no
third-party analytics vendor, no PII fields.

**Querying:** there is no admin UI (deliberately out of scope for this change —
a future task). Query `analytics_events` directly via Supabase Studio → SQL
Editor. The table denies all client (anon/authenticated) reads and writes via
RLS — only the `track-event` Edge Function and the Dodo webhook (service role)
can write it, and only a Studio SQL query (service/postgres role) can read it.

## How identity works

- **`anonymous_id`** — a random UUID minted client-side on first use
  (`crypto.randomUUID()`), persisted in `localStorage`, NOT derived from
  anything PII. This is the one thread that ties an anonymous landing-page
  visit to a signup, and (via Dodo checkout metadata) all the way to a paid
  conversion — see `checkout_completed` below.
- **`user_id`** — stamped server-side by the `track-event` Edge Function from
  the caller's JWT (or left `null` for a signed-out caller). Never trusted from
  the request body.
- **First-touch attribution** (`utm_source`/`utm_medium`/`utm_campaign`/
  `utm_term`/`utm_content`/`referrer`/`landing_path`) is captured once per
  browser on the first landing-page visit (`captureLandingAttribution()`) and
  auto-merged into `signup_started`/`signup_completed`'s properties.

## Events

| Event | Fired from | Fires | Key properties |
|---|---|---|---|
| `landing_page_viewed` | `LandingPage.tsx` (mount) | Every landing-page view (`/`, `/preview`) | — (attribution capture happens alongside, not as a property) |
| `signup_started` | `SignUpPage.tsx` | On valid form submit (email) or the Google button click | `method: 'email' \| 'google'` |
| `signup_completed` | `SignUpPage.tsx` | When `signUp` succeeds (email only — see note) | `method: 'email'`, `needs_confirmation: boolean` |
| `first_board_created` | `useProjects.ts` (`useCreateProject`) | Once per browser, when the user's project list was empty right before this insert | — |
| `first_card_created` | `useBoard.ts` (`useAddCard`) | Once per browser, on the first successful card insert | `project_id` |
| `upgrade_prompt_shown` | `ProGate.tsx` (generic, covers every Pro-gated feature), `ProjectsPage.tsx` (project limit), `MembersPanel.tsx` (member limit) | Whenever an upgrade CTA renders because of a plan limit | `limit` (e.g. `'project_limit'`, `'member_limit'`, or a `ProGate` feature title), `plan`, `detail` (e.g. `"4th board"`, `"3rd collaborator"`) — this is the single most useful property per the funnel report §4 |
| `checkout_started` | `useBilling.ts` (`go()`) | When the user clicks Upgrade and checkout begins (before the redirect, so a failed session-creation call still counts) | `plan`, `interval` |
| `checkout_completed` | `dodo-webhook/index.ts` (server, NOT the client redirect) | Once per new subscription, on Dodo's `subscription.active` first-activation event — never on renewals/plan-changes | `plan`, `product_id` |

### Notes on specific events

- **`signup_completed` (Google OAuth)** — not fired. Google is a full-page
  redirect through Supabase's OAuth callback; `SignUpPage.tsx` never sees the
  browser again, and there's no reliable way from there to tell a brand-new
  signup apart from a returning Google login. `signup_started` with
  `method: 'google'` is what's honestly measurable.
- **`checkout_completed` is the one server-confirmed event.** It's written by
  the Dodo webhook, never the client's `/billing?status=success` redirect —
  that redirect only means Dodo sent the browser home, not that the
  subscription is active (same "never trust the client redirect" principle the
  webhook already applies to the plan flip itself). The client's
  `createCheckoutUrl()` call forwards `anonymous_id` through Dodo's checkout
  `metadata` specifically so the webhook — which runs server-side with no
  access to the browser's `localStorage` — can still tag this event with the
  same browser thread as every earlier funnel event.
- **`first_board_created` / `first_card_created`** are lifetime, once-per-browser
  milestones (guarded in `src/lib/analytics.ts`, not per-project) — they answer
  "did this user activate at all," not "how many boards/cards has this user
  ever made."

## Server-side allow-list & validation (`track-event` Edge Function)

- `event_name` must be one of the eight events above — anything else is
  rejected with a deliberately vague error (no allow-list enumeration).
- `properties` must be a flat object of ≤ 30 keys, each a string/number/
  boolean/null leaf (no nesting), string values ≤ 500 chars, serialized
  payload ≤ 4 KB.
- `anonymous_id` must be a well-formed UUID or it's dropped (set to `null`).
- Rate-limited (40 events / 60s per caller — signed-in user id, else
  `anonymous_id`, else IP) via the same shared `rate_limit_hit()` Postgres
  counter the billing Edge Functions use
  (`supabase/migrations/20260715140000_edge_hardening.sql`). Fails open on a
  limiter error, same as those functions.

## Adding a new event

1. Add the name to `ALLOWED_EVENTS` in
   `supabase/functions/track-event/index.ts` AND `ANALYTICS_EVENTS` in
   `src/lib/analytics.ts` (kept as two hand-synced lists, same as this repo's
   other Deno/Vite boundaries — there's no shared build step between them).
2. Call `track('your_event_name', { ...properties })` at the call site.
3. Add a row to the table above.
