# Aurora — Internal Security Code Review

**Date:** 2026-07-15
**Reviewer:** Internal (pre-external-pen-test pass)
**Scope:** Database/RLS migrations, Supabase Edge Functions, and the React frontend (auth, secrets, XSS, input validation).
**Method:** Static code review only. No live attacks were run against production. This review **complements but does not replace** the external penetration test still required before go-live (see the scope-of-work at the end).

---

## Executive summary

The codebase is, overall, **unusually disciplined about security**. The hard multi-tenant primitives are implemented correctly: RLS is enabled on all 26 public tables, every `SECURITY DEFINER` function pins `search_path`, the payment webhook verifies its signature before doing anything, secrets never reach the browser, and there is a single HTML-injection sink that is properly DOMPurify-sanitized.

The review nonetheless found **one High-severity, remotely-exploitable issue** (plus a closely related Medium-High) that should be fixed **before** commissioning the external pen-test, because they're the kind of thing a tester will find in the first hour and they're a one-migration fix:

- **Two `SECURITY DEFINER` RPCs were never revoked from `PUBLIC`**, so they're callable directly with the anon key. One (`redeem_invitations_for`) lets an attacker join projects they weren't invited to; the other (`notify`) lets an attacker forge in-app notifications and trigger phishing emails.

Everything else is Medium or lower — mostly defense-in-depth (add a CSP) and info-leak polish.

### Findings at a glance

| # | Finding | Severity | Surface |
|---|---------|----------|---------|
| H1 | `redeem_invitations_for` callable by anon → unauthorized project membership | **High** | DB/RLS |
| H2 | `notify` callable by anon → forged notifications + phishing emails | **Medium-High** | DB/RLS |
| M1 | Co-members can read each other's billing IDs + reminder settings via `profiles` | Medium | DB/RLS |
| M2 | No Content-Security-Policy or security headers delivered | Medium | Frontend |
| M3 | Internal error messages returned to authenticated clients | Medium | Edge fns |
| L1 | Pro-status / id "oracle" helper functions granted to `authenticated` | Low | DB/RLS |
| L2 | `business_id` webhook check is fail-open when `DODO_BUSINESS_ID` unset | Low | Edge fns |
| L3 | No webhook idempotency/replay-dedup store | Low | Edge fns |
| L4 | Rate limiter is per-isolate, in-memory, fails open | Low | Edge fns |
| L5 | `timingSafeEqual` early-returns on length mismatch (leaks length) | Low | Edge fns |
| L6 | Third-party embed iframes have no `sandbox` attribute | Low | Frontend |
| I1 | Hardcoded admin email in a migration | Info | DB/RLS |
| I2 | Storage path `::uuid` cast can error on malformed object names | Info | DB/RLS |
| I3 | Query cache + auth tokens in `localStorage` (supabase-js default) | Info | Frontend |

---

## High / Medium-High (fix before pen-test)

### H1 — `redeem_invitations_for(uuid, text)` is callable by anon/authenticated → unauthorized project takeover

**Severity: High** (reachable with only the public anon key)
**File:** `supabase/migrations/20260620160000_collaboration.sql:113-142`

The function is `SECURITY DEFINER` and takes **caller-supplied** `p_user_id` and `p_email` — it does *not* derive them from `auth.uid()`. It deletes every invitation matching `p_email` and inserts `project_members(project_id, p_user_id, role)` for those invites, bypassing RLS because it runs as the definer.

Postgres grants `EXECUTE` to `PUBLIC` by default, and PostgREST exposes every `public`-schema function as `/rest/v1/rpc/redeem_invitations_for`. The server-only reminder RPCs in this repo were explicitly `revoke`d — this one was missed.

**Attack:** an attacker who knows (or guesses) an email that has a pending project invitation calls `redeem_invitations_for('<attacker_uuid>', '<invited_email>')`. The pending invite's project + role is written as a membership for the **attacker's** account, and the legitimate invite is consumed. The owner-protection trigger doesn't block it (role is editor/viewer, never owner).

**Fix (one line, safe to re-run):**
```sql
revoke all on function public.redeem_invitations_for(uuid, text) from public, anon, authenticated;
```
Internal callers (`redeem_my_invitations`, the signup trigger) are themselves `SECURITY DEFINER` and run as the owner, so they keep working after the revoke.

### H2 — `notify(uuid, uuid, text, jsonb)` is callable by anon/authenticated → notification & email injection

**Severity: Medium-High**
**File:** `supabase/migrations/20260622160000_collaboration_pro.sql:328-343`

Same root cause — a `SECURITY DEFINER` constructor left executable by `PUBLIC`. `notify` inserts into `notifications` (a table deliberately given **no INSERT policy** so only triggers write it). Exposed as an RPC, any caller can forge a notification for **any user id** with an **attacker-controlled `payload` jsonb** (fake "mention"/"reply" with arbitrary text). The reminder cron then picks up the un-emailed row and **emails the attacker's content** to the victim — an in-app + email phishing/spam vector.

**Fix:**
```sql
revoke all on function public.notify(uuid, uuid, text, jsonb) from public, anon, authenticated;
```
Triggers call it as owner and are unaffected.

> **Both fixes belong in one small idempotent migration** (e.g. `2026071600000_lock_definer_rpcs.sql`) plus the matching `revoke` applied to the live prod DB. I can write this for you.

---

## Medium

### M1 — Co-members can read each other's billing identifiers and reminder settings

**Severity: Medium** (PII / billing-data exposure)
**File:** policy `20260620160000_collaboration.sql:241-246` ("Profiles: select co-members"); sensitive columns added in `20260621210000` (`plan`, `plan_status`), `20260622120000` (`dodo_customer_id`, `dodo_subscription_id`), `20260621090000` (`reminder_emails_enabled`, `reminder_lead_days`).

RLS is row-level, so the co-member SELECT policy exposes the **entire `profiles` row** — including Dodo customer/subscription IDs and personal reminder prefs — to anyone who shares a project. Only `display_name`/`avatar_url` are needed for the members panel. The billing IDs are useful for support-desk social engineering and correlating a user to their payment account.

**Fix:** move billing columns to a separate `billing` table with an own-row-only policy, **or** serve co-member profile data through a `SECURITY DEFINER` view/function that returns only `id, display_name, avatar_url`, and make the base-table policy own-row-only.

### M2 — No Content-Security-Policy or security headers delivered

**Severity: Medium**
**File:** `index.html` (no CSP meta); no `public/_headers` file exists.

There's no CSP, `X-Frame-Options`, `X-Content-Type-Options`, or `Referrer-Policy`. The app defends XSS well today, but a CSP is the second layer that blunts any future sink and restricts where scripts/connections/frames may originate — the single biggest missing control for a multi-tenant SaaS.

**Fix:** add `public/_headers` (Cloudflare Pages reads it) scoped to the real origins:
```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-src https://www.youtube.com https://player.vimeo.com https://www.loom.com https://w.soundcloud.com; img-src 'self' data: blob: https:; base-uri 'self'; form-action 'self'
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
```
Tune `connect-src`/`frame-src` to exactly what's used, then verify at runtime.

### M3 — Internal error messages returned to authenticated clients

**Severity: Medium**
**Files:** `dodo-create-checkout/index.ts:179`, `dodo-portal/index.ts:130`.

`return json({ error: err.message }, 500)` sends raw exception text (e.g. `Dodo checkout failed: 401 <body>`, `Profile lookup failed: 500 <body>`) to the browser, leaking internal topology and upstream status codes.

**Fix:** keep `console.error(err)` server-side but return a generic body: `json({ error: 'Something went wrong. Please try again.' }, 500)`. Retain specific messages only for safe, expected cases (e.g. the existing "No billing account yet.").

---

## Low / Info (hardening — safe to schedule after launch)

- **L1 — Pro-status oracles.** `project_is_pro`/`user_is_pro`/`comment_project_id`/`comment_author_id`/`target_project_id` are granted to `authenticated` and return data for *any* id without a caller-access check (they're used inside policies where the surrounding predicate already scopes access). Revoke direct `EXECUTE` from `authenticated` where only policies call them. *(DB)*
- **L2 — `business_id` fail-open.** The webhook only matches `business_id` when `DODO_BUSINESS_ID` is set; every event still passes the HMAC check, so residual risk is low, but make the secret required in prod (fail closed). *(Edge)*
- **L3 — No webhook idempotency store.** Replay is bounded to the 5-min tolerance window and writes are idempotent; optionally persist processed `webhook-id`s with a unique constraint to shrink the window to zero. *(Edge)*
- **L4 — Rate limiter is per-isolate/in-memory/fails-open.** Fine as a first line on auth-gated endpoints; back it with a shared store (Postgres window counter or Redis) for a hard limit. *(Edge)*
- **L5 — `timingSafeEqual` length short-circuit.** Leaks whether the supplied value matches the secret's length; hash both inputs to a fixed length before the XOR loop to remove it. Low priority. *(Edge)*
- **L6 — Embed iframes lack `sandbox`.** The `src` is always an allow-listed provider (well done), but add `sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"` for containment. `NoteEmbedView.tsx`, `MediaLayer.tsx`. *(Frontend)*
- **I1 — Hardcoded admin email** in `20260621230000:16` (`is_admin()`). Not a secret, but move the admin principal to an `admins` table/config row instead of a literal. *(DB)*
- **I2 — Storage path cast robustness.** `split_part(name,'/',1)::uuid` can raise on a malformed object name (guarded by `bucket_id` first; no cross-tenant bypass). Wrap in `nullif(...,'')::uuid`/`CASE` like the realtime policy does. *(DB)*
- **I3 — `localStorage` cache + tokens.** supabase-js stores the session in `localStorage`, and the React Query cache persists board/note data there for offline use (wiped on `SIGNED_OUT`, 24h max-age). Standard for this architecture; note it in the privacy/data-retention docs. *(Frontend)*

---

## What is done well (verified, not assumed)

**Database:** RLS enabled on all 26 public tables; append-only tables (`activity_log`, `notifications`, `card_reminder_dispatches`) have RLS on with no INSERT policy so only triggers write them; every `SECURITY DEFINER` function pins `set search_path = ''` and schema-qualifies references (no privilege-escalation via search_path); INSERT/UPDATE policies carry matching role-aware `with check`; **plan self-escalation is blocked** by the `protect_plan_columns` trigger (only `service_role` may change `plan`/`plan_status`/`dodo_*`); the owner-membership trigger prevents demoting/removing the owner; the account-enumeration oracle was already remediated in `20260714230000_sharing_hardening.sql` (verified); server-only reminder RPCs are correctly `revoke`d + `grant`ed to `service_role`; realtime is RLS-scoped.

**Edge functions:** the payment webhook verifies the Standard-Webhooks HMAC **before** parsing the body or touching the DB, with a replay-tolerance window and constant-time compare; a **fail-closed product allow-list** means a forged/cheaper/typo'd product can never grant Pro; `metadata.user_id` is UUID-validated before it touches an `id=eq.` filter (no PostgREST injection); checkout/portal require a verified JWT and take the user id from the token, never the body (no cross-user IDOR); service-role queries are always re-scoped to the caller; CORS is scoped to `APP_URL` (not `*`); the cron secret is enforced constant-time and fails closed; no SSRF/open-redirect (redirect URLs come from `APP_URL`, not user input); email HTML fields are escaped.

**Frontend:** only the anon key + URL reach the browser (all other secret references are comments or DB column names); the single `dangerouslySetInnerHTML` sink is DOMPurify-sanitized and regression-tested; `SafeLink` allow-lists `http/https/mailto` on parse and render and sets `rel="noopener noreferrer nofollow"`; the embed allow-list validates host + id charset and rebuilds canonical URLs (stored scenes can't smuggle a foreign-origin/`javascript:` iframe); Zod validation across all create/update paths; route guards gate the authenticated tree (with RLS as the real backstop); no `eval`/`new Function`/`innerHTML`/unguarded `postMessage`; no tokens/PII in logs; private media via short-lived signed URLs.

---

## Remediation priority

1. **Before the pen-test:** H1 + H2 (one idempotent migration + apply the `revoke`s to prod). ~15 minutes.
2. **Before charging real money / soon:** M1 (split billing columns), M2 (CSP + headers), M3 (generic error bodies).
3. **Post-launch hardening:** L1–L6, I1–I3.

---

# External Penetration Test — Scope of Work (draft)

Use this to brief a firm and compare quotes. **Run the test only after H1/H2 are fixed** so you're not paying an expensive tester to find a bug you already know about.

## 1. Objective & assurance goal
An independent, third-party security assessment of the Aurora multi-tenant SaaS to validate that: (a) tenant isolation (RLS) cannot be bypassed, (b) authentication/authorization cannot be escalated, (c) the payment/entitlement flow cannot be forged, and (d) no client-side or configuration issues expose data. Primary assurance question: **"Can any user read or write another tenant's data, or obtain Pro without paying?"**

## 2. In-scope assets
- The production (or, preferred, an identical **pre-prod/staging**) web app — Cloudflare Pages URL.
- The Supabase project: PostgREST REST API + RPC surface (`/rest/v1/…`, `/rest/v1/rpc/…`), Auth (GoTrue) endpoints, Realtime channels, and Storage (`canvas-media`, `note-media` buckets).
- The four Edge Functions: `dodo-create-checkout`, `dodo-portal`, `dodo-webhook`, `send-due-reminders`.
- Client-side app (React SPA): XSS, CSP, secret exposure, auth-token handling.

> **Recommendation:** point the test at a **dedicated staging project** that mirrors prod schema/policies and is seeded with test tenants, so testers can be aggressive without risking real customer data. RLS/policies are identical to prod, so findings transfer.

## 3. Explicitly out of scope
- Supabase's and Cloudflare's own infrastructure (test *your* configuration, not their platform).
- Dodo Payments' infrastructure — use **Dodo test mode**; do not process real charges.
- Volumetric DoS / DDoS and load testing.
- Social engineering of Anthropic/your staff, physical security.

## 4. Test focus areas (map directly to this app)
1. **Multi-tenant RLS / IDOR** — with two+ separate tenant accounts, attempt cross-tenant read/write on every table via the REST API and every `/rpc/` function. *(Give special attention to the RPC surface — see H1/H2.)*
2. **Authorization escalation** — viewer→editor→owner boundary; can a viewer write? can a member change roles or self-set `plan`?
3. **Entitlement/payment forgery** — attempt to grant Pro without a valid signed webhook; replay/forge webhooks; tamper with product/business ids; abuse checkout/portal for another user (IDOR).
4. **Authentication** — signup/login/reset/OAuth flows, session fixation, token handling, password-reset token abuse, email verification bypass.
5. **Storage** — attempt to read/write another tenant's objects in the private buckets; test signed-URL scoping and path traversal.
6. **Injection** — PostgREST filter injection, SQL injection via RPC args, stored XSS in notes/canvas/comments/labels, SSRF via embeds.
7. **Client-side / config** — CSP presence & bypass, secret exposure in the bundle, clickjacking, insecure headers.
8. **Realtime** — attempt to subscribe to another tenant's private channels.

## 5. What to hand the testers (accelerates the test, lowers cost)
- This internal review + the architecture notes (`plan.md` security section).
- The database schema / RLS policy source (the `supabase/migrations/` folder).
- **At least two** test tenant accounts (each owning a project, plus a viewer and editor member), and one admin account.
- Dodo **test-mode** keys and a description of the entitlement flow.
- A staging URL + Supabase project ref dedicated to the test.

## 6. Rules of engagement
- Agreed testing window and a named point of contact on each side.
- Authorization letter (written permission to test the named assets).
- Data handling: any real/PII data encountered must be reported, not exfiltrated; test data only.
- No destructive tests against prod; no volumetric attacks.
- Responsible disclosure terms; findings are confidential.

## 7. Deliverables to require
- A written report with each finding rated (CVSS v3.1 or v4.0), reproduction steps, evidence, and remediation guidance.
- An executive summary suitable for showing customers/partners as assurance.
- A **free retest** of remediated findings (confirm fixes actually close the issue).
- A letter of attestation / summary you can share with prospects.

## 8. Choosing a firm
- Credentials: **CREST**-accredited firm and/or testers holding **OSCP/OSWE/CREST CRT**; ask for sample (redacted) reports.
- **SaaS + Supabase/PostgREST/Postgres-RLS experience** specifically — the RLS-and-RPC surface is where your real risk lives; a generic network pentester may miss it. Ask directly how they test row-level security and PostgREST RPC exposure.
- References from other B2B SaaS clients; clear scoping and a fixed quote; retest included.
- Typical size for an app this scope: a focused **web-app + API pentest**, usually 5–10 tester-days. Get 2–3 quotes.

## 9. Timing
Fix H1/H2 → stand up a seeded staging project → commission the test → remediate findings → retest → then flip Dodo to live. The pen-test is go-live gate #4; this internal review is the pre-step that makes it cheaper and faster.
