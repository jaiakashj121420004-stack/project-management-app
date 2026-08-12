-- Migration: Team plan (+ a reserved 'enterprise' plan value)
-- (decision log, memory.md, 2026-08-12 — pricing/market research session).
--
-- Free-tier boards already capped collaborators at 2; Pro boards had NO member
-- cap at all, which under-monetized large teams/classrooms (one payer could
-- cover an unbounded number of collaborators for free). This migration:
--   Free:       2 members/board  (unchanged)
--   Pro:        10 members/board (NEW cap, was unlimited)
--   Team:       40 members/board (NEW plan — flat price, generous seat count)
--   Enterprise: unlimited        (NEW plan value, reserved for future manual/
--               negotiated deals — no self-serve checkout exists for it yet;
--               an admin sets profiles.plan = 'enterprise' by hand)
-- The 40-member Team cap is a PLATFORM ceiling, not a monetization one: Supabase
-- Pro's realtime connections (500, shared across ALL of Aurora) is the actual
-- constraint an unbounded board would risk — not per-file/storage cost.
-- Existing Pro boards with >10 members are NOT retroactively broken — the cap
-- only blocks NEW inserts past the limit, same as the free-tier trigger.

-- 1. Allow 'team' and 'enterprise' as plan values.
alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check
  check (plan in ('free', 'pro', 'team', 'enterprise'));

-- 2. project_is_pro(): team and enterprise both include everything Pro does
--    (canvas, media, all Pro-gated tables) — all three count as "at least Pro"
--    for feature gating. Only the MEMBER CAP differs between them.
create or replace function public.project_is_pro(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.projects p
    join public.profiles pr on pr.id = p.owner_id
    where p.id = p_project_id
      and pr.plan in ('pro', 'team', 'enterprise')
  );
$$;

-- 3. user_is_pro(): the personal-canvas analogue of project_is_pro() — same
--    "at least Pro" widening.
create or replace function public.user_is_pro(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.profiles pr
    where pr.id = p_user_id
      and pr.plan in ('pro', 'team', 'enterprise')
  );
$$;

-- 4. Member limit: free=2, pro=10, team=40, enterprise=unlimited.
create or replace function public.enforce_member_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_plan text;
  v_count integer;
  v_limit integer;
begin
  select owner_id into v_owner from public.projects where id = new.project_id;
  if v_owner is null then
    return new; -- project row already gone (cascade delete) — nothing to limit
  end if;
  select coalesce(p.plan, 'free') into v_plan
    from public.profiles p where p.id = v_owner;

  v_limit := case coalesce(v_plan, 'free')
    when 'free' then 2
    when 'pro' then 10
    when 'team' then 40
    else null -- 'enterprise' (and any future higher plan): unlimited
  end;

  if v_limit is not null then
    select count(*) into v_count
      from public.project_members where project_id = new.project_id;
    if v_count >= v_limit then
      raise exception 'MEMBER_LIMIT_REACHED'
        using hint = format(
          'The %s plan allows %s members per board. Upgrade for more collaborators.',
          initcap(coalesce(v_plan, 'free')), v_limit
        );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_member_limit on public.project_members;
create trigger enforce_member_limit
  before insert on public.project_members
  for each row
  execute function public.enforce_member_limit();
