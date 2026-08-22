-- Migration: fix admin analytics RPCs failing with Postgres error 25006
-- ("cannot execute INSERT in a read-only transaction") — 2026-08-22,
-- follow-up to 20260822130000_analytics_dashboard.sql and
-- 20260822140000_analytics_schema_reload_fix.sql.
--
-- Root cause: both admin_analytics_funnel() and admin_analytics_breakdown()
-- are declared `stable`, but each calls log_admin_action(), which performs a
-- real `insert into public.admin_audit_log`. PostgREST reads a function's
-- declared volatility to decide the transaction mode for its call — `stable`
-- (or `immutable`) tells it the function never writes, so it runs the call in
-- a READ ONLY transaction. Postgres then correctly refuses the INSERT inside
-- that read-only transaction, which is exactly the 25006 error the app was
-- surfacing once the frontend's fetch() rewrite exposed the real response
-- body instead of a bare 405.
--
-- The tell: admin_list_feedback() (20260719120000_admin_audit_log.sql), the
-- function this pattern was explicitly copied from, has NO volatility
-- keyword at all — it defaults to `volatile`, which is correct since it also
-- calls log_admin_action(). The `stable` on these two was added by mistake
-- and never belonged here.
--
-- Fix: recreate both functions identically, just without `stable` (so they
-- fall back to the correct `volatile` default), then notify PostgREST to
-- reload its schema cache. Idempotent, safe to re-run.

-- =============================================================================
-- admin_analytics_funnel — unchanged except: `stable` removed.
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
-- admin_analytics_breakdown — unchanged except: `stable` removed.
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
-- Make sure PostgREST picks up the corrected volatility immediately.
-- =============================================================================
notify pgrst, 'reload schema';
