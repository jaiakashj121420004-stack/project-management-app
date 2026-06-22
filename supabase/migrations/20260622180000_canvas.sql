-- Migration: canvas_notes (Pro Phase P3.1 — Notes Canvas foundation)
-- See plan.md §5–6 and prompts.md → "P3.1 — Canvas foundation".
--
-- A canvas note is a per-project infinite whiteboard (mini OneNote): a page
-- background (blank/ruled/grid/dotted) plus a freeform array of elements
-- (strokes, text boxes, images, media — bodies arrive in P3.2–P3.5). This
-- migration is the FOUNDATION: the table, its touch trigger, and RLS. No
-- freehand/text/media yet.
--
-- Two persisted representations of the document live side by side:
--   * scene   jsonb  — the denormalised element array, read directly for fast,
--                      non-realtime loads + thumbnails. The source of truth today.
--   * doc_state bytea — reserved for the Yjs CRDT binary snapshot (P3.7, live
--                      multiplayer). Null until then; created now so the column
--                      exists when the collaborative layer lands.
--
-- Pro-gating is DOUBLE (prompts.md → "The Pro-gating principle"): the UI hides
-- the feature for free boards, but the REAL gate is here — INSERT/UPDATE require
-- project_is_pro(project_id) (the board OWNER's plan governs), so a free user
-- can't create or edit a canvas even by hitting the API directly. Read + delete
-- stay membership/edit gated so media stays viewable and removable if a board's
-- plan lapses (same philosophy as the canvas-media Storage policies in
-- 20260622000000_pro_foundation.sql).

-- 1. Table -------------------------------------------------------------------
-- updated_by records the last editor (defaulted + stamped by the trigger below);
-- updated_at is maintained server-side so its ordering value never depends on the
-- untrusted client. scene is capped indirectly by Postgres' jsonb limits; large
-- media bodies are NOT inlined here — images/audio/video live in the canvas-media
-- bucket and the scene only stores their storage path (P3.4+).
create table if not exists public.canvas_notes (
  id         uuid        primary key default gen_random_uuid(),
  project_id uuid        not null references public.projects (id) on delete cascade,
  title      text        not null default 'Untitled canvas'
                         check (char_length(trim(title)) between 1 and 120),
  page_type  text        not null default 'blank'
                         check (page_type in ('blank', 'ruled', 'grid', 'dotted')),
  -- Yjs binary snapshot (P3.7). Null until the collaborative layer lands.
  doc_state  bytea,
  -- Denormalised element array ({ "elements": [...] }) for fast reads/thumbnails.
  scene      jsonb       not null default '{}'::jsonb,
  updated_by uuid        default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.canvas_notes is
  'Per-project Pro Notes Canvas (plan.md §5, prompts.md P3). scene = denormalised elements; doc_state = Yjs snapshot (P3.7). RLS: read/delete by members/editors, create/edit require a Pro board.';

-- The canvas list is ordered most-recently-edited first, scoped to one project.
create index if not exists canvas_notes_project_updated_idx
  on public.canvas_notes (project_id, updated_at desc);

-- 2. updated_at / updated_by trigger -----------------------------------------
-- Autosave issues many UPDATEs; stamp updated_at + updated_by server-side on
-- every change so list order and "last edited by" never depend on the client.
create or replace function public.touch_canvas_notes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

comment on function public.touch_canvas_notes() is
  'BEFORE UPDATE trigger: refresh canvas_notes.updated_at + updated_by server-side on every edit.';

drop trigger if exists canvas_notes_set_updated_at on public.canvas_notes;
create trigger canvas_notes_set_updated_at
  before update on public.canvas_notes
  for each row execute function public.touch_canvas_notes();

-- 3. Row Level Security ------------------------------------------------------
-- read   = any project member (is_project_member)             — view a canvas.
-- write  = an owner/editor (can_edit_project)                 — delete a canvas.
-- create = an owner/editor on a PRO board                     — INSERT.
-- edit   = an owner/editor on a PRO board                     — UPDATE.
-- All checks call the existing SECURITY DEFINER helpers (flat — no RLS re-entry),
-- exactly like the notes + collaboration policies. This migration adds new
-- policies only; it never touches or weakens an existing one.
alter table public.canvas_notes enable row level security;

drop policy if exists "Canvas: select if member" on public.canvas_notes;
create policy "Canvas: select if member"
  on public.canvas_notes
  for select
  to authenticated
  using (public.is_project_member(project_id));

-- INSERT: an editor/owner of a PRO board only. project_is_pro resolves the board
-- owner's plan, so a free owner's whole board is blocked even for paying members.
drop policy if exists "Canvas: insert if pro editor" on public.canvas_notes;
create policy "Canvas: insert if pro editor"
  on public.canvas_notes
  for insert
  to authenticated
  with check (
    public.can_edit_project(project_id)
    and public.project_is_pro(project_id)
  );

-- UPDATE: the existing row must be editable (USING); the result must still be on
-- a Pro board (WITH CHECK), so autosave stops working if a board's plan lapses.
drop policy if exists "Canvas: update if pro editor" on public.canvas_notes;
create policy "Canvas: update if pro editor"
  on public.canvas_notes
  for update
  to authenticated
  using (public.can_edit_project(project_id))
  with check (
    public.can_edit_project(project_id)
    and public.project_is_pro(project_id)
  );

-- DELETE: any editor/owner may remove a canvas (cleanup survives a lapsed plan).
drop policy if exists "Canvas: delete if editor" on public.canvas_notes;
create policy "Canvas: delete if editor"
  on public.canvas_notes
  for delete
  to authenticated
  using (public.can_edit_project(project_id));
