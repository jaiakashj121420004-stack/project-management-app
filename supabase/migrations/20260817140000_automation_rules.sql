-- Migration: rule-builder automations (Pro & Team plans only).
-- Improvement Plan Task 23 — see memory.md's decision log entry for the full
-- "why build this despite the guardrail flag" rationale. Deliberately a SMALL,
-- FIXED trigger/action system, not an extensible rule engine:
--   Triggers: card_moved_to_column | checklist_completed | due_date_passed
--   Actions:  move_to_column | add_label | assign_user
-- No custom conditions, no chaining, no scripting surface — v1 scope only.
--
-- Gating (plan.md §6, same shape as canvas/collaboration Pro-gating):
--   - project_is_pro(project_id) governs CREATE/UPDATE (Pro/Team only).
--   - A lapsed plan does NOT delete existing rules — they just stop firing
--     (re-checked inside fire_automation_rule() at EXECUTION time, not just at
--     save time, so a rule created while Pro correctly goes dormant the moment
--     the project's plan lapses, and resumes if it's restored).
--   - Any project MEMBER (including viewers) may SELECT — the frontend hides
--     the whole "Automations" surface for non-Pro projects and non-editors;
--     RLS itself only needs to stop non-members and non-editor writes.
--   - DELETE only requires editor role, not Pro — removing a dead/lapsed rule
--     shouldn't require re-paying first (explicit decision, memory.md).
--
-- Execution is a Postgres trigger for the two event-shaped triggers
-- (card_moved_to_column, checklist_completed — they fire inline, in the same
-- transaction as the write, with no client needing to stay connected) and a
-- service-role cron RPC for due_date_passed (nothing "writes" at the moment a
-- date passes, so — exactly like due_reminder_candidates/
-- run_due_card_recurrences — this needs a periodic scan, not a row trigger;
-- see run-automations/index.ts + supabase/README.md for the pg_cron wiring).
--
-- Automations deliberately DON'T CHAIN: an action performed by fire_automation_
-- rule() never re-triggers another rule (guarded by a transaction-local GUC,
-- aurora.automation_firing). This is a safety choice, not an oversight — two
-- rules could otherwise ping-pong a card between columns forever. Documented
-- in memory.md as one of the "written-down no"s (guardrail item 12).

-- 1. automation_rules ---------------------------------------------------------
create table if not exists public.automation_rules (
  id             uuid        primary key default gen_random_uuid(),
  project_id     uuid        not null references public.projects (id) on delete cascade,
  trigger_type   text        not null check (trigger_type in (
                               'card_moved_to_column', 'checklist_completed', 'due_date_passed'
                             )),
  -- card_moved_to_column: { "column_id": uuid }. The other two triggers need
  -- no config — they're whole-project conditions, not a specific target.
  trigger_config jsonb       not null default '{}'::jsonb,
  action_type    text        not null check (action_type in (
                               'move_to_column', 'add_label', 'assign_user'
                             )),
  -- move_to_column: { "column_id": uuid }. add_label: { "label_id": uuid }.
  -- assign_user: { "user_id": uuid | null } — null is a valid, explicit choice
  -- ("assign it to nobody" — unassign on trigger), not "not yet configured".
  action_config  jsonb       not null default '{}'::jsonb,
  enabled        boolean     not null default true,
  created_by     uuid                 references auth.users (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  constraint automation_rules_trigger_config_shape check (
    trigger_type <> 'card_moved_to_column' or trigger_config ? 'column_id'
  ),
  constraint automation_rules_action_config_shape check (
    (action_type <> 'move_to_column' or action_config ? 'column_id')
    and (action_type <> 'add_label' or action_config ? 'label_id')
    and (action_type <> 'assign_user' or action_config ? 'user_id')
  )
);

comment on table public.automation_rules is
  'Small, fixed-shape "if X then Y" automations, Pro/Team only (project_is_pro). NOT an open rule builder — trigger_type/action_type are closed enums (plan.md §6, memory.md Task 23 decision log).';

create index if not exists automation_rules_project_trigger_idx
  on public.automation_rules (project_id, trigger_type)
  where enabled;

-- created_by is stamped at insert and never changes after — an audit trail,
-- not a security-critical field, but kept honest the same way project_templates
-- protects owner_id.
create or replace function public.protect_automation_rule_created_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'automation_rules.created_by is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_automation_rule_created_by on public.automation_rules;
create trigger protect_automation_rule_created_by
  before update on public.automation_rules
  for each row
  execute function public.protect_automation_rule_created_by();

-- 2. Target validation: a rule's column_id/label_id/user_id must actually
--    belong to the SAME project (can't be pointed at another board's column by
--    a crafted request — defense in depth, since the frontend pickers only
--    ever offer same-project options anyway).
create or replace function public.validate_automation_rule_targets()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.trigger_type = 'card_moved_to_column' then
    if not exists (
      select 1 from public.columns c
      where c.id = (new.trigger_config ->> 'column_id')::uuid
        and c.project_id = new.project_id
    ) then
      raise exception 'AUTOMATION_TARGET_INVALID'
        using hint = 'The trigger column must belong to this project.';
    end if;
  end if;

  if new.action_type = 'move_to_column' then
    if not exists (
      select 1 from public.columns c
      where c.id = (new.action_config ->> 'column_id')::uuid
        and c.project_id = new.project_id
    ) then
      raise exception 'AUTOMATION_TARGET_INVALID'
        using hint = 'The target column must belong to this project.';
    end if;
  elsif new.action_type = 'add_label' then
    if not exists (
      select 1 from public.labels l
      where l.id = (new.action_config ->> 'label_id')::uuid
        and l.project_id = new.project_id
    ) then
      raise exception 'AUTOMATION_TARGET_INVALID'
        using hint = 'The target label must belong to this project.';
    end if;
  elsif new.action_type = 'assign_user' then
    if (new.action_config ->> 'user_id') is not null
      and not exists (
        select 1 from public.project_members m
        where m.project_id = new.project_id
          and m.user_id = (new.action_config ->> 'user_id')::uuid
      )
    then
      raise exception 'AUTOMATION_TARGET_INVALID'
        using hint = 'The assignee must be a member of this project.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_automation_rule_targets on public.automation_rules;
create trigger validate_automation_rule_targets
  before insert or update on public.automation_rules
  for each row
  execute function public.validate_automation_rule_targets();

-- 3. Abuse-protection cap on rule creation — mirrors the repo's existing
--    "count-cap trigger" convention for direct client writes (enforce_project_
--    limit / enforce_member_limit), rather than a time-windowed rate limiter
--    (rate_limit_hit() is reserved for service-role Edge Functions elsewhere in
--    this repo — see 20260715140000_edge_hardening.sql — direct client insert
--    paths in this codebase are protected by a flat per-scope cap instead).
--    20 is a flat ceiling regardless of plan — generous for any genuine
--    automation setup, small enough to make scripted spam pointless.
create or replace function public.enforce_automation_rule_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
    from public.automation_rules where project_id = new.project_id;
  if v_count >= 20 then
    raise exception 'AUTOMATION_RULE_LIMIT_REACHED'
      using hint = 'A project can have at most 20 automation rules.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_automation_rule_limit on public.automation_rules;
create trigger enforce_automation_rule_limit
  before insert on public.automation_rules
  for each row
  execute function public.enforce_automation_rule_limit();

-- 4. RLS ----------------------------------------------------------------------
alter table public.automation_rules enable row level security;

drop policy if exists "automation_rules: select if member" on public.automation_rules;
create policy "automation_rules: select if member"
  on public.automation_rules
  for select
  to authenticated
  using (public.is_project_member(project_id));

drop policy if exists "automation_rules: insert if pro editor" on public.automation_rules;
create policy "automation_rules: insert if pro editor"
  on public.automation_rules
  for insert
  to authenticated
  with check (
    public.can_edit_project(project_id)
    and public.project_is_pro(project_id)
    and created_by = auth.uid()
  );

drop policy if exists "automation_rules: update if pro editor" on public.automation_rules;
create policy "automation_rules: update if pro editor"
  on public.automation_rules
  for update
  to authenticated
  using (public.can_edit_project(project_id) and public.project_is_pro(project_id))
  with check (public.can_edit_project(project_id) and public.project_is_pro(project_id));

-- Deletion only needs editor rights, not an active Pro plan (see module doc).
drop policy if exists "automation_rules: delete if editor" on public.automation_rules;
create policy "automation_rules: delete if editor"
  on public.automation_rules
  for delete
  to authenticated
  using (public.can_edit_project(project_id));

-- 5. Execution: fire_automation_rule() -----------------------------------------
-- Shared by both the inline triggers below and the due-date cron RPC. Re-checks
-- enabled + project_is_pro at FIRE time (not just at save time) — the actual
-- enforcement point for "a rule stops firing if the governing plan lapses."
-- Sets a transaction-local flag so its own writes never re-trigger another
-- automation (no chaining — see module doc).
create or replace function public.fire_automation_rule(p_rule_id uuid, p_card_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule public.automation_rules%rowtype;
  v_target_column uuid;
begin
  select * into v_rule from public.automation_rules
    where id = p_rule_id and enabled = true;
  if not found then
    return;
  end if;

  if not public.project_is_pro(v_rule.project_id) then
    return; -- lapsed plan: the rule stays, it just stops firing.
  end if;

  perform set_config('aurora.automation_firing', 'true', true); -- true = transaction-local

  if v_rule.action_type = 'move_to_column' then
    v_target_column := (v_rule.action_config ->> 'column_id')::uuid;
    update public.cards
      set column_id = v_target_column,
          position = coalesce(
            (select max(position) from public.cards where column_id = v_target_column), 0
          ) + 1000
      where id = p_card_id
        and column_id is distinct from v_target_column;

  elsif v_rule.action_type = 'add_label' then
    insert into public.card_labels (card_id, label_id)
      values (p_card_id, (v_rule.action_config ->> 'label_id')::uuid)
      on conflict do nothing;

  elsif v_rule.action_type = 'assign_user' then
    update public.cards
      set assignee_id = (v_rule.action_config ->> 'user_id')::uuid
      where id = p_card_id;
  end if;
end;
$$;

comment on function public.fire_automation_rule(uuid, uuid) is
  'SECURITY DEFINER: applies one automation rule''s action to one card. Re-checks enabled + project_is_pro at fire time. Sets aurora.automation_firing so its own writes never chain into another rule.';

revoke all on function public.fire_automation_rule(uuid, uuid) from public, anon;
grant execute on function public.fire_automation_rule(uuid, uuid) to authenticated, service_role;

-- 6. Trigger: card moved to a specific column ----------------------------------
create or replace function public.run_automations_for_card_move()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule record;
begin
  if current_setting('aurora.automation_firing', true) = 'true' then
    return new; -- an automation's own move — never chain into another rule.
  end if;

  if new.column_id is distinct from old.column_id then
    for v_rule in
      select id from public.automation_rules
      where project_id = new.project_id
        and enabled = true
        and trigger_type = 'card_moved_to_column'
        and (trigger_config ->> 'column_id')::uuid = new.column_id
    loop
      perform public.fire_automation_rule(v_rule.id, new.id);
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists run_automations_for_card_move on public.cards;
create trigger run_automations_for_card_move
  after update of column_id on public.cards
  for each row
  execute function public.run_automations_for_card_move();

-- 7. Trigger: checklist reaches 100% complete ----------------------------------
-- Fires on the transition into "every item on this card is done" — both when
-- the last remaining item is checked (UPDATE) and, for completeness, when a
-- card's final/only item is inserted already-checked (INSERT) — every current
-- UI flow inserts items unchecked, so the INSERT path is a defensive edge case
-- rather than a common one.
create or replace function public.run_automations_for_checklist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project uuid;
  v_total integer;
  v_done integer;
  v_rule record;
  v_just_completed boolean;
begin
  if current_setting('aurora.automation_firing', true) = 'true' then
    return new;
  end if;

  -- OLD is unassigned on INSERT — branch on tg_op before ever referencing it,
  -- rather than relying on OR short-circuit evaluation order (not guaranteed
  -- for general boolean expressions in Postgres).
  if tg_op = 'INSERT' then
    v_just_completed := new.is_done;
  else
    v_just_completed := new.is_done and old.is_done is distinct from new.is_done;
  end if;

  if v_just_completed then
    select count(*), count(*) filter (where is_done) into v_total, v_done
      from public.checklist_items where card_id = new.card_id;

    if v_total > 0 and v_total = v_done then
      select project_id into v_project from public.cards where id = new.card_id;
      for v_rule in
        select id from public.automation_rules
        where project_id = v_project
          and enabled = true
          and trigger_type = 'checklist_completed'
      loop
        perform public.fire_automation_rule(v_rule.id, new.card_id);
      end loop;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists run_automations_for_checklist on public.checklist_items;
create trigger run_automations_for_checklist
  after insert or update of is_done on public.checklist_items
  for each row
  execute function public.run_automations_for_checklist();

-- 8. due_date_passed: cron-driven (no row write happens "when a date passes") -
-- automation_rule_fires is a one-shot dedupe marker, exactly the shape
-- reminder_sent_for/recurrence_last_run_on play for the reminders/recurrence
-- crons — without it, a rule would re-fire its action every time the cron scans
-- (every N minutes) for as long as the card stays overdue. Deliberately keyed
-- per (rule, card) forever: once a due_date_passed rule has fired for a card it
-- never fires again for that same card, even if the due date is later changed
-- and passes a second time — a simplifying v1 choice, written down here rather
-- than silently assumed.
create table if not exists public.automation_rule_fires (
  rule_id  uuid not null references public.automation_rules (id) on delete cascade,
  card_id  uuid not null references public.cards (id) on delete cascade,
  fired_at timestamptz not null default now(),
  primary key (rule_id, card_id)
);

comment on table public.automation_rule_fires is
  'One-shot dedupe marker so a due_date_passed automation fires at most once per (rule, card) — consumed only by run_due_date_automations(). Same deny-all-client posture as processed_webhooks/rate_limit_events.';

alter table public.automation_rule_fires enable row level security;
revoke all on public.automation_rule_fires from anon, authenticated;
grant select, insert on public.automation_rule_fires to service_role;

-- The cron entrypoint. SECURITY DEFINER + revoked from anon/authenticated, same
-- posture as due_reminder_candidates/run_due_card_recurrences: only the
-- service role (the run-automations Edge Function, called by pg_cron) may call
-- this. Considers a card "overdue" the same way the reminders feature does —
-- due_at when set (the precise deadline), else end-of-day UTC on due_date.
create or replace function public.run_due_date_automations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card record;
  v_rule record;
  v_fired integer := 0;
begin
  for v_card in
    select c.id, c.project_id
    from public.cards c
    where c.due_date is not null
      and coalesce(c.due_at, (c.due_date::timestamptz + interval '1 day')) < now()
  loop
    for v_rule in
      select r.id
      from public.automation_rules r
      where r.project_id = v_card.project_id
        and r.enabled = true
        and r.trigger_type = 'due_date_passed'
        and not exists (
          select 1 from public.automation_rule_fires f
          where f.rule_id = r.id and f.card_id = v_card.id
        )
    loop
      perform public.fire_automation_rule(v_rule.id, v_card.id);
      insert into public.automation_rule_fires (rule_id, card_id)
        values (v_rule.id, v_card.id)
        on conflict do nothing;
      v_fired := v_fired + 1;
    end loop;
  end loop;

  return v_fired;
end;
$$;

revoke all on function public.run_due_date_automations() from public, anon, authenticated;
