-- Migration: Custom project templates ("save as template" builder).
--
-- Aurora's curated *system* templates (Freelance client project, Content
-- calendar, Simple sprint board, Personal goals tracker, Event planning, Job
-- search tracker) ship as static frontend data — see
-- src/features/projects/projectTemplates.ts — exactly like the daily to-do
-- planner's STARTER_TEMPLATES. They are NOT rows in this table today. This
-- table exists for the thing that *can't* be hardcoded: a user's own
-- "save as template" snapshot of a real project's columns + starter card
-- skeletons (title, checklist text, label name/color — NOT live due dates,
-- assignees, comments, or attachments).
--
-- `source` ('system' | 'user') exists so a first-class admin-authored system
-- row could be added later without a schema change, and the RLS below already
-- supports that shape — but the app only ever inserts 'user' rows; nothing
-- writes 'system' rows yet.
--
-- Access model (the frontend is untrusted — RLS is the real guarantee):
--   project_templates → a user reads their own 'user' rows plus every
--   'system' row; only ever writes (insert/update/delete) their own 'user'
--   rows. owner_id + source are stamped/kept immutable by a SECURITY DEFINER
--   before-write trigger, mirroring note_templates
--   (20260714220000_note_templates.sql) — including the insert WITH CHECK
--   that pins source = 'user' so a client can never mint a fake system row.
--
-- Idempotent: safe to re-run (create if not exists / drop-then-create
-- policies + trigger).

-- ============================================================================
-- 1. project_templates ---------------------------------------------------------
create table if not exists public.project_templates (
  id           uuid        primary key default gen_random_uuid(),
  -- Defaults to auth.uid(); immutable (project_templates_before_write).
  owner_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  -- Immutable after insert (project_templates_before_write). Only 'user' is
  -- ever written by the app; 'system' is reserved for a future admin path.
  source       text        not null default 'user' check (source in ('system', 'user')),
  name         text        not null check (char_length(trim(name)) between 1 and 80),
  -- Short one-line description shown in the template grid; optional.
  description  text        check (description is null or char_length(description) <= 200),
  -- Optional emoji shown in the template grid; presentation-only.
  icon         text        check (icon is null or char_length(icon) <= 8),
  -- { columns: [{ name, cards: [{ title, checklist?, labels? }] }] } — the same
  -- shape as PROJECT_TEMPLATES' payload in projectTemplates.ts. Validated
  -- client-side against projectTemplatePayloadSchema before insert; stored
  -- loosely here like note_templates.content_json.
  payload      jsonb       not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.project_templates is
  'User-authored "save as template" snapshots of a project''s columns + starter cards (source=''user''), plus schema room for a future source=''system'' row. Curated system templates ship as static data today — see src/features/projects/projectTemplates.ts.';

-- The only access patterns are "my templates, newest-edited first" and (for a
-- future system row) a plain source lookup — both covered by this one index.
create index if not exists project_templates_owner_updated_idx
  on public.project_templates (owner_id, updated_at desc);

-- 1a. Integrity trigger ------------------------------------------------------
-- BEFORE INSERT/UPDATE: stamp updated_at, keep owner_id AND source immutable.
-- SECURITY DEFINER + pinned search_path, matching the note_templates trigger.
create or replace function public.project_templates_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.owner_id is distinct from old.owner_id then
    raise exception 'project_templates.owner_id is immutable';
  end if;
  if tg_op = 'UPDATE' and new.source is distinct from old.source then
    raise exception 'project_templates.source is immutable';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.project_templates_before_write() is
  'BEFORE INSERT/UPDATE on project_templates: stamp updated_at, keep owner_id/source immutable.';

drop trigger if exists project_templates_before_write on public.project_templates;
create trigger project_templates_before_write
  before insert or update on public.project_templates
  for each row execute function public.project_templates_before_write();

-- 1b. RLS ---------------------------------------------------------------------
-- Read: your own rows OR any system row (none exist yet, but the policy is
-- ready for one). Write: only ever your own, and only ever source = 'user' —
-- the insert/update WITH CHECK is what actually stops a client from minting a
-- row that would be readable by every other user.
alter table public.project_templates enable row level security;

drop policy if exists "Project templates: select own or system" on public.project_templates;
create policy "Project templates: select own or system"
  on public.project_templates for select to authenticated
  using (source = 'system' or owner_id = auth.uid());

drop policy if exists "Project templates: insert own" on public.project_templates;
create policy "Project templates: insert own"
  on public.project_templates for insert to authenticated
  with check (owner_id = auth.uid() and source = 'user');

drop policy if exists "Project templates: update own" on public.project_templates;
create policy "Project templates: update own"
  on public.project_templates for update to authenticated
  using (owner_id = auth.uid() and source = 'user')
  with check (owner_id = auth.uid() and source = 'user');

drop policy if exists "Project templates: delete own" on public.project_templates;
create policy "Project templates: delete own"
  on public.project_templates for delete to authenticated
  using (owner_id = auth.uid() and source = 'user');
