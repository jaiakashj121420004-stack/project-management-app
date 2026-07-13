-- Migration: Library — unified folder tree + standalone notes (Nvexis Phase 2)
-- See NVEXIS-UPGRADE-PLAN.md §4 and plan.md §5–6.
--
-- Phase 2 turns Notes + Canvases into a real file explorer: one unified "Library"
-- of FOLDERS (infinitely nestable) that can hold BOTH standalone notes and
-- personal canvases. Two structural changes make it possible:
--   1. A new `folders` table (owner-scoped, self-referencing for nesting).
--   2. `notes` becomes project-OPTIONAL (like canvases already are): it gains
--      `owner_id` + a nullable `project_id` + a `folder_id`, so a note can live
--      inside a project (as today) OR stand alone in the Library.
-- `canvas_notes` only needs a `folder_id` (it is already owner/project-optional
-- from 20260622200000_canvas_standalone.sql).
--
-- Access model (the frontend is untrusted — RLS is the real guarantee):
--   folders  → owner only (folder sharing arrives in Phase 4 via folder_members).
--   notes    → read by owner OR project member; write by owner (standalone) OR
--              project editor (project note). Standalone notes are FREE (no Pro
--              gate); canvases keep their existing Pro gate untouched.

-- ============================================================================
-- 1. folders -----------------------------------------------------------------
-- A folder belongs to one user and may nest under another of THEIR folders
-- (parent_id self-ref). Deleting a folder cascades to its subfolders; its notes
-- and canvases are NOT deleted — their folder_id is set null (they fall back to
-- the Library root) via the FK below. position orders siblings in the tree.
create table if not exists public.folders (
  id         uuid        primary key default gen_random_uuid(),
  owner_id   uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  parent_id  uuid        references public.folders (id) on delete cascade,
  name       text        not null default 'New folder'
                         check (char_length(trim(name)) between 1 and 80),
  position   integer     not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.folders is
  'Library folders (NVEXIS-UPGRADE-PLAN §4). Owner-scoped, self-nesting; holds standalone notes + personal canvases via their folder_id. Folder sharing (folder_members) is Phase 4.';

-- The tree is drawn owner → siblings-by-position; both list paths are covered.
create index if not exists folders_owner_idx on public.folders (owner_id);
create index if not exists folders_parent_idx on public.folders (parent_id);

-- 1a. Integrity trigger ------------------------------------------------------
-- BEFORE INSERT/UPDATE: stamp updated_at, keep owner_id immutable, and validate
-- parent_id — it must be owned by the same user, never the row itself, and never
-- create a cycle (walk the ancestor chain). SECURITY DEFINER so the ancestor walk
-- sees the whole tree regardless of RLS.
create or replace function public.folders_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ancestor uuid;
  guard    int := 0;
begin
  if tg_op = 'UPDATE' and new.owner_id is distinct from old.owner_id then
    raise exception 'folders.owner_id is immutable';
  end if;

  new.updated_at = now();

  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'a folder cannot be its own parent';
    end if;

    if not exists (
      select 1 from public.folders f
      where f.id = new.parent_id and f.owner_id = new.owner_id
    ) then
      raise exception 'parent folder must exist and be owned by you';
    end if;

    -- Reject a move that would put the folder inside its own subtree.
    ancestor := new.parent_id;
    while ancestor is not null loop
      guard := guard + 1;
      if guard > 1000 then
        raise exception 'folder hierarchy too deep';
      end if;
      if ancestor = new.id then
        raise exception 'folder move would create a cycle';
      end if;
      select parent_id into ancestor from public.folders where id = ancestor;
    end loop;
  end if;

  return new;
end;
$$;

comment on function public.folders_before_write() is
  'BEFORE INSERT/UPDATE on folders: stamp updated_at, keep owner_id immutable, validate parent_id (owned, non-self, acyclic).';

drop trigger if exists folders_before_write on public.folders;
create trigger folders_before_write
  before insert or update on public.folders
  for each row execute function public.folders_before_write();

-- 1b. RLS — owner only -------------------------------------------------------
alter table public.folders enable row level security;

drop policy if exists "Folders: select own" on public.folders;
create policy "Folders: select own"
  on public.folders for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "Folders: insert own" on public.folders;
create policy "Folders: insert own"
  on public.folders for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "Folders: update own" on public.folders;
create policy "Folders: update own"
  on public.folders for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Folders: delete own" on public.folders;
create policy "Folders: delete own"
  on public.folders for delete to authenticated
  using (owner_id = auth.uid());

-- ============================================================================
-- 2. notes: owner_id + nullable project_id + folder_id -----------------------
-- owner_id records the note's owner. Existing rows are BACKFILLED from the note's
-- project owner (every note was a project note until now); new rows default to
-- the creator. project_id becomes NULLABLE so a note can stand alone. folder_id
-- files a standalone note into the Library (null = Library root); it is set null
-- if the folder is deleted, so notes are never lost with a folder.
alter table public.notes
  add column if not exists owner_id uuid references auth.users (id) on delete cascade;

update public.notes n
set owner_id = p.owner_id
from public.projects p
where n.project_id = p.id
  and n.owner_id is null;

alter table public.notes alter column owner_id set default auth.uid();
alter table public.notes alter column owner_id set not null;
alter table public.notes alter column project_id drop not null;

alter table public.notes
  add column if not exists folder_id uuid references public.folders (id) on delete set null;

comment on column public.notes.owner_id is
  'The note owner. For a standalone note (project_id null) this is the only ownership path; for a project note it records the creator. Immutable (touch_notes_updated_at).';
comment on column public.notes.folder_id is
  'Library folder for a standalone note (null = Library root). Project notes leave this null.';

-- The Library note list is "my standalone notes, most-recently-edited first".
create index if not exists notes_owner_updated_idx on public.notes (owner_id, updated_at desc);
create index if not exists notes_folder_idx on public.notes (folder_id);

-- 2a. Extend the updated_at trigger with immutability ------------------------
-- The existing touch trigger only stamped updated_at. Now also reject changing
-- owner_id or project_id (a note never migrates owners or projects — folder_id is
-- the only thing that moves). Autosave patches title/content/folder_id, so this
-- only fires on a tampered write.
create or replace function public.touch_notes_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'notes.owner_id is immutable';
  end if;
  if new.project_id is distinct from old.project_id then
    raise exception 'notes.project_id is immutable';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

-- 2b. Rewrite notes RLS for owner-or-project ---------------------------------
-- read   = the owner OR a member of the note's project.
-- write  = the owner (standalone) OR a project editor (project note). This keeps
--          the existing "project editors write, viewers read-only" behaviour and
--          adds the standalone owner path. Standalone notes are FREE — no Pro gate.
drop policy if exists "Notes: select if member" on public.notes;
drop policy if exists "Notes: select if owner or member" on public.notes;
create policy "Notes: select if owner or member"
  on public.notes for select to authenticated
  using (
    owner_id = auth.uid()
    or (project_id is not null and public.is_project_member(project_id))
  );

drop policy if exists "Notes: insert if editor" on public.notes;
drop policy if exists "Notes: insert if owner or editor" on public.notes;
create policy "Notes: insert if owner or editor"
  on public.notes for insert to authenticated
  with check (
    (project_id is null and owner_id = auth.uid())
    or (project_id is not null and public.can_edit_project(project_id))
  );

drop policy if exists "Notes: update if editor" on public.notes;
drop policy if exists "Notes: update if owner or editor" on public.notes;
create policy "Notes: update if owner or editor"
  on public.notes for update to authenticated
  using (
    (project_id is null and owner_id = auth.uid())
    or (project_id is not null and public.can_edit_project(project_id))
  )
  with check (
    (project_id is null and owner_id = auth.uid())
    or (project_id is not null and public.can_edit_project(project_id))
  );

drop policy if exists "Notes: delete if editor" on public.notes;
drop policy if exists "Notes: delete if owner or editor" on public.notes;
create policy "Notes: delete if owner or editor"
  on public.notes for delete to authenticated
  using (
    (project_id is null and owner_id = auth.uid())
    or (project_id is not null and public.can_edit_project(project_id))
  );

-- ============================================================================
-- 3. canvas_notes: folder_id -------------------------------------------------
-- A personal canvas can be filed into the Library too. folder_id is set null if
-- the folder is deleted (the canvas falls back to the Library root). project_id /
-- owner_id immutability and the Pro gate are unchanged (20260622200000). The
-- existing touch_canvas_notes trigger leaves folder_id freely mutable, so moving
-- a canvas between folders just works.
alter table public.canvas_notes
  add column if not exists folder_id uuid references public.folders (id) on delete set null;

comment on column public.canvas_notes.folder_id is
  'Library folder for a personal canvas (null = Library root). Project canvases leave this null.';

create index if not exists canvas_notes_folder_idx on public.canvas_notes (folder_id);
