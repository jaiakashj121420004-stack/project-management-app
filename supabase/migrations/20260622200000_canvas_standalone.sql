-- Migration: standalone canvases (Pro Phase P3 — canvases independent of projects)
-- See plan.md §5–6 (canvas data + sharing model) and prompts.md → "P3 canvas".
--
-- Until now a canvas_note ALWAYS belonged to a project and was shared purely via
-- project membership. This migration makes a canvas independent of a project: a
-- canvas may still belong to a project (shared via project membership, as today)
-- OR be a PERSONAL canvas with NO project, owned by one user. Notes are unchanged
-- (project-only). Per-canvas sharing (the canvas_members table) is created here;
-- its sharing UI lands in the NEXT prompt.
--
-- The owner of a canvas is canvas_notes.owner_id (NOT a canvas_members row), the
-- same way projects.owner_id (not a project_members row) is the source of truth
-- for project ownership. Pro-gating stays DOUBLE (UI + RLS): the REAL gate is
-- here — only a Pro board (project canvas) or a Pro user (personal canvas) may
-- create/edit a canvas, so a free user can't bypass it via the raw API.

-- 1. canvas_notes: owner_id + nullable project_id -----------------------------
-- owner_id is the canvas's owner. For existing rows it is BACKFILLED from the
-- canvas's project owner (every canvas was a project canvas until now); going
-- forward it defaults to the creator (auth.uid()). project_id becomes NULLABLE so
-- a personal canvas can have no project. owner_id cascades on account deletion
-- (a personal canvas dies with its owner); updated_by stays set-null.
alter table public.canvas_notes
  add column if not exists owner_id uuid references auth.users (id) on delete cascade;

-- Backfill from the owning project BEFORE the immutability check lands in the
-- trigger below (which would otherwise reject changing owner_id from null).
update public.canvas_notes c
set owner_id = p.owner_id
from public.projects p
where c.project_id = p.id
  and c.owner_id is null;

alter table public.canvas_notes
  alter column owner_id set default auth.uid();

alter table public.canvas_notes
  alter column owner_id set not null;

-- A personal canvas has no project.
alter table public.canvas_notes
  alter column project_id drop not null;

comment on column public.canvas_notes.owner_id is
  'The canvas owner. For a personal canvas (project_id null) this is the only ownership path; for a project canvas it records the creator. Immutable (touch_canvas_notes).';

-- The personal-canvas list is "my canvases, most-recently-edited first".
create index if not exists canvas_notes_owner_updated_idx
  on public.canvas_notes (owner_id, updated_at desc);

-- 2. canvas_members ----------------------------------------------------------
-- Per-canvas sharing, mirroring project_members. The OWNER is canvas_notes.
-- owner_id (never a member row). Only 'editor'/'viewer' are grantable. Used by a
-- personal canvas's sharing UI in the next prompt; project canvases keep sharing
-- via project membership, so a canvas can be reached three ways: owner, project
-- membership (if it has a project), or a canvas_members row.
create table if not exists public.canvas_members (
  canvas_id  uuid        not null references public.canvas_notes (id) on delete cascade,
  user_id    uuid        not null references auth.users (id)         on delete cascade,
  role       text        not null default 'editor' check (role in ('editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (canvas_id, user_id)
);

comment on table public.canvas_members is
  'Per-canvas sharing (mirrors project_members). The owner is canvas_notes.owner_id, never a row here. RLS: read by anyone who can access the canvas; managed only by the canvas owner.';

-- canvas_id is already the leading PK column (covered); user_id is not.
create index if not exists canvas_members_user_id_idx on public.canvas_members (user_id);

-- 3. SECURITY DEFINER access helpers -----------------------------------------
-- Same hardening as is_project_member / can_edit_project / project_is_pro:
-- `security definer`, `set search_path = ''`, every reference schema-qualified,
-- and EXECUTE granted to authenticated. Policies call these instead of
-- sub-querying canvas_members directly, so they stay flat (no RLS re-entry — the
-- same recursion gotcha project_members has). The helpers are created AFTER
-- canvas_members so the language-sql bodies validate against the table.

-- Does THIS user have an active Pro plan? The personal-canvas analogue of
-- project_is_pro() (which resolves a board owner's plan). Gates personal-canvas
-- create/edit.
create or replace function public.user_is_pro(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.profiles pr
    where pr.id = p_user_id
      and pr.plan = 'pro'
  );
$$;

comment on function public.user_is_pro(uuid) is
  'SECURITY DEFINER: is this user on the Pro plan? Gates personal-canvas create/edit (plan.md §6).';

grant execute on function public.user_is_pro(uuid) to authenticated;

-- Is this canvas on a Pro plan? A project canvas → the board owner's plan
-- (project_is_pro); a personal canvas → its owner's plan (user_is_pro). The Pro
-- gate for canvas UPDATE, so autosave stops if the governing plan lapses.
create or replace function public.canvas_is_pro(p_canvas_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.canvas_notes c
    where c.id = p_canvas_id
      and (
        (c.project_id is not null and public.project_is_pro(c.project_id))
        or (c.project_id is null and public.user_is_pro(c.owner_id))
      )
  );
$$;

comment on function public.canvas_is_pro(uuid) is
  'SECURITY DEFINER: is this canvas Pro? Project canvas → board owner''s plan; personal → owner''s plan. Gates canvas UPDATE (plan.md §6).';

grant execute on function public.canvas_is_pro(uuid) to authenticated;

-- Is the current user this canvas's owner? (canvas_notes.owner_id = auth.uid())
create or replace function public.is_canvas_owner(p_canvas_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.canvas_notes c
    where c.id = p_canvas_id
      and c.owner_id = auth.uid()
  );
$$;

comment on function public.is_canvas_owner(uuid) is
  'SECURITY DEFINER: is the current user the canvas owner? Gates canvas_members management + personal-canvas delete (plan.md §6).';

grant execute on function public.is_canvas_owner(uuid) to authenticated;

-- May the current user READ this canvas? Owner, OR (project canvas AND project
-- member), OR a canvas_members row. The three access paths in one place.
create or replace function public.can_access_canvas(p_canvas_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.canvas_notes c
    where c.id = p_canvas_id
      and (
        c.owner_id = auth.uid()
        or (c.project_id is not null and public.is_project_member(c.project_id))
        or exists (
          select 1
          from public.canvas_members cm
          where cm.canvas_id = c.id
            and cm.user_id = auth.uid()
        )
      )
  );
$$;

comment on function public.can_access_canvas(uuid) is
  'SECURITY DEFINER: may the current user read this canvas? Owner OR project member OR canvas_members row. Used by canvas_notes/canvas_members SELECT RLS (plan.md §6).';

grant execute on function public.can_access_canvas(uuid) to authenticated;

-- May the current user EDIT this canvas? Owner, OR (project canvas AND project
-- editor/owner), OR a canvas_members row with role 'editor'.
create or replace function public.can_edit_canvas(p_canvas_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.canvas_notes c
    where c.id = p_canvas_id
      and (
        c.owner_id = auth.uid()
        or (c.project_id is not null and public.can_edit_project(c.project_id))
        or exists (
          select 1
          from public.canvas_members cm
          where cm.canvas_id = c.id
            and cm.user_id = auth.uid()
            and cm.role = 'editor'
        )
      )
  );
$$;

comment on function public.can_edit_canvas(uuid) is
  'SECURITY DEFINER: may the current user modify this canvas? Owner OR project editor OR canvas_members editor. Used by canvas_notes write RLS (plan.md §6).';

grant execute on function public.can_edit_canvas(uuid) to authenticated;

-- 4. Immutable project_id / owner_id -----------------------------------------
-- Extend the existing BEFORE UPDATE trigger to also REJECT changing project_id
-- or owner_id — a canvas never migrates between projects or owners (re-parenting
-- would bypass the access model). Autosave only ever patches scene/title/
-- page_type, so this never fires in normal use.
create or replace function public.touch_canvas_notes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.project_id is distinct from old.project_id then
    raise exception 'canvas_notes.project_id is immutable';
  end if;
  if new.owner_id is distinct from old.owner_id then
    raise exception 'canvas_notes.owner_id is immutable';
  end if;
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

comment on function public.touch_canvas_notes() is
  'BEFORE UPDATE trigger: refresh updated_at/updated_by; reject changes to the immutable project_id/owner_id.';

-- 5. Replace canvas_notes RLS ------------------------------------------------
-- read   = can_access_canvas (owner / project member / canvas member).
-- create = a Pro project editor (project canvas) OR a Pro owner (personal).
-- edit   = can_edit_canvas, and the canvas must still be Pro (autosave stops on
--          a lapsed plan, exactly like the original policy).
-- delete = a project editor (project canvas) OR the owner (personal) — cleanup
--          survives a lapsed plan, mirroring the canvas-media Storage policies.
drop policy if exists "Canvas: select if member" on public.canvas_notes;
drop policy if exists "Canvas: select if accessible" on public.canvas_notes;
create policy "Canvas: select if accessible"
  on public.canvas_notes
  for select
  to authenticated
  using (public.can_access_canvas(id));

drop policy if exists "Canvas: insert if pro editor" on public.canvas_notes;
drop policy if exists "Canvas: insert if pro" on public.canvas_notes;
create policy "Canvas: insert if pro"
  on public.canvas_notes
  for insert
  to authenticated
  with check (
    (
      project_id is not null
      and public.can_edit_project(project_id)
      and public.project_is_pro(project_id)
    )
    or (
      project_id is null
      and owner_id = auth.uid()
      and public.user_is_pro(auth.uid())
    )
  );

drop policy if exists "Canvas: update if pro editor" on public.canvas_notes;
create policy "Canvas: update if pro editor"
  on public.canvas_notes
  for update
  to authenticated
  using (public.can_edit_canvas(id))
  with check (
    public.can_edit_canvas(id)
    and public.canvas_is_pro(id)
  );

drop policy if exists "Canvas: delete if editor" on public.canvas_notes;
drop policy if exists "Canvas: delete if owner or editor" on public.canvas_notes;
create policy "Canvas: delete if owner or editor"
  on public.canvas_notes
  for delete
  to authenticated
  using (
    (project_id is not null and public.can_edit_project(project_id))
    or public.is_canvas_owner(id)
  );

-- 6. canvas_members RLS ------------------------------------------------------
-- read   = anyone who can access the canvas (so members see the share list).
-- write  = the canvas owner only (sharing is the owner's to manage).
alter table public.canvas_members enable row level security;

drop policy if exists "Canvas members: select if accessible" on public.canvas_members;
create policy "Canvas members: select if accessible"
  on public.canvas_members
  for select
  to authenticated
  using (public.can_access_canvas(canvas_id));

drop policy if exists "Canvas members: insert by owner" on public.canvas_members;
create policy "Canvas members: insert by owner"
  on public.canvas_members
  for insert
  to authenticated
  with check (public.is_canvas_owner(canvas_id));

drop policy if exists "Canvas members: update by owner" on public.canvas_members;
create policy "Canvas members: update by owner"
  on public.canvas_members
  for update
  to authenticated
  using (public.is_canvas_owner(canvas_id))
  with check (public.is_canvas_owner(canvas_id));

drop policy if exists "Canvas members: delete by owner" on public.canvas_members;
create policy "Canvas members: delete by owner"
  on public.canvas_members
  for delete
  to authenticated
  using (public.is_canvas_owner(canvas_id));
