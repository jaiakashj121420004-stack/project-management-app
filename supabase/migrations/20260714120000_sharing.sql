-- Migration: canvas + note sharing (Nvexis Phase 4 — collaboration)
-- See NVEXIS-UPGRADE-PLAN.md §6.
--
-- Phase 4 lets an owner share a personal canvas OR a standalone/project note with
-- another registered user as editor/viewer. Canvas sharing reuses the existing
-- `canvas_members` table (20260622200000); notes get a new `note_members` table
-- that mirrors it. Both are managed via SECURITY DEFINER "share_*" RPCs that
-- resolve an email to a user and upsert the membership (owner-gated). The frontend
-- is untrusted — these DB rules are the real guarantee.

-- ============================================================================
-- 1. Email → user helper (shared by both share RPCs) --------------------------
-- SECURITY DEFINER so it can read auth.users (not otherwise visible to clients).
create or replace function public.user_id_for_email(p_email text)
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;

grant execute on function public.user_id_for_email(text) to authenticated;

-- ============================================================================
-- 2. Canvas sharing RPC -------------------------------------------------------
-- Owner-gated (is_canvas_owner). Resolves the email to a registered user and
-- upserts canvas_members. Returns the target user id. Raises a friendly message
-- if the email isn't a Nvexis user or is the owner.
create or replace function public.share_canvas(p_canvas_id uuid, p_email text, p_role text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not public.is_canvas_owner(p_canvas_id) then
    raise exception 'Only the canvas owner can share it';
  end if;
  if p_role not in ('editor', 'viewer') then
    raise exception 'Role must be editor or viewer';
  end if;
  v_user := public.user_id_for_email(p_email);
  if v_user is null then
    raise exception 'No Nvexis user with that email';
  end if;
  if v_user = auth.uid() then
    raise exception 'You already own this canvas';
  end if;
  insert into public.canvas_members (canvas_id, user_id, role)
  values (p_canvas_id, v_user, p_role)
  on conflict (canvas_id, user_id) do update set role = excluded.role;
  return v_user;
end;
$$;

grant execute on function public.share_canvas(uuid, text, text) to authenticated;

-- ============================================================================
-- 3. note_members + access helpers + note RLS ---------------------------------
create table if not exists public.note_members (
  note_id    uuid        not null references public.notes (id)      on delete cascade,
  user_id    uuid        not null references auth.users (id)        on delete cascade,
  role       text        not null default 'editor' check (role in ('editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (note_id, user_id)
);

comment on table public.note_members is
  'Per-note sharing (mirrors canvas_members). The owner is notes.owner_id, never a row here. RLS: read by anyone who can access the note; managed only by the note owner.';

create index if not exists note_members_user_id_idx on public.note_members (user_id);

-- Access helpers (flat SECURITY DEFINER, like the canvas ones — no RLS re-entry).
create or replace function public.is_note_owner(p_note_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.notes n where n.id = p_note_id and n.owner_id = auth.uid());
$$;
grant execute on function public.is_note_owner(uuid) to authenticated;

create or replace function public.can_access_note(p_note_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.notes n
    where n.id = p_note_id
      and (
        n.owner_id = auth.uid()
        or (n.project_id is not null and public.is_project_member(n.project_id))
        or exists (select 1 from public.note_members m where m.note_id = n.id and m.user_id = auth.uid())
      )
  );
$$;
grant execute on function public.can_access_note(uuid) to authenticated;

create or replace function public.can_edit_note(p_note_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.notes n
    where n.id = p_note_id
      and (
        n.owner_id = auth.uid()
        or (n.project_id is not null and public.can_edit_project(n.project_id))
        or exists (
          select 1 from public.note_members m
          where m.note_id = n.id and m.user_id = auth.uid() and m.role = 'editor'
        )
      )
  );
$$;
grant execute on function public.can_edit_note(uuid) to authenticated;

-- Rewrite notes RLS to include note membership (was owner-or-project-member).
-- INSERT can't reference a not-yet-existing membership, so it stays owner (for a
-- standalone note) or project editor (for a project note).
drop policy if exists "Notes: select if owner or member" on public.notes;
drop policy if exists "Notes: select if accessible" on public.notes;
create policy "Notes: select if accessible"
  on public.notes for select to authenticated
  using (public.can_access_note(id));

drop policy if exists "Notes: update if owner or editor" on public.notes;
drop policy if exists "Notes: update if editor2" on public.notes;
create policy "Notes: update if editor2"
  on public.notes for update to authenticated
  using (public.can_edit_note(id))
  with check (public.can_edit_note(id));

drop policy if exists "Notes: delete if owner or editor" on public.notes;
drop policy if exists "Notes: delete if owner2" on public.notes;
create policy "Notes: delete if owner2"
  on public.notes for delete to authenticated
  using (
    (project_id is null and owner_id = auth.uid())
    or (project_id is not null and public.can_edit_project(project_id))
  );

-- note_members RLS: read by anyone who can access the note; managed by the owner.
alter table public.note_members enable row level security;

drop policy if exists "Note members: select if accessible" on public.note_members;
create policy "Note members: select if accessible"
  on public.note_members for select to authenticated
  using (public.can_access_note(note_id));

drop policy if exists "Note members: insert by owner" on public.note_members;
create policy "Note members: insert by owner"
  on public.note_members for insert to authenticated
  with check (public.is_note_owner(note_id));

drop policy if exists "Note members: update by owner" on public.note_members;
create policy "Note members: update by owner"
  on public.note_members for update to authenticated
  using (public.is_note_owner(note_id)) with check (public.is_note_owner(note_id));

drop policy if exists "Note members: delete by owner" on public.note_members;
create policy "Note members: delete by owner"
  on public.note_members for delete to authenticated
  using (public.is_note_owner(note_id));

-- ============================================================================
-- 4. Note sharing RPC ---------------------------------------------------------
create or replace function public.share_note(p_note_id uuid, p_email text, p_role text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not public.is_note_owner(p_note_id) then
    raise exception 'Only the note owner can share it';
  end if;
  if p_role not in ('editor', 'viewer') then
    raise exception 'Role must be editor or viewer';
  end if;
  v_user := public.user_id_for_email(p_email);
  if v_user is null then
    raise exception 'No Nvexis user with that email';
  end if;
  if v_user = auth.uid() then
    raise exception 'You already own this note';
  end if;
  insert into public.note_members (note_id, user_id, role)
  values (p_note_id, v_user, p_role)
  on conflict (note_id, user_id) do update set role = excluded.role;
  return v_user;
end;
$$;

grant execute on function public.share_note(uuid, text, text) to authenticated;

-- ============================================================================
-- 4b. Collaborator lists (with profile + email) -------------------------------
-- SECURITY DEFINER so the owner sees each collaborator's name/avatar/email even
-- though profiles RLS wouldn't otherwise expose a non-co-project user. Gated on
-- can_access_* so only people who can see the canvas/note get the list.
create or replace function public.canvas_collaborators(p_canvas_id uuid)
returns table (user_id uuid, role text, created_at timestamptz, display_name text, avatar_url text, email text)
language sql security definer set search_path = '' stable as $$
  select m.user_id, m.role, m.created_at, p.display_name, p.avatar_url, u.email
  from public.canvas_members m
  left join public.profiles p on p.id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.canvas_id = p_canvas_id and public.can_access_canvas(p_canvas_id)
  order by m.created_at;
$$;
grant execute on function public.canvas_collaborators(uuid) to authenticated;

create or replace function public.note_collaborators(p_note_id uuid)
returns table (user_id uuid, role text, created_at timestamptz, display_name text, avatar_url text, email text)
language sql security definer set search_path = '' stable as $$
  select m.user_id, m.role, m.created_at, p.display_name, p.avatar_url, u.email
  from public.note_members m
  left join public.profiles p on p.id = m.user_id
  left join auth.users u on u.id = m.user_id
  where m.note_id = p_note_id and public.can_access_note(p_note_id)
  order by m.created_at;
$$;
grant execute on function public.note_collaborators(uuid) to authenticated;

-- ============================================================================
-- 5. Realtime: stream note_members changes (notes already stream from Phase 8).
--    REPLICA IDENTITY FULL so DELETE events carry note_id for client filters.
alter table public.note_members replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'note_members'
  ) then
    alter publication supabase_realtime add table public.note_members;
  end if;
end $$;
