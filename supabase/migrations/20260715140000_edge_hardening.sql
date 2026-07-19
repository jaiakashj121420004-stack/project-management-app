-- Migration: edge-function hardening backing store (Remediation Phase 4 — L3, L4).
-- See SECURITY-REVIEW-2026-07-15.md L3/L4 and SECURITY-FIX-PLAN.md §Phase 4.
--
-- Adds two service-role-only stores the Edge Functions use:
--   L3 — processed_webhooks: a persisted set of Standard-Webhooks `webhook-id`s so
--        a replayed Dodo delivery becomes a no-op (shrinks the replay window to 0).
--   L4 — rate_limit_events + rate_limit_hit(): a shared sliding-window counter so
--        checkout/portal rate limiting survives across isolates (the old limiter
--        was per-isolate in-memory and reset on cold start).
--
-- Both tables have RLS ON with NO client policy — anon/authenticated can never read
-- or write them. The Edge Functions reach them with the service_role key, which
-- bypasses RLS; explicit grants are added so PostgREST/PostgREST-rpc still allow it.
-- rate_limit_hit is SECURITY DEFINER with a pinned search_path, executable only by
-- service_role. Every statement is idempotent (if not exists / create or replace /
-- drop-then-grant), so this file is safe to re-run.

-- =============================================================================
-- L3 — webhook idempotency store
-- =============================================================================
create table if not exists public.processed_webhooks (
  webhook_id   text        primary key,
  processed_at timestamptz not null default now()
);

comment on table public.processed_webhooks is
  'Standard-Webhooks webhook-id of each Dodo event we have already processed. The webhook inserts the id after signature verification and treats a unique-violation (409) as "already handled" → no-op (L3).';

alter table public.processed_webhooks enable row level security;
-- No policies: only the service role (which bypasses RLS) may touch it.
revoke all on public.processed_webhooks from anon, authenticated;
grant select, insert on public.processed_webhooks to service_role;

-- =============================================================================
-- L4 — shared sliding-window rate-limit counter
-- =============================================================================
create table if not exists public.rate_limit_events (
  key    text        not null,
  hit_at timestamptz not null default now()
);

comment on table public.rate_limit_events is
  'One row per accepted request per rate-limit key (e.g. checkout:<user_id>). Consumed by rate_limit_hit() as a shared sliding window (L4).';

create index if not exists rate_limit_events_key_time_idx
  on public.rate_limit_events (key, hit_at);

alter table public.rate_limit_events enable row level security;
revoke all on public.rate_limit_events from anon, authenticated;
grant select, insert, delete on public.rate_limit_events to service_role;

-- Records a hit for p_key and reports whether the caller is OVER the limit.
-- Sliding window: prune hits older than the window, count what remains; if already
-- at/over p_max, return true (limited) WITHOUT recording; otherwise record and
-- return false. SECURITY DEFINER so the service role runs it as owner; search_path
-- pinned per the repo's definer-function convention.
create or replace function public.rate_limit_hit(
  p_key text, p_max integer, p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.rate_limit_events
   where key = p_key
     and hit_at < now() - make_interval(secs => p_window_seconds);

  select count(*) into v_count from public.rate_limit_events where key = p_key;

  if v_count >= p_max then
    return true;  -- over the limit
  end if;

  insert into public.rate_limit_events (key) values (p_key);
  return false;   -- allowed
end;
$$;

comment on function public.rate_limit_hit(text, integer, integer) is
  'SECURITY DEFINER: shared sliding-window rate limiter. Returns true when p_key is over p_max hits within p_window_seconds (L4). service_role only.';

revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
