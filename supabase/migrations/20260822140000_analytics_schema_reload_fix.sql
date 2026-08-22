-- Migration: fix admin analytics RPCs unreachable via the REST API (405
-- Method Not Allowed on POST /rest/v1/rpc/admin_analytics_funnel and
-- /rest/v1/rpc/admin_analytics_breakdown) — 2026-08-22, follow-up to
-- 20260822130000_analytics_dashboard.sql.
--
-- Root cause: PostgREST caches the whole database schema in memory and only
-- refreshes it on a NOTIFY signal. Applying DDL through the Studio SQL
-- Editor creates the functions in Postgres immediately (confirmed: both
-- showed up in pg_proc) but does not reliably push that reload signal to
-- the running API layer, which keeps serving requests against its old,
-- pre-migration view of the schema — a route it doesn't recognize returns
-- 405, not 404, at the gateway layer. The zero-argument admin_analytics_funnel()
-- failing identically to the three-argument admin_analytics_breakdown() rules
-- out an overload/signature mismatch as the cause (a zero-arg function has
-- only one possible signature), which is what points at the schema cache
-- specifically rather than the functions themselves.
--
-- This migration is the fix: drop any stray/duplicate overloads that might
-- exist from earlier iterations so there is exactly one signature per
-- function name, recreate both functions and their grants identically to
-- the original migration (idempotent, safe to re-run), then explicitly
-- notify PostgREST to reload its schema cache immediately instead of
-- waiting on the platform's own auto-reload listener.

-- =============================================================================
-- Defensively clear any other-signature leftovers (safe no-ops if these
-- never existed) so there is exactly one overload per function name.
-- =============================================================================
drop function if exists public.admin_analytics_funnel();
drop function if exists public.admin_analytics_breakdown(text, text);
drop function if exists public.admin_analytics_breakdown(text, text, integer);
drop function if exists public.admin_analytics_breakdown(text, text, integer, text);

-- =============================================================================
-- admin_analytics_funnel — the 6-stage acquisition funnel, all-time + last 30
-- days, in a fixed stage order (not alphabetical). One row per stage even if
-- an event has never fired (left join), so the dashboard never has to special-
-- case a missing row.
-- =============================================================================
create or replace function public.admin_analytics_funnel()
returns table (
  stage int,
  event_name text,
  count_all_time bigint,
  count_last_30d bigint
)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the app administrator may read analytics.';
  end if;

  perform public.log_admin_action(
    'read', 'analytics_events', null, jsonb_build_object('view', 'funnel')
  );

  return query
    with stages(stage, event_name) as (
      values
        (1, 'landing_page_viewed'),
        (2, 'signup_started'),
        (3, 'signup_completed'),
        (4, 'first_board_created'),
        (5, 'checkout_started'),
        (6, 'checkout_completed')
    )
    select
      s.stage,
      s.event_name,
      count(e.id) as count_all_time,
      count(e.id) filter (
        where e.occurred_at >= now() - interval '30 days'
      ) as count_last_30d
    from stages s
    left join public.analytics_events e on e.event_name = s.event_name
    group by s.stage, s.event_name
    order by s.stage;
end;
$$;

comment on function public.admin_analytics_funnel() is
  'Admin-only: the 6-stage acquisition funnel (landing -> paid), all-time + last-30-day counts, in stage order. Every call logged to admin_audit_log.';

grant execute on function public.admin_analytics_funnel() to authenticated;

-- =============================================================================
-- admin_analytics_breakdown — value counts for one event's JSON property over
-- the last N days, highest first, capped to the top 20 rows so a high-
-- cardinality property (e.g. a free-text field, if one is ever added) can't
-- return an unbounded result. Generic by design so the dashboard can reuse it
-- for upgrade_prompt_shown->limit, install_prompt_shown->platform, etc.
-- without a bespoke function per event.
-- =============================================================================
create or replace function public.admin_analytics_breakdown(
  p_event_name text,
  p_property_key text,
  p_days integer default 30
)
returns table (
  value text,
  count bigint
)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the app administrator may read analytics.';
  end if;

  if p_event_name is null or length(p_event_name) = 0 or length(p_event_name) > 100 then
    raise exception 'p_event_name is required and must be 1-100 characters.';
  end if;

  if p_property_key is null or length(p_property_key) = 0 or length(p_property_key) > 100 then
    raise exception 'p_property_key is required and must be 1-100 characters.';
  end if;

  if p_days is null or p_days < 1 or p_days > 3650 then
    raise exception 'p_days must be between 1 and 3650.';
  end if;

  perform public.log_admin_action(
    'read', 'analytics_events', null,
    jsonb_build_object(
      'view', 'breakdown', 'event_name', p_event_name,
      'property_key', p_property_key, 'days', p_days
    )
  );

  return query
    select
      coalesce(e.properties ->> p_property_key, '(none)') as value,
      count(*) as count
    from public.analytics_events e
    where e.event_name = p_event_name
      and e.occurred_at >= now() - (p_days || ' days')::interval
    group by 1
    order by count(*) desc
    limit 20;
end;
$$;

comment on function public.admin_analytics_breakdown(text, text, integer) is
  'Admin-only: value counts for one analytics_events property, last N days, top 20. Generic across events (no per-event function needed). Every call logged to admin_audit_log.';

grant execute on function public.admin_analytics_breakdown(text, text, integer) to authenticated;

-- =============================================================================
-- Force PostgREST to pick up the functions right now instead of waiting on
-- the platform's own auto-reload listener. This is the actual fix for the
-- 405s — everything above just guarantees a clean, single-signature state
-- for it to reload.
-- =============================================================================
notify pgrst, 'reload schema';
