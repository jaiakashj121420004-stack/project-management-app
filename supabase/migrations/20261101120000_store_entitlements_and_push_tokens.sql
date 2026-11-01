-- Store billing + native push.
--
-- 1. `entitlements`: one row per (user, source). Dodo (web/Windows) keeps writing
--    profiles.plan directly via its webhook; Apple/Google purchases arrive through
--    RevenueCat and land here. `recompute_profile_plan()` then folds the active
--    store entitlement into profiles.plan so the rest of the app (RLS,
--    project_is_pro(), useIsPro) keeps reading ONE column.
-- 2. `push_tokens`: FCM/APNs device tokens for the native apps.
--
-- Clients can only READ their own entitlements. Every write is service-role.

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('app_store', 'play_store', 'dodo', 'manual')),
  plan text not null check (plan in ('pro', 'team')),
  status text not null check (status in ('active', 'expired', 'billing_issue')),
  product_id text,
  external_id text,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, source)
);

alter table public.entitlements enable row level security;

drop policy if exists "entitlements: read own" on public.entitlements;
create policy "entitlements: read own" on public.entitlements
  for select to authenticated
  using (user_id = (select auth.uid()));

-- No insert/update/delete policies on purpose: only the service role writes.

create or replace function public.recompute_profile_plan(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  best text;
  has_dodo boolean;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service role only';
  end if;

  select e.plan into best
  from public.entitlements e
  where e.user_id = p_user
    and e.status in ('active', 'billing_issue')
    and (e.expires_at is null or e.expires_at > now())
  order by case e.plan when 'team' then 2 else 1 end desc
  limit 1;

  select (p.dodo_subscription_id is not null) into has_dodo
  from public.profiles p where p.id = p_user;

  if best is not null then
    update public.profiles set plan = best, plan_status = 'active' where id = p_user;
  elsif not coalesce(has_dodo, false) then
    -- No store entitlement and no Dodo subscription: back to Free.
    update public.profiles set plan = 'free', plan_status = null
    where id = p_user and plan in ('pro', 'team');
  end if;
end;
$$;

revoke all on function public.recompute_profile_plan(uuid) from public, anon, authenticated;
grant execute on function public.recompute_profile_plan(uuid) to service_role;

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  token text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (token)
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

drop policy if exists "push_tokens: manage own" on public.push_tokens;
create policy "push_tokens: manage own" on public.push_tokens
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
