-- Migration: minimal funnel analytics event log (analytics_events).
--
-- Feature: a privacy-respecting product-analytics layer — a thin funnel-tracking
-- log, deliberately NOT a general analytics platform (no dashboard, no session
-- replay, no PII). See reports/ANALYTICS.md for the event-name/property schema
-- and src/lib/analytics.ts for the client. No dashboard/admin UI ships in this
-- change — query via Supabase Studio SQL for now (scope note, memory.md).
--
-- Security model matches the existing service-role-only backing stores
-- (processed_webhooks / rate_limit_events, 20260715140000_edge_hardening.sql):
-- RLS ON, NO client policy — anon/authenticated can never read or write this
-- table directly, matching the same defense-in-depth stance already used for
-- billing writes (the verified Dodo webhook is the ONLY writer of
-- profiles.plan — see dodo-webhook/index.ts). The ONLY writers here are the new
-- `track-event` Edge Function (service role, client-facing) and the Dodo
-- webhook (service role, for the one server-confirmed event, `checkout_completed`
-- — never trust the client redirect alone for "did they actually pay", same
-- principle as the plan-flip itself). Every statement is idempotent (create
-- table if not exists / revoke-then-grant), so this file is safe to re-run.

create table if not exists public.analytics_events (
  id           uuid        primary key default gen_random_uuid(),
  occurred_at  timestamptz not null default now(),
  -- Nullable: most funnel events happen before/without a session (landing page,
  -- signup itself is pre-session). Stamped server-side from the caller's JWT in
  -- the Edge Function — never trusted from the request body.
  user_id      uuid        references auth.users (id) on delete set null,
  -- Random UUID minted client-side on first use (src/lib/analytics.ts) and
  -- persisted in localStorage — NOT derived from anything PII. The one thread
  -- that ties an anonymous landing-page visit to a later signup/checkout.
  anonymous_id text,
  event_name   text        not null,
  -- Small, allow-listed shape — validated server-side against a fixed event-name
  -- allow-list and a size cap in the Edge Function (see track-event). The client
  -- never gets to write arbitrary event names or unbounded payloads.
  properties   jsonb       not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

comment on table public.analytics_events is
  'Minimal funnel-analytics event log. Written ONLY by the track-event Edge Function (service role) and the Dodo webhook (checkout_completed, service role). No direct client reads/writes — RLS denies both; query via Supabase Studio SQL. See reports/ANALYTICS.md.';

create index if not exists analytics_events_event_name_occurred_at_idx
  on public.analytics_events (event_name, occurred_at desc);

create index if not exists analytics_events_user_id_idx
  on public.analytics_events (user_id) where user_id is not null;

create index if not exists analytics_events_anonymous_id_idx
  on public.analytics_events (anonymous_id) where anonymous_id is not null;

alter table public.analytics_events enable row level security;
-- No policies: only the service role (which bypasses RLS) may touch it — the
-- identical stance already taken for processed_webhooks / rate_limit_events.
revoke all on public.analytics_events from anon, authenticated;
grant select, insert on public.analytics_events to service_role;
