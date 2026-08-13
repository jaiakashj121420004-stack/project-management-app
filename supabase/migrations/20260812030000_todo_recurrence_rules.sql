-- Migration: custom to-do recurrence rules (replaces the old localStorage
-- "same name = daily reseed" mechanism entirely with a real, per-list rule).
-- (decision log, memory.md, 2026-08-12 — feature request session.)
--
-- A recurrence is a named template (list name + item texts) plus a JSON rule
-- describing WHEN it should regenerate:
--   { "type": "daily" }
--   { "type": "weekly",   "weekdays": [1,3,5] }        -- 0=Sun … 6=Sat
--   { "type": "monthly",  "day": 1 }                   -- or "day": "last"
--   { "type": "interval", "unit": "day"|"week"|"month", "count": 2,
--     "anchor": "2026-08-12" }                          -- every N units from anchor
-- The client (TodosPage) evaluates the rule against the day it's viewing and
-- lazily creates that day's list the first time it's opened — no cron needed,
-- exactly like the old mechanism, just DB-backed and richer. `todo_lists.
-- source_recurrence_id` marks which list is "today's instance of template X" so
-- we never duplicate it, even if the user renames or empties that day's list.
--
-- Gating: "daily" is free (matches the old free behaviour exactly). The three
-- custom modes (weekly / monthly / interval) are Pro — enforced here in a
-- trigger, not just the UI, same as every other Pro gate in this app.

-- 1. Table ---------------------------------------------------------------
create table if not exists public.todo_recurrences (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  name       text        not null check (char_length(trim(name)) between 1 and 60),
  -- Ordered item texts to recreate on each matching day (jsonb array of strings).
  items      jsonb       not null default '[]'::jsonb,
  rule       jsonb       not null,
  active     boolean     not null default true,
  created_at timestamptz not null default now()
);

comment on table public.todo_recurrences is
  'Custom repeat rules for daily to-do lists (weekly/monthly/interval; "daily" is free, the rest are Pro). Private to their owner via RLS.';

create index if not exists todo_recurrences_user_idx on public.todo_recurrences (user_id) where active;

-- 2. Link a generated list back to the template that created it, so re-opening
--    a day never creates a duplicate even after a rename or an emptied list.
alter table public.todo_lists
  add column if not exists source_recurrence_id uuid references public.todo_recurrences (id) on delete set null;

create index if not exists todo_lists_source_recurrence_idx
  on public.todo_lists (source_recurrence_id, list_date);

-- 3. Row Level Security ----------------------------------------------------
alter table public.todo_recurrences enable row level security;

drop policy if exists "Todo recurrences: select own" on public.todo_recurrences;
create policy "Todo recurrences: select own"
  on public.todo_recurrences for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Todo recurrences: insert own" on public.todo_recurrences;
create policy "Todo recurrences: insert own"
  on public.todo_recurrences for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Todo recurrences: update own" on public.todo_recurrences;
create policy "Todo recurrences: update own"
  on public.todo_recurrences for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Todo recurrences: delete own" on public.todo_recurrences;
create policy "Todo recurrences: delete own"
  on public.todo_recurrences for delete to authenticated
  using (user_id = auth.uid());

-- 4. Plan gate: only "daily" may be created/edited by a Free user. Fails
--    closed with a clear hint the client can surface as an upgrade prompt.
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

drop trigger if exists enforce_recurrence_plan on public.todo_recurrences;
create trigger enforce_recurrence_plan
  before insert or update on public.todo_recurrences
  for each row
  execute function public.enforce_recurrence_plan();
