-- Migration: projects + project_members (Phase 3 — Projects / multi-tenant RLS)
-- See plan.md §5 (data model) and §6 (security model).
--
-- This establishes the multi-tenant pattern every later table reuses: a row is
-- accessible only to members of its project. The frontend is untrusted; these
-- database rules — not client logic — are the real guarantee.

-- 1. Tables ------------------------------------------------------------------

-- A workspace. `accent` names one of the six Aurora gradients (plan.md §4.2);
-- `owner_id` is the creator. Membership lives in project_members.
create table if not exists public.projects (
  id          uuid        primary key default gen_random_uuid(),
  owner_id    uuid        not null references auth.users (id) on delete cascade,
  name        text        not null check (char_length(trim(name)) between 1 and 80),
  description text                 check (description is null or char_length(description) <= 500),
  accent      text        not null check (accent in ('aurora', 'sunset', 'bloom', 'lagoon', 'ember', 'galaxy')),
  created_at  timestamptz not null default now()
);

comment on table public.projects is 'Workspaces / project ideas (plan.md §5). Access gated by project_members via RLS.';

-- Who can access a project, and with what role. The composite PK means a user
-- appears at most once per project.
create table if not exists public.project_members (
  project_id uuid        not null references public.projects (id) on delete cascade,
  user_id    uuid        not null references auth.users (id)    on delete cascade,
  role       text        not null default 'viewer' check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

comment on table public.project_members is 'Project access control + sharing (plan.md §5–6).';

-- Helps is_project_member() and "my projects" lookups (project_id is already the
-- leading PK column, so it is covered; user_id is not).
create index if not exists project_members_user_id_idx on public.project_members (user_id);
create index if not exists projects_owner_id_idx        on public.projects (owner_id);

-- 2. SECURITY DEFINER membership helpers -------------------------------------
-- THE RECURSION GOTCHA (plan.md §6): an RLS policy on project_members that
-- itself queries project_members makes Postgres re-apply that same policy to the
-- sub-query, which it rejects with "infinite recursion detected in policy for
-- relation project_members". We break the loop by checking membership inside a
-- SECURITY DEFINER function: its body runs as the function owner (the table
-- owner), so RLS does NOT re-enter while it reads project_members. Policies then
-- call the function instead of sub-querying the table directly.
--
-- search_path is pinned to '' and every object is schema-qualified to prevent
-- search-path hijacking — Supabase's documented best practice for definer
-- functions (same hardening as handle_new_user() in the profiles migration).

-- Is the current user a member of this project?
create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.project_members m
    where m.project_id = p_project_id
      and m.user_id = auth.uid()
  );
$$;

comment on function public.is_project_member(uuid) is
  'SECURITY DEFINER membership check used by RLS to avoid project_members recursion (plan.md §6).';

-- Is the current user the OWNER of this project? Used by the member-management
-- policies below. Reading projects.owner_id through a definer function (rather
-- than a sub-query against public.projects) keeps the project_members policies
-- from triggering projects' own RLS, so the rules stay flat and non-recursive.
create or replace function public.is_project_owner(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.owner_id = auth.uid()
  );
$$;

comment on function public.is_project_owner(uuid) is
  'SECURITY DEFINER owner check used by the project_members management policies (plan.md §6).';

-- 3. Seed the creator as an owner member -------------------------------------
-- On INSERT into projects, record the creator in project_members as 'owner'.
-- SECURITY DEFINER so the row is written regardless of the (not-yet-a-member)
-- caller's RLS — at creation time the owner has no membership row yet, so the
-- "only owners may INSERT members" policy could not let them in. Runs in the
-- same transaction, so the subsequent RETURNING select on projects (which the
-- select policy gates on is_project_member) already sees the membership.
create or replace function public.handle_new_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (project_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_project_created on public.projects;
create trigger on_project_created
  after insert on public.projects
  for each row execute function public.handle_new_project();

-- 4. Row Level Security ------------------------------------------------------
alter table public.projects        enable row level security;
alter table public.project_members enable row level security;

-- projects -------------------------------------------------------------------

-- Read a project only if you belong to it.
drop policy if exists "Projects: select if member" on public.projects;
create policy "Projects: select if member"
  on public.projects
  for select
  to authenticated
  using (public.is_project_member(id));

-- Create a project only for yourself. The trigger then makes you its owner
-- member, so the RETURNING select (gated by the select policy) succeeds.
drop policy if exists "Projects: insert own" on public.projects;
create policy "Projects: insert own"
  on public.projects
  for insert
  to authenticated
  with check (owner_id = auth.uid());

-- Only the owner may edit a project (and may not hand ownership to someone else).
drop policy if exists "Projects: update owner" on public.projects;
create policy "Projects: update owner"
  on public.projects
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Only the owner may delete a project (cascades to its members + future tables).
drop policy if exists "Projects: delete owner" on public.projects;
create policy "Projects: delete owner"
  on public.projects
  for delete
  to authenticated
  using (owner_id = auth.uid());

-- project_members ------------------------------------------------------------

-- See the member list of any project you belong to (needed for collaboration UI).
drop policy if exists "Members: select if member" on public.project_members;
create policy "Members: select if member"
  on public.project_members
  for select
  to authenticated
  using (public.is_project_member(project_id));

-- Only the project owner may add members (sharing). The creator's own owner row
-- is written by the SECURITY DEFINER trigger above, which bypasses this check.
drop policy if exists "Members: insert by owner" on public.project_members;
create policy "Members: insert by owner"
  on public.project_members
  for insert
  to authenticated
  with check (public.is_project_owner(project_id));

-- Only the project owner may remove members.
drop policy if exists "Members: delete by owner" on public.project_members;
create policy "Members: delete by owner"
  on public.project_members
  for delete
  to authenticated
  using (public.is_project_owner(project_id));

-- No UPDATE policy on project_members yet: role changes arrive with the
-- collaboration UI (Phase 8). Until then memberships are insert/delete only.
