-- Migration: time_entries — simple per-card start/stop time tracking (v1).
-- See plan.md §5 (data model) and §6 (security model). Scoped per
-- reports/FEATURE-GAP-ANALYSIS.md item #1 / IMPROVEMENT-PLAN-2026-08.md Task 16:
-- start, stop, see a running total per card. Deliberately NOT billable rates,
-- invoicing, timesheet reports/exports, or tracking on to-do items — that's a
-- separate, later decision (memory.md).
--
-- One row per tracked interval on a card. `ended_at is null` means "currently
-- running" — the same nullable-sentinel pattern already used by cards.due_at.
-- Read access is gated by card→project membership via the SAME can_access_card()
-- SECURITY DEFINER helper checklist_items/card_labels already use
-- (20260618160000_card_details.sql) — nothing new to add there. Write access is
-- additionally scoped to the entry's OWN user: RLS's WITH CHECK enforces
-- auth.uid() = user_id on insert/update/delete, so a member can start/stop only
-- their own timer, never someone else's, even though every project member can
-- see everyone's entries (needed for the card's running total).
--
-- "One active entry per user at a time" is enforced GLOBALLY (not just per
-- card): starting a new timer while one is running elsewhere stops the old one
-- first (src/features/board/cardExtras.api.ts' startTimeEntry), and the partial
-- unique index below is the database-level guarantee behind that client-side
-- sequencing — a race (or a bug) can never leave two entries running for the
-- same user.

-- 1. Table ---------------------------------------------------------------

create table if not exists public.time_entries (
  id         uuid        primary key default gen_random_uuid(),
  card_id    uuid        not null references public.cards (id) on delete cascade,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  -- Null while the timer is running; set once, on stop.
  ended_at   timestamptz null,
  created_at timestamptz not null default now(),
  constraint time_entries_ended_after_started check (ended_at is null or ended_at >= started_at)
);

comment on table public.time_entries is 'Per-card start/stop time tracking (v1: card-only, no billable rates/invoicing/reports — plan.md §5). Read gated by the card''s project membership via RLS; writes additionally scoped to the entry''s own user.';

-- Lookups: entries by card (Time section + running total, batch-fetched like
-- checklist_items/card_labels in cardExtras.api.ts) and by user (the
-- stop-any-running-entry step of starting a new timer).
create index if not exists time_entries_card_id_idx on public.time_entries (card_id);
create index if not exists time_entries_user_id_idx on public.time_entries (user_id);

-- One running entry per user at a time, database-enforced (see note above).
create unique index if not exists time_entries_one_running_per_user
  on public.time_entries (user_id)
  where ended_at is null;

-- 2. Row Level Security ----------------------------------------------------
-- Membership is the read unit (plan.md §6), same as checklist_items: any member
-- of the card's project may see every entry on it (needed for the running
-- total). Writes are further scoped to the caller's own rows so nobody can
-- start, stop, or delete another member's timer.
alter table public.time_entries enable row level security;

drop policy if exists "Time entries: select if member" on public.time_entries;
create policy "Time entries: select if member"
  on public.time_entries
  for select
  to authenticated
  using (public.can_access_card(card_id));

drop policy if exists "Time entries: insert own if member" on public.time_entries;
create policy "Time entries: insert own if member"
  on public.time_entries
  for insert
  to authenticated
  with check (public.can_access_card(card_id) and user_id = auth.uid());

drop policy if exists "Time entries: update own if member" on public.time_entries;
create policy "Time entries: update own if member"
  on public.time_entries
  for update
  to authenticated
  using (public.can_access_card(card_id) and user_id = auth.uid())
  with check (public.can_access_card(card_id) and user_id = auth.uid());

drop policy if exists "Time entries: delete own if member" on public.time_entries;
create policy "Time entries: delete own if member"
  on public.time_entries
  for delete
  to authenticated
  using (public.can_access_card(card_id) and user_id = auth.uid());
