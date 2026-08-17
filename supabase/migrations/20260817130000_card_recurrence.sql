-- Migration: recurring Kanban cards (feature request session, 2026-08-17).
--
-- Unlike to-do recurrence (a separate `todo_recurrences` template table that
-- lazily reseeds a day's list client-side — 20260812030000_todo_recurrence_
-- rules.sql), a card has no "day being viewed" to reseed against, so this adds
-- the rule directly to `cards` and drives it from a real cron, the same
-- pattern already used for due-date reminders (send-due-reminders + pg_cron +
-- pg_net, see supabase/README.md). The card carrying `recurrence_rule` IS the
-- template: `run_due_card_recurrences()` creates a brand-new card each time
-- the rule matches today and never sets `recurrence_rule` on the card it
-- creates, so only the original keeps regenerating (no runaway chains).
--
-- Rule shape is identical to todo_recurrences.rule (src/lib/recurrence.ts):
--   { "type": "daily" }
--   { "type": "weekly",   "weekdays": [1,3,5] }        -- 0=Sun … 6=Sat
--   { "type": "monthly",  "day": 1 }                   -- or "day": "last"
--   { "type": "interval", "unit": "day"|"week"|"month", "count": 2,
--     "anchor": "2026-08-17" }
-- Gating mirrors todos too: "daily" is free, the other three need the
-- project's owner on Pro (project_is_pro(), 20260622160000_collaboration_
-- pro.sql) — enforced in a trigger, not just the UI.

-- 1. Columns -----------------------------------------------------------------
alter table public.cards
  add column if not exists recurrence_rule jsonb null,
  add column if not exists recurrence_last_run_on date null;

comment on column public.cards.recurrence_rule is
  'jsonb RecurrenceRule (src/lib/recurrence.ts) or null. This card is the recurring template; run_due_card_recurrences() creates fresh new cards from it and never sets this on them.';
comment on column public.cards.recurrence_last_run_on is
  'Dedupe marker: the last calendar date (UTC) this template card generated an occurrence for, so the cron never double-fires within a day.';

-- Partial index: the cron only ever scans cards that actually have a rule.
create index if not exists cards_recurrence_rule_idx
  on public.cards (id)
  where recurrence_rule is not null;

-- 2. Plan gate: only "daily" may be set by a project on the Free plan. Fails
--    closed with a clear hint the client can surface as an upgrade prompt —
--    same shape as todos' enforce_recurrence_plan.
create or replace function public.enforce_card_recurrence_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule_type text;
begin
  if new.recurrence_rule is null then
    return new;
  end if;

  v_rule_type := new.recurrence_rule ->> 'type';
  if v_rule_type is null or v_rule_type not in ('daily', 'weekly', 'monthly', 'interval') then
    raise exception 'INVALID_RECURRENCE_RULE';
  end if;

  if v_rule_type <> 'daily' and not public.project_is_pro(new.project_id) then
    raise exception 'RECURRENCE_REQUIRES_PRO'
      using hint = 'Custom repeat schedules (specific weekdays, monthly, every N weeks/months) need this project on Pro. Daily repeat is free.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_card_recurrence_plan on public.cards;
create trigger enforce_card_recurrence_plan
  before insert or update of recurrence_rule on public.cards
  for each row
  execute function public.enforce_card_recurrence_plan();

-- 3. Rule matching, mirrored from ruleMatchesDate() in src/lib/recurrence.ts.
--    Keep the two in sync if that logic ever changes — this is the one place
--    a cron (no access to the frontend bundle) can evaluate a rule.
create or replace function public.recurrence_rule_matches_date(p_rule jsonb, p_date date)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_type text := p_rule ->> 'type';
  v_anchor date;
  v_count int;
  v_unit text;
  v_day text;
  v_weeks int;
  v_cursor date;
  v_guard int := 0;
begin
  if v_type = 'daily' then
    return true;

  elsif v_type = 'weekly' then
    return exists (
      select 1
      from jsonb_array_elements_text(p_rule -> 'weekdays') as wd
      where wd::int = extract(dow from p_date)::int
    );

  elsif v_type = 'monthly' then
    v_day := p_rule ->> 'day';
    if v_day = 'last' then
      return p_date = ((date_trunc('month', p_date) + interval '1 month - 1 day')::date);
    end if;
    -- A day like 31 simply never fires in a 30-day month — no clamping, same
    -- as the client-side implementation.
    return extract(day from p_date)::int = v_day::int;

  elsif v_type = 'interval' then
    v_anchor := (p_rule ->> 'anchor')::date;
    v_count := greatest((p_rule ->> 'count')::int, 1);
    v_unit := p_rule ->> 'unit';
    if p_date < v_anchor then
      return false;
    end if;

    if v_unit = 'day' then
      return mod((p_date - v_anchor)::int, v_count) = 0;
    elsif v_unit = 'week' then
      if extract(dow from p_date) <> extract(dow from v_anchor) then
        return false;
      end if;
      v_weeks := round((p_date - v_anchor) / 7.0);
      return mod(v_weeks, v_count) = 0;
    else -- 'month': walk forward from the anchor so short months don't skew
         -- the cadence, exactly like the client-side loop.
      v_cursor := v_anchor;
      while v_cursor < p_date and v_guard < 1200 loop
        v_cursor := v_cursor + make_interval(months => v_count);
        v_guard := v_guard + 1;
      end loop;
      return v_cursor = p_date;
    end if;
  end if;

  return false;
end;
$$;

-- 4. The cron entrypoint: find every template card whose rule matches today
--    (UTC calendar date, matching due_date's convention elsewhere) and hasn't
--    already fired today, and create the next occurrence — a genuinely new
--    card (fresh checklist, unchecked; same labels/priority/assignee; NO
--    comments/attachments/time entries/activity carried over, and no
--    recurrence_rule of its own). SECURITY DEFINER + revoked from
--    authenticated/anon: only the service role (the Edge Function below) may
--    call this, same posture as due_reminder_candidates/mark_reminders_sent.
create or replace function public.run_due_card_recurrences()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card record;
  v_new_card_id uuid;
  v_new_position double precision;
  v_created integer := 0;
  v_today date := (now() at time zone 'utc')::date;
begin
  for v_card in
    select *
    from public.cards
    where recurrence_rule is not null
      and (recurrence_last_run_on is null or recurrence_last_run_on <> v_today)
      and public.recurrence_rule_matches_date(recurrence_rule, v_today)
  loop
    select coalesce(max(position), 0) + 1000
    into v_new_position
    from public.cards
    where column_id = v_card.column_id;

    insert into public.cards (
      project_id, column_id, title, description, due_date, due_at,
      assignee_id, priority, position
    ) values (
      v_card.project_id, v_card.column_id, v_card.title, v_card.description,
      v_today, null, v_card.assignee_id, v_card.priority, v_new_position
    )
    returning id into v_new_card_id;

    -- Fresh checklist: same items, all reset to not-done. No comments,
    -- attachments, time entries, or activity — those stay with the original.
    insert into public.checklist_items (card_id, text, is_done, position)
    select v_new_card_id, text, false, position
    from public.checklist_items
    where card_id = v_card.id;

    insert into public.card_labels (card_id, label_id)
    select v_new_card_id, label_id
    from public.card_labels
    where card_id = v_card.id;

    update public.cards
    set recurrence_last_run_on = v_today
    where id = v_card.id;

    v_created := v_created + 1;
  end loop;

  return v_created;
end;
$$;

revoke all on function public.run_due_card_recurrences() from public, anon, authenticated;
revoke all on function public.recurrence_rule_matches_date(jsonb, date) from public, anon, authenticated;
