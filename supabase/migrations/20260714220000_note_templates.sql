-- Migration: Custom note templates (Aurora remediation Phase 5).
--
-- Lets a user save their own reusable note structures alongside the hardcoded
-- built-ins (meeting / journal / brief / weekly) surfaced in the slash menu. A
-- template is just a stored Tiptap document plus a name; the slash menu inserts
-- its blocks at the caret. Free feature (no Pro gate), owner-scoped.
--
-- Access model (the frontend is untrusted — RLS is the real guarantee):
--   note_templates → owner only, read + write. owner_id is stamped + made
--   immutable by a SECURITY DEFINER before-write trigger (mirrors `folders`),
--   so a client can never create or reassign a template for another user.
--
-- Idempotent: safe to re-run (create if not exists / drop-then-create policies +
-- trigger).

-- ============================================================================
-- 1. note_templates ----------------------------------------------------------
create table if not exists public.note_templates (
  id           uuid        primary key default gen_random_uuid(),
  -- Defaults to auth.uid(); immutable (note_templates_before_write).
  owner_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  title        text        not null default 'Untitled template'
                           check (char_length(trim(title)) between 1 and 80),
  -- Short menu description; optional.
  subtitle     text        check (subtitle is null or char_length(subtitle) <= 120),
  -- Optional emoji or lucide icon key shown in the manager; the slash menu uses
  -- its own bookmark glyph so this is presentation-only.
  icon         text        check (icon is null or char_length(icon) <= 32),
  -- The Tiptap block document (jsonb). Validated client-side against the shared
  -- editor schema before insert; stored loosely here like notes.content_json.
  content_json jsonb        not null,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);

comment on table public.note_templates is
  'User-authored note templates (Aurora Phase 5). Owner-scoped; merged with the built-in NOTE_TEMPLATES in the editor slash menu. Free feature.';

-- The only access pattern is "my templates, newest-edited first".
create index if not exists note_templates_owner_updated_idx
  on public.note_templates (owner_id, updated_at desc);

-- 1a. Integrity trigger ------------------------------------------------------
-- BEFORE INSERT/UPDATE: stamp updated_at and keep owner_id immutable. SECURITY
-- DEFINER + pinned search_path, matching the folders trigger convention.
create or replace function public.note_templates_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.owner_id is distinct from old.owner_id then
    raise exception 'note_templates.owner_id is immutable';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.note_templates_before_write() is
  'BEFORE INSERT/UPDATE on note_templates: stamp updated_at, keep owner_id immutable.';

drop trigger if exists note_templates_before_write on public.note_templates;
create trigger note_templates_before_write
  before insert or update on public.note_templates
  for each row execute function public.note_templates_before_write();

-- 1b. RLS — owner only -------------------------------------------------------
alter table public.note_templates enable row level security;

drop policy if exists "Note templates: select own" on public.note_templates;
create policy "Note templates: select own"
  on public.note_templates for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "Note templates: insert own" on public.note_templates;
create policy "Note templates: insert own"
  on public.note_templates for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "Note templates: update own" on public.note_templates;
create policy "Note templates: update own"
  on public.note_templates for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Note templates: delete own" on public.note_templates;
create policy "Note templates: delete own"
  on public.note_templates for delete to authenticated
  using (owner_id = auth.uid());
