# Aurora — Security Remediation Plan (H1–L6, I1–I3)

Companion to **[SECURITY-REVIEW-2026-07-15.md](./SECURITY-REVIEW-2026-07-15.md)** (full findings + rationale). This file breaks every finding into **5 phases**, one per session, each with a copy-paste prompt and a recommended model.

## How to use this
- Run the phases **in order** (Phase 1 first — it's the only remotely-exploitable one, and the external pen-test shouldn't start until it's done).
- Each prompt is self-contained: paste it into a **new** session. It already tells the assistant to read `CLAUDE.md` + `memory.md`, follow the golden workflow (update `memory.md` + commit), and respect the Windows build/commit caveat.
- DB phases include an **"apply to prod"** step — the Supabase CLI is already linked (`npx supabase`), so migrations can be pushed with `npx supabase db push`, or run the SQL directly in the dashboard SQL Editor.

## Phase → findings → model at a glance

| Phase | Findings | Surface | Risk | Recommended model |
|-------|----------|---------|------|-------------------|
| 1 | H1, H2, L1 | DB — revoke over-exposed RPCs | **High** | **Opus 4.8** |
| 2 | M1 | DB + frontend — isolate billing PII | Medium | **Opus 4.8** |
| 3 | M2, L6 | Frontend/config — CSP + headers, iframe sandbox | Medium | **Sonnet 5** |
| 4 | M3, L2, L3, L4, L5 | Edge functions — errors, webhook, rate limit | Medium/Low | **Opus 4.8** |
| 5 | I1, I2, I3 | DB nits + docs | Info | **Sonnet 5** |

**Model rationale:** use **Opus 4.8** where a mistake is security-relevant or the change touches RLS/privilege logic (Phases 1, 2, 4). Use **Sonnet 5** for the mechanical config/docs work (Phases 3, 5) — it's faster and fully capable there. If you only want to think about one rule: *DB/security logic → Opus; headers/docs → Sonnet.*

---

## Phase 1 — Lock down over-exposed `SECURITY DEFINER` RPCs (H1, H2, L1)

**Why first:** H1 is exploitable with only the public anon key. One idempotent migration closes all three.

**What:** revoke direct `EXECUTE` from `public`/`anon`/`authenticated` on functions that were left callable by default but should only run inside triggers/other definer functions or policies:
- `redeem_invitations_for(uuid, text)` — H1
- `notify(uuid, uuid, text, jsonb)` — H2
- The oracle helpers used only inside policies — L1: `project_is_pro`, `user_is_pro`, `comment_project_id`, `comment_author_id`, `target_project_id` (verify each is truly only called by policies/definer fns before revoking; if the frontend calls one via `.rpc()`, keep it or add a caller guard instead).

**Verify:** after applying, confirm the internal callers still work (accept an invite as a real invited user; trigger a mention notification) and that a direct `POST /rest/v1/rpc/redeem_invitations_for` with the anon key now returns permission-denied.

### Prompt — Phase 1
```
Read CLAUDE.md and memory.md first, then SECURITY-REVIEW-2026-07-15.md findings H1, H2, and L1, and SECURITY-FIX-PLAN.md Phase 1.

Task: close H1, H2, L1 by revoking direct EXECUTE on SECURITY DEFINER RPCs that were left callable by PUBLIC.

1. Create ONE new idempotent migration, supabase/migrations/<next-timestamp>_lock_definer_rpcs.sql, that runs:
   - revoke all on function public.redeem_invitations_for(uuid, text) from public, anon, authenticated;
   - revoke all on function public.notify(uuid, uuid, text, jsonb) from public, anon, authenticated;
   - For L1: for each of project_is_pro(uuid), user_is_pro(uuid), comment_project_id(uuid), comment_author_id(uuid), target_project_id(text, uuid) — FIRST grep the frontend (src/) for any supabase.rpc('<name>') call. If a function is NOT called directly from the client, revoke it from public, anon, authenticated. If it IS called from the client, leave it and note why in a comment. Report which you revoked vs kept.
   Make every statement safe to re-run.
2. Confirm the internal callers still work by reading the code: redeem_my_invitations() and the signup trigger call redeem_invitations_for as owner; notification triggers call notify as owner — the revokes must not break them.
3. Apply to prod: run `npx supabase db push` (CLI is already linked to project rpwklsrdfqyisogbcdgg), or give me the exact SQL to paste into the Supabase SQL Editor. Then verify with `npx supabase migration list` that the new migration shows Remote.
4. Follow the golden workflow: update memory.md (done-log + next step), respect the Windows build/commit caveat (edits via host file tools; I run build/test/commit on Windows). Give me the conventional-commit message.

Do not change function bodies — only grants. This is a privilege-tightening change; be conservative and explain each revoke.
```
**Model: Opus 4.8.**

---

## Phase 2 — Isolate billing PII from co-members (M1)

**What:** co-members currently read the entire `profiles` row (incl. `dodo_customer_id`, `dodo_subscription_id`, `plan_status`, reminder prefs). Restrict co-member visibility to `id, display_name, avatar_url` only.

**Approach (pick one, assistant should recommend):**
- **(a)** Move billing/reminder columns into a new `billing` table (1:1 with profiles) with an **own-row-only** RLS policy; make the `profiles` co-member SELECT policy… still row-level, so this is the cleaner fix. Update the frontend reads/writes that touch those columns.
- **(b)** Keep columns on `profiles` but change the base SELECT policy to own-row-only and serve co-member display data through a `SECURITY DEFINER` view/function returning only the three safe columns; point the members panel at it.

**Verify:** as user A sharing a project with user B, confirm B can still see A's name/avatar in the members panel but a direct `select dodo_customer_id from profiles` for A's id returns nothing.

### Prompt — Phase 2
```
Read CLAUDE.md and memory.md first, then SECURITY-REVIEW-2026-07-15.md finding M1 and SECURITY-FIX-PLAN.md Phase 2.

Task: stop project co-members from reading each other's billing identifiers and reminder settings via the profiles row. Today the "Profiles: select co-members" policy (supabase/migrations/20260620160000_collaboration.sql) exposes the whole row, including dodo_customer_id, dodo_subscription_id, plan_status, reminder_emails_enabled, reminder_lead_days.

1. First read all migrations that add columns to profiles and every src/ read/write of those columns (grep for dodo_customer_id, dodo_subscription_id, plan_status, reminder_emails_enabled, reminder_lead_days, and the members-panel profile query). Map the blast radius before changing anything.
2. Choose and justify one approach: (a) move billing + reminder columns to a new own-row-only `billing` table, or (b) make the profiles base SELECT own-row-only and expose a SECURITY DEFINER view/function returning ONLY id, display_name, avatar_url for co-members. Recommend the one that's least disruptive to the current frontend.
3. Write the migration(s) idempotently (RLS ON, correct with-check, pin search_path on any new definer fn). Update the frontend to read co-member display data from the safe source and its own billing data from the new location.
4. Apply to prod via `npx supabase db push` (linked to rpwklsrdfqyisogbcdgg) or give me the SQL for the editor. Verify migration list shows Remote.
5. Golden workflow: update memory.md, Windows build/commit caveat, give me the commit message. Keep types (src/types/database.ts) in sync.

Preserve all existing functionality (billing, reminders, members panel). This is data-scoping only.
```
**Model: Opus 4.8** (touches RLS + a data model change).

---

## Phase 3 — Security headers + CSP + iframe sandbox (M2, L6)

**What:** add a `public/_headers` file (Cloudflare Pages) with a Content-Security-Policy scoped to the real origins (Supabase, Google Fonts, the embed providers), plus `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`. Add `sandbox` to the embed iframes (`NoteEmbedView.tsx`, `MediaLayer.tsx`). No DB, no backend.

**Verify:** after deploy, load the app, open DevTools console, and confirm no CSP violations break normal use (fonts load, Supabase REST + realtime WS connect, YouTube/Vimeo/Loom/SoundCloud embeds render). Check response headers with `curl -I` against the deployed URL.

### Prompt — Phase 3
```
Read CLAUDE.md and memory.md first, then SECURITY-REVIEW-2026-07-15.md findings M2 and L6, and SECURITY-FIX-PLAN.md Phase 3.

Task: add HTTP security headers + a Content-Security-Policy, and sandbox the embed iframes. Frontend/config only — no DB.

1. Grep the app for every external origin it legitimately talks to: Supabase REST + realtime (https://*.supabase.co, wss://*.supabase.co), Google Fonts (fonts.googleapis.com / fonts.gstatic.com), and the embed providers actually used (check features/editor/embeds.ts / canvas embeds — YouTube, Vimeo, Loom, SoundCloud). Build the CSP from what you find, not from guesses.
2. Create public/_headers (Cloudflare Pages format) with: Content-Security-Policy (default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' + fonts; font-src the gstatic origin; connect-src 'self' + supabase http/ws; frame-src the embed providers; img-src 'self' data: blob: https:; base-uri 'self'; form-action 'self'), X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin. Verify Vite/the SPA doesn't require 'unsafe-inline'/'unsafe-eval' in script-src; if a library forces it, document why rather than silently loosening.
3. Add sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" to the embed iframes in NoteEmbedView.tsx and MediaLayer.tsx (confirm the exact files/props first).
4. Tell me exactly how to verify after deploy: DevTools console for CSP violations across notes/canvas/embeds/fonts/realtime, and `curl -I <url>` for the headers.
5. Golden workflow: update memory.md, Windows build/commit caveat, commit message.

Be careful the CSP doesn't break realtime (WSS) or the embeds. If unsure whether an origin is needed, tell me instead of adding a broad wildcard.
```
**Model: Sonnet 5.**

---

## Phase 4 — Edge-function hardening (M3, L2, L3, L4, L5)

**What:**
- **M3** — stop returning raw `err.message` to clients in `dodo-create-checkout` / `dodo-portal`; log server-side, return a generic body (keep the safe "No billing account yet." case).
- **L2** — make `DODO_BUSINESS_ID` **required** in prod (fail closed if unset) in `dodo-webhook`.
- **L3** — add a webhook idempotency store: a small table keyed by the Standard-Webhooks `webhook-id` with a unique constraint; skip already-processed events.
- **L4** — back the rate limiter with a shared store (a Postgres sliding-window counter) instead of per-isolate memory.
- **L5** — hash both inputs to fixed length before the `timingSafeEqual` XOR in `send-due-reminders` so length isn't leaked.

**Verify:** replay a webhook (test mode) and confirm the second delivery is a no-op; confirm a malformed error path returns the generic body; confirm reminders still send.

### Prompt — Phase 4
```
Read CLAUDE.md and memory.md first, then SECURITY-REVIEW-2026-07-15.md findings M3, L2, L3, L4, L5, and SECURITY-FIX-PLAN.md Phase 4. All changes are in supabase/functions/* (+ maybe one small migration for L3/L4).

Do these, reading each function first:
1. M3 — in dodo-create-checkout/index.ts and dodo-portal/index.ts, replace `json({ error: err.message }, 500)` with a generic message; keep console.error(err) server-side and keep safe expected messages (e.g. "No billing account yet."). Grep for any other place raw error text is returned to the client.
2. L2 — in dodo-webhook/index.ts, make DODO_BUSINESS_ID required: if it's unset in prod, fail closed (reject) rather than skipping the business_id match. Keep local/dev ergonomic if needed via an explicit env flag, documented.
3. L3 — add webhook idempotency: a new idempotent migration creating a table (e.g. processed_webhooks: webhook_id text primary key, processed_at timestamptz default now()) with RLS on + no client policy (service-role only). In the webhook, after signature verification, insert the webhook-id and skip processing on unique-violation (already handled).
4. L4 — replace the in-isolate rate limiter in dodo-create-checkout/dodo-portal with a shared Postgres sliding-window counter (service-role query), keeping the fail-open behavior only as a last-resort fallback if the counter query itself errors. Keep the 8/60s budget unless you justify a change.
5. L5 — in send-due-reminders, hash both the provided x-cron-secret and CRON_SECRET to a fixed length (e.g. SHA-256) before timingSafeEqual so a length mismatch can't short-circuit.
6. Apply any new migration to prod via `npx supabase db push` and set/confirm DODO_BUSINESS_ID with `npx supabase secrets set` (ask me for the value if needed). Deploy the functions with `npx supabase functions deploy <name>` or tell me to.
7. Verify steps: replay a test-mode webhook (2nd = no-op), force an error path (generic body), confirm reminders still send. Golden workflow: memory.md + Windows build/commit caveat + commit message.

These are hardening changes; don't regress the working webhook/entitlement flow. Preserve the fail-closed product allow-list already in place.
```
**Model: Opus 4.8** (payment/entitlement path — correctness matters).

---

## Phase 5 — DB nits + docs (I1, I2, I3)

**What:**
- **I1** — replace the hardcoded admin email in `is_admin()` (`20260621230000:16`) with an `admins` table (or a config row); migrate the existing admin in.
- **I2** — make the storage-path `::uuid` casts robust (`nullif(split_part(...),'' )::uuid` / `CASE`), matching the realtime policy's pattern, so a malformed object name denies instead of erroring. Touches the `canvas-media` and `note-media` object policies.
- **I3** — document (in the privacy/data-retention notes or `plan.md`) that the session token + an offline React Query cache live in `localStorage` (wiped on sign-out, 24h max-age). Docs only.

**Verify:** admin gate still works for the migrated admin and denies a non-admin; media still loads; a crafted bad object name is denied, not a 500.

### Prompt — Phase 5
```
Read CLAUDE.md and memory.md first, then SECURITY-REVIEW-2026-07-15.md findings I1, I2, I3, and SECURITY-FIX-PLAN.md Phase 5. Low-risk cleanup.

1. I1 — replace the hardcoded admin email in is_admin() (supabase/migrations/20260621230000_..., ~line 16) with a real mechanism: a new admins table (user_id uuid pk, RLS on, service-role/self-read only) or a config row. Write an idempotent migration that creates it, seeds the current admin (jaiakashj121420004@gmail.com's user id — resolve it safely), and rewrites is_admin() to check membership (keep it SECURITY DEFINER, search_path pinned). Don't break the existing admin gate.
2. I2 — harden the storage object policies for canvas-media and note-media so a malformed first path segment denies instead of raising: use nullif(split_part(name,'/',1),'')::uuid (and the foldername variant) like the realtime policy at 20260629120000 does. Idempotent drop+create of the affected policies.
3. I3 — docs only: note in plan.md (security/privacy section) or the privacy copy that supabase-js stores the session in localStorage and the app persists an offline React Query cache there (cleared on SIGNED_OUT, 24h max-age).
4. Apply DB migrations to prod via `npx supabase db push`; verify migration list. Test: admin gate works for the seeded admin + denies a non-admin; media still loads; a crafted bad object name is denied not a 500.
5. Golden workflow: memory.md + Windows build/commit caveat + commit message. Keep types in sync if any schema changed.
```
**Model: Sonnet 5.**

---

## After all five phases
1. Stand up a **seeded staging** Supabase project (mirror of prod schema/policies, 2+ test tenants).
2. Commission the **external penetration test** using the scope-of-work in `SECURITY-REVIEW-2026-07-15.md` §"External Penetration Test — Scope of Work".
3. Remediate any findings, retest, then proceed to the remaining go-live gates (Dodo LIVE keys + KYC, legal).
