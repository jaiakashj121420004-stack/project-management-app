-- Migration: card start_date (Task 25 — Timeline/Gantt view).
--
-- A Gantt bar needs a start AND an end; due_date already is the end, so this
-- adds a nullable start_date as the other endpoint. Deliberately optional: a
-- card with only a due_date (the common case, unchanged from every existing
-- card) still renders on the Timeline — as a single-day bar whose effective
-- start equals its due_date (see effectiveStartDate() in
-- src/features/calendar/timeline.ts) — rather than forcing every card through
-- a two-date setup step before it's useful (reports/SIMPLICITY-GUARDRAIL.md
-- item 3). Dragging a bar's left edge on the Timeline is what turns that
-- single-day marker into a real range, by setting start_date explicitly.

alter table public.cards
  add column if not exists start_date date null;

comment on column public.cards.start_date is
  'Optional Gantt-bar start date (Task 25), paired with due_date as the bar''s end. NULL means "no explicit start" — the Timeline view renders a single-day bar at due_date instead (see effectiveStartDate() in src/features/calendar/timeline.ts). When both are set, start_date must not be after due_date.';

-- Defense in depth: the client always clamps start_date <= due_date when
-- dragging, but the database is the real guarantee (plan.md §6 — "treat the
-- frontend as untrusted"). Either side may still be null; the constraint only
-- fires when both are present. Wrapped in a guard so re-running this
-- migration by hand (SQL Editor) is safe, matching this file's own
-- `add column if not exists` idempotency above.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cards_start_date_not_after_due_date'
  ) then
    alter table public.cards
      add constraint cards_start_date_not_after_due_date
      check (start_date is null or due_date is null or start_date <= due_date);
  end if;
end $$;

-- Partial index: the Timeline view's per-project query only ever needs cards
-- that actually have a start_date set (the common no-start_date case never
-- touches this index).
create index if not exists cards_start_date_idx on public.cards (start_date) where start_date is not null;
