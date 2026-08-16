-- Fix: close a plan/usage information-disclosure oracle in two BEFORE INSERT
-- triggers (pre-pentest hardening pass, 2026-08-16).
--
-- Root cause: for INSERT statements, a BEFORE ROW trigger runs and can raise
-- (or not raise) BEFORE the table's RLS `with check` clause is evaluated on
-- the constructed row. Two trigger functions branch their behaviour — and
-- therefore their error message — on an attacker-suppliable identifying
-- column (`new.owner_id` / `new.user_id`) before RLS ever gets a chance to
-- reject a spoofed value:
--
--   * enforce_project_limit (public.projects, BEFORE INSERT): looks up the
--     PLAN and PROJECT COUNT for `new.owner_id`. A caller who knows another
--     user's id (e.g. a fellow project member — visible via project_members /
--     the "Profiles: select co-members" policy) can POST an insert with
--     owner_id = <target> and distinguish two outcomes:
--       - PROJECT_LIMIT_REACHED  -> target is on Free AND already owns 3+
--         projects
--       - a generic RLS-violation (the eventual `with check (owner_id =
--         auth.uid())` failure) -> target is Pro/Team/Enterprise, or Free
--         with fewer than 3 projects
--     Both responses leak account information about a user who never
--     consented to sharing it with this caller, from an endpoint (`POST
--     /rest/v1/projects`) that was never supposed to succeed for anyone but
--     the row's own owner.
--
--   * enforce_recurrence_plan (public.todo_recurrences, BEFORE INSERT/UPDATE):
--     same shape — looks up the PLAN for `new.user_id` before RLS's
--     `with check (user_id = auth.uid())` runs, so a non-daily rule type
--     lets a caller who knows another user's id learn whether that user is
--     Free (RECURRENCE_REQUIRES_PRO) or Pro+ (falls through to the generic
--     RLS rejection instead).
--
-- Fix: both functions now bail out immediately — before touching
-- public.profiles or counting rows — whenever the row's identifying column
-- doesn't match the calling session (auth.uid()). That matches exactly what
-- RLS is about to enforce anyway, so behaviour for every legitimate insert is
-- unchanged; only the "I'm inserting on someone else's behalf" path stops
-- doing any lookup at all and instead falls straight through to RLS's own
-- uniform rejection, with no distinguishing side effect in between.
--
-- (enforce_member_limit was checked too and is NOT affected by this class of
-- bug: public.project_members only accepts inserts from the project's owner
-- — "Members: insert by owner", `with check (is_project_owner(project_id))`
-- — so by the time the trigger runs, the plan/owner it looks up via
-- new.project_id is always the CALLER's own project, never a spoofed one.)
--
-- Idempotent: safe to re-run (create or replace).

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
  -- Never branch on (and thus never leak facts about) a project row that
  -- isn't actually the caller's own insert — RLS's `with check (owner_id =
  -- auth.uid())` rejects this uniformly a moment later regardless.
  if new.owner_id is distinct from auth.uid() then
    return new;
  end if;

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

create or replace function public.enforce_recurrence_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule_type text;
  v_plan text;
begin
  -- Same guard as enforce_project_limit above, and for the same reason: don't
  -- look up or branch on another account's plan before RLS's own
  -- `with check (user_id = auth.uid())` gets to reject the row.
  if new.user_id is distinct from auth.uid() then
    return new;
  end if;

  v_rule_type := new.rule ->> 'type';
  if v_rule_type is null or v_rule_type not in ('daily', 'weekly', 'monthly', 'interval') then
    raise exception 'INVALID_RECURRENCE_RULE';
  end if;

  if v_rule_type <> 'daily' then
    select coalesce(plan, 'free') into v_plan from public.profiles where id = new.user_id;
    if coalesce(v_plan, 'free') = 'free' then
      raise exception 'RECURRENCE_REQUIRES_PRO'
        using hint = 'Custom repeat schedules (specific weekdays, monthly, every N weeks/months) need Pro. Daily repeat is free.';
    end if;
  end if;

  return new;
end;
$$;
