-- Migration: notes (Phase 7 — per-project notes/docs)
-- See plan.md §5 (data model) and §6 (security model).
--
-- A note is a free-form markdown document that belongs to a project. It reuses
-- the multi-tenant pattern verbatim: every row carries project_id and is gated
-- on membership of that project via the SECURITY DEFINER helper
-- is_project_member(project_id) — no new recursion-avoidance work. The frontend
-- is untrusted; these database rules are the real guarantee.

-- 1. Table -------------------------------------------------------------------
-- `content` holds markdown text (rendered to a live preview client-side). It is
-- capped so a runaway client can't store unbounded data; the title is bounded
-- the same way the rest of the schema bounds names. updated_at is maintained by
-- the trigger below, not the client, so its ordering value is trustworthy.
create table if not exists public.notes (
  id         uuid        primary key default gen_random_uuid(),
  project_id uuid        not null references public.projects (id) on delete cascade,
  title      text        not null default 'Untitled note'
                         check (char_length(trim(title)) between 1 and 120),
  content    text        not null default '' check (char_length(content) <= 100000),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.notes is 'Per-project markdown notes/docs (plan.md §5). Access gated by project membership via RLS.';

-- The notes list is ordered most-recently-edited first, scoped to one project.
create index if not exists notes_project_updated_idx on public.notes (project_id, updated_at desc);

-- 2. updated_at trigger ------------------------------------------------------
-- Autosave issues many UPDATEs; stamp updated_at server-side on every change so
-- the list order and the "saved" time never depend on the (untrusted) client.
create or replace function public.touch_notes_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.touch_notes_updated_at() is
  'BEFORE UPDATE trigger: refresh notes.updated_at server-side on every edit.';

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.touch_notes_updated_at();

-- 3. Row Level Security ------------------------------------------------------
-- Membership is the unit of access (plan.md §6): any member of a project may
-- read and write its notes. Role-based limits (viewers read-only) arrive with
-- collaboration in Phase 8. WITH CHECK on insert/update prevents writing a note
-- into a project the caller can't access.
alter table public.notes enable row level security;

drop policy if exists "Notes: select if member" on public.notes;
create policy "Notes: select if member"
  on public.notes
  for select
  to authenticated
  using (public.is_project_member(project_id));

drop policy if exists "Notes: insert if member" on public.notes;
create policy "Notes: insert if member"
  on public.notes
  for insert
  to authenticated
  with check (public.is_project_member(project_id));

drop policy if exists "Notes: update if member" on public.notes;
create policy "Notes: update if member"
  on public.notes
  for update
  to authenticated
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

drop policy if exists "Notes: delete if member" on public.notes;
create policy "Notes: delete if member"
  on public.notes
  for delete
  to authenticated
  using (public.is_project_member(project_id));
