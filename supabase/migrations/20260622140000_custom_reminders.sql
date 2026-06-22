-- Pro Phase P1 — custom timed reminders.
--
-- Free keeps the existing day-based reminder (cards.due_date +
-- profiles.reminder_lead_days + cards.reminder_sent_for + the daily digest in
-- 20260621090000_reminders.sql). This migration adds the PRECISE path that Pro
-- unlocks: a due *time* (cards.due_at) and multiple arbitrary offsets per card
-- (card_reminders), fired on both the email and browser channels. None of the
-- Phase 9 objects are dropped or weakened — both paths run side by side.
--
-- Gating is the same two-layer rule as the rest of Pro (plan.md §6,
-- prompts.md → "The Pro-gating principle"): the UI is UX only; the DATABASE is
-- the real gate. project_is_pro(board owner's plan) governs who may CREATE a
-- custom reminder, so a free user can't insert one even via the raw API.

-- 1. cards.due_at -------------------------------------------------------------
-- A full timestamp for the deadline. due_date (a bare YYYY-MM-DD) stays for
-- back-compat and is still what the board/calendar group by; due_at is the
-- SOURCE OF TRUTH for the moment a card is due whenever it is present, and is
-- what the offset reminders below are measured against.
alter table public.cards
  add column if not exists due_at timestamptz;

-- Backfill: existing dated cards get due_at = their due_date at 09:00 UTC.
-- Rationale for 09:00 UTC: we don't store a per-user timezone, and these cards
-- predate timed reminders (no card_reminders reference them), so the exact
-- instant is immaterial — 09:00 is a sane "morning of" default and UTC is the
-- DB session zone. Going forward the app writes due_at from the user's local
-- date+time. Only fills nulls so it is safe to re-run.
update public.cards
  set due_at = ((due_date::timestamp + interval '9 hours') at time zone 'utc')
  where due_date is not null
    and due_at is null;

-- 2. card_reminders -----------------------------------------------------------
-- One row per offset the user wants on a card (a card may have many). channel
-- decides delivery: 'email' is sent by the Edge Function, 'push' is fired by the
-- in-app browser-notification poller. offset_minutes is "how long before due_at"
-- (0 = at due_at). created_by is audit only — reminders are delivered to the
-- card's ASSIGNEE, matching the Phase 9 email path.
create table if not exists public.card_reminders (
  id             uuid        primary key default gen_random_uuid(),
  card_id        uuid        not null references public.cards (id) on delete cascade,
  offset_minutes integer     not null check (offset_minutes >= 0),
  channel        text        not null default 'email' check (channel in ('email', 'push')),
  created_by     uuid        references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists card_reminders_card_id_idx on public.card_reminders (card_id);

-- card_project_is_pro: does the card's project belong to a Pro board owner?
-- card_reminders only carries card_id, so this resolves card → project and
-- defers to project_is_pro. SECURITY DEFINER so the card lookup bypasses RLS
-- (no re-entry); the answer is identical to project_is_pro for the card's board.
create or replace function public.card_project_is_pro(p_card_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select public.project_is_pro(c.project_id)
  from public.cards c
  where c.id = p_card_id;
$$;

comment on function public.card_project_is_pro(uuid) is
  'SECURITY DEFINER: is the board owning this card on Pro? Gates card_reminders INSERT (prompts.md P1).';

grant execute on function public.card_project_is_pro(uuid) to authenticated;

alter table public.card_reminders enable row level security;

-- SELECT: any member of the card's project may read its reminders.
drop policy if exists "card_reminders: select if card member" on public.card_reminders;
create policy "card_reminders: select if card member"
  on public.card_reminders
  for select
  to authenticated
  using (public.can_access_card(card_id));

-- INSERT: an owner/editor of the card's project may add a reminder, AND the
-- board must be Pro. This is the real Pro gate — a free user is rejected here
-- even hitting the API directly (prompts.md P1 verification).
drop policy if exists "card_reminders: insert if pro editor" on public.card_reminders;
create policy "card_reminders: insert if pro editor"
  on public.card_reminders
  for insert
  to authenticated
  with check (
    public.can_edit_card(card_id)
    and public.card_project_is_pro(card_id)
  );

-- UPDATE / DELETE: an owner/editor may change or remove a reminder. We do NOT
-- re-require Pro here, mirroring the canvas-media policy where *reading*/cleanup
-- survives a lapsed plan but *creating* needs Pro.
drop policy if exists "card_reminders: update if editor" on public.card_reminders;
create policy "card_reminders: update if editor"
  on public.card_reminders
  for update
  to authenticated
  using (public.can_edit_card(card_id))
  with check (public.can_edit_card(card_id));

drop policy if exists "card_reminders: delete if editor" on public.card_reminders;
create policy "card_reminders: delete if editor"
  on public.card_reminders
  for delete
  to authenticated
  using (public.can_edit_card(card_id));

-- 3. card_reminder_dispatches -------------------------------------------------
-- Dedupe ledger so a given reminder fires at most once per due_at instance, and
-- RE-ARMS automatically when due_at changes (a new due_at has no dispatch row).
-- Written only by the service-role Edge Function via mark_time_reminders_sent;
-- RLS is enabled with NO policies, so no browser role can read or write it (the
-- browser path dedupes in its own localStorage instead).
create table if not exists public.card_reminder_dispatches (
  card_reminder_id uuid        not null references public.card_reminders (id) on delete cascade,
  due_at           timestamptz not null,
  sent_at          timestamptz not null default now(),
  primary key (card_reminder_id, due_at)
);

alter table public.card_reminder_dispatches enable row level security;

-- 4. due_time_reminder_candidates --------------------------------------------
-- Per pending EMAIL reminder, is now() inside [fire_at, fire_at + window) where
-- fire_at = due_at - offset_minutes, the board is Pro, the card has an assignee
-- with an email, and the reminder hasn't been dispatched for this due_at yet?
-- The window (default 10 min = the cron interval) bounds the search; the dispatch
-- ledger is the real idempotency guarantee. SECURITY DEFINER (reads auth.users
-- for the email + bypasses RLS) and granted to service_role ONLY — the browser
-- path queries card_reminders directly under RLS, never this RPC.
create or replace function public.due_time_reminder_candidates(p_window_minutes integer default 10)
returns table (
  card_reminder_id uuid,
  card_id          uuid,
  title            text,
  due_at           timestamptz,
  offset_minutes   integer,
  project_id       uuid,
  project_name     text,
  assignee_id      uuid,
  email            text,
  display_name     text
)
language sql
security definer
set search_path = ''
as $$
  select
    cr.id, c.id, c.title, c.due_at, cr.offset_minutes,
    c.project_id, p.name, c.assignee_id, u.email, pr.display_name
  from public.card_reminders cr
  join public.cards c     on c.id = cr.card_id
  join public.projects p  on p.id = c.project_id
  join auth.users u       on u.id = c.assignee_id
  join public.profiles pr on pr.id = c.assignee_id
  where cr.channel = 'email'
    and c.due_at is not null
    and c.assignee_id is not null
    and u.email is not null
    and public.project_is_pro(c.project_id)
    and now() >= c.due_at - make_interval(mins => cr.offset_minutes)
    and now() <  c.due_at - make_interval(mins => cr.offset_minutes)
                 + make_interval(mins => coalesce(p_window_minutes, 10))
    and not exists (
      select 1
      from public.card_reminder_dispatches d
      where d.card_reminder_id = cr.id
        and d.due_at = c.due_at
    )
  order by u.email, c.due_at;
$$;

-- 5. mark_time_reminders_sent -------------------------------------------------
-- Record a dispatch for each given reminder at its card's CURRENT due_at, so it
-- won't fire again for that instance. ON CONFLICT DO NOTHING keeps it idempotent
-- under overlapping runs. Service-role only.
create or replace function public.mark_time_reminders_sent(p_reminder_ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.card_reminder_dispatches (card_reminder_id, due_at)
  select cr.id, c.due_at
  from public.card_reminders cr
  join public.cards c on c.id = cr.card_id
  where cr.id = any(p_reminder_ids)
    and c.due_at is not null
  on conflict (card_reminder_id, due_at) do nothing;
$$;

-- Both RPCs are server-only (the Edge Function): deny browser roles, allow service_role.
revoke all on function public.due_time_reminder_candidates(integer) from public, anon, authenticated;
revoke all on function public.mark_time_reminders_sent(uuid[]) from public, anon, authenticated;
grant execute on function public.due_time_reminder_candidates(integer) to service_role;
grant execute on function public.mark_time_reminders_sent(uuid[]) to service_role;
