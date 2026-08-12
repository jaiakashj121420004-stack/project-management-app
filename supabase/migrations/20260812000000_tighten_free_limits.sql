-- Tighten the Free plan: 10 boards -> 3, 3 members/board -> 2.
--   Free was giving away a full 3-person team indefinitely, which undercut
--   Pro conversion (decision log, memory.md, 2026-08-12). Mirrors
--   FREE_PROJECT_LIMIT / FREE_MEMBER_LIMIT in src/lib/plans.ts — keep in sync.
-- Idempotent: safe to re-run (create or replace / drop-then-create trigger).

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
    from public.profiles p where p.id = new.owner_id;
  if coalesce(v_plan, 'free') = 'free' then
    select count(*) into v_count
      from public.projects pr where pr.owner_id = new.owner_id;
    if v_count >= 3 then
      raise exception 'PROJECT_LIMIT_REACHED'
        using hint = 'The Free plan is limited to 3 project boards. Upgrade to Pro for unlimited.';
    end if;
  end if;
  return new;
end;
$$;

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
begin
  select owner_id into v_owner from public.projects where id = new.project_id;
  if v_owner is null then
    return new; -- project row already gone (cascade delete) — nothing to limit
  end if;
  select coalesce(p.plan, 'free') into v_plan
    from public.profiles p where p.id = v_owner;
  if coalesce(v_plan, 'free') = 'free' then
    select count(*) into v_count
      from public.project_members where project_id = new.project_id;
    if v_count >= 2 then
      raise exception 'MEMBER_LIMIT_REACHED'
        using hint = 'The Free plan allows 2 members per board. Upgrade to Pro for unlimited collaborators.';
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
