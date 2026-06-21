-- Phase 10 — Billing & plans
-- `profiles` gains a plan + Stripe linkage. The free-tier project cap is
-- enforced server-side (a trigger), and a second trigger makes the billing
-- columns writable ONLY by the service role (the verified Stripe webhook) so a
-- user can never self-upgrade by editing their own profile row.

-- 1. Plan + Stripe columns on profiles. Existing rows backfill to 'free'.
alter table public.profiles
  add column if not exists plan text not null default 'free'
    check (plan in ('free', 'pro')),
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists plan_status text;

-- 2. current_plan(): the caller's plan, readable from policies/UI.
--    SECURITY DEFINER so it can read profiles regardless of RLS.
create or replace function public.current_plan()
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce((select p.plan from public.profiles p where p.id = auth.uid()), 'free');
$$;

grant execute on function public.current_plan() to authenticated;

-- 3. Enforce the free-tier project cap (3 owned projects). The UI is untrusted;
--    this runs on every insert. Keep the literal in sync with FREE_PROJECT_LIMIT
--    in src/lib/plans.ts.
create or replace function public.enforce_project_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
  v_count integer;
begin
  select coalesce(p.plan, 'free') into v_plan
    from public.profiles p
    where p.id = new.owner_id;

  if coalesce(v_plan, 'free') = 'free' then
    select count(*) into v_count
      from public.projects pr
      where pr.owner_id = new.owner_id;

    if v_count >= 3 then
      raise exception 'PROJECT_LIMIT_REACHED'
        using hint = 'The Free plan is limited to 3 projects. Upgrade to Pro for unlimited projects.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_project_limit on public.projects;
create trigger enforce_project_limit
  before insert on public.projects
  for each row
  execute function public.enforce_project_limit();

-- 4. Protect the billing columns: only the service role (the Stripe webhook,
--    using the service_role key) may change plan / stripe_* / plan_status.
--    Normal authenticated users keep updating their own display name etc.
create or replace function public.protect_plan_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    if new.plan is distinct from old.plan
       or new.stripe_customer_id is distinct from old.stripe_customer_id
       or new.stripe_subscription_id is distinct from old.stripe_subscription_id
       or new.plan_status is distinct from old.plan_status then
      raise exception 'Billing fields can only be changed by the billing system.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_plan_columns on public.profiles;
create trigger protect_plan_columns
  before update on public.profiles
  for each row
  execute function public.protect_plan_columns();
