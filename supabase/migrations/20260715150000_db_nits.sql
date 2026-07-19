-- Migration: DB nits (Remediation Phase 5 — I1, I2). I3 is docs-only (plan.md).
-- See SECURITY-REVIEW-2026-07-15.md I1/I2 and SECURITY-FIX-PLAN.md §Phase 5.
--
-- I1 — move the admin principal out of a hardcoded email literal in is_admin()
--      into an `admins` table, and rewrite is_admin() to check membership.
-- I2 — make the storage-path uuid casts robust: a malformed object name should
--      DENY, not raise a 500. We introduce public.safe_uuid(text) (returns NULL on
--      a non-uuid instead of erroring) and recreate the canvas-media / note-media
--      object policies to use it. For every VALID name the app produces the result
--      is identical; only a deliberately malformed name changes (error → deny).
--
-- All statements are idempotent (create table if not exists / create or replace /
-- drop policy if exists + create / on conflict do nothing), safe to re-run.

-- =============================================================================
-- I1 — admins table + membership-based is_admin()
-- =============================================================================
create table if not exists public.admins (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.admins is
  'Admin principals. is_admin() checks membership here instead of a hardcoded email (I1). Managed via SQL / service role — there is no client write path.';

alter table public.admins enable row level security;

-- An admin may see their own row (handy for debugging); nobody can write from the
-- client. is_admin() reads this table as its owner (SECURITY DEFINER) regardless.
drop policy if exists "Admins: read own" on public.admins;
create policy "Admins: read own"
  on public.admins
  for select
  to authenticated
  using (user_id = auth.uid());

revoke all on public.admins from anon;
grant select on public.admins to authenticated;

-- Seed the existing admin by resolving the email to a uuid safely at migration
-- time (no literal uuid; no-op if that user doesn't exist yet).
insert into public.admins (user_id)
select id from auth.users where email = 'jaiakashj121420004@gmail.com'
on conflict (user_id) do nothing;

-- Rewrite is_admin(): same signature + SECURITY DEFINER + pinned search_path, now
-- membership-based. Dependent policies (announcements / CEO message) keep working;
-- authenticated keeps EXECUTE because those policies call is_admin() as the caller.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

grant execute on function public.is_admin() to authenticated;

-- =============================================================================
-- I2 — robust storage-path uuid casts
-- =============================================================================
-- Returns the uuid when the text is a well-formed uuid, else NULL — never raises.
-- Used in storage policies so a malformed first path segment denies (the member/
-- access helpers all return false for a NULL id) instead of throwing a 500.
create or replace function public.safe_uuid(p text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then p::uuid
    else null
  end;
$$;

comment on function public.safe_uuid(text) is
  'Parse text to uuid or NULL (never raises). Hardens storage-path casts so a malformed object name denies instead of erroring (I2).';

grant execute on function public.safe_uuid(text) to authenticated;

-- ---- canvas-media policies (project-keyed; path = <projectId>/<file>) --------
drop policy if exists "canvas-media: select if project member" on storage.objects;
create policy "canvas-media: select if project member"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'canvas-media'
    and public.is_project_member(public.safe_uuid(split_part(name, '/', 1)))
  );

drop policy if exists "canvas-media: insert if pro member" on storage.objects;
create policy "canvas-media: insert if pro member"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'canvas-media'
    and public.is_project_member(public.safe_uuid(split_part(name, '/', 1)))
    and public.project_is_pro(public.safe_uuid(split_part(name, '/', 1)))
  );

drop policy if exists "canvas-media: update if pro member" on storage.objects;
create policy "canvas-media: update if pro member"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'canvas-media'
    and public.is_project_member(public.safe_uuid(split_part(name, '/', 1)))
    and public.project_is_pro(public.safe_uuid(split_part(name, '/', 1)))
  )
  with check (
    bucket_id = 'canvas-media'
    and public.is_project_member(public.safe_uuid(split_part(name, '/', 1)))
    and public.project_is_pro(public.safe_uuid(split_part(name, '/', 1)))
  );

drop policy if exists "canvas-media: delete if pro member" on storage.objects;
create policy "canvas-media: delete if pro member"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'canvas-media'
    and public.is_project_member(public.safe_uuid(split_part(name, '/', 1)))
    and public.project_is_pro(public.safe_uuid(split_part(name, '/', 1)))
  );

-- ---- note-media policies (note-keyed; path = <noteId>/<file>) ----------------
drop policy if exists "Note media: read" on storage.objects;
create policy "Note media: read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'note-media'
    and public.can_access_note(public.safe_uuid((storage.foldername(name))[1]))
  );

drop policy if exists "Note media: insert" on storage.objects;
create policy "Note media: insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'note-media'
    and public.can_edit_note(public.safe_uuid((storage.foldername(name))[1]))
  );

drop policy if exists "Note media: delete" on storage.objects;
create policy "Note media: delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'note-media'
    and public.can_edit_note(public.safe_uuid((storage.foldername(name))[1]))
  );
