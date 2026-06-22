-- Migration: Pro feature foundation (Pro Phase P0 — gating + storage)
-- See plan.md §6 (security) and prompts.md → "The Pro-gating principle".
--
-- This is foundation only — no end-user Pro feature yet. It establishes the
-- DATABASE side of Pro-gating, which is the *real* gate (the UI gate is UX only):
--   1. project_is_pro(project) — the board OWNER's plan governs, mirroring the
--      member-limit rule. A SECURITY DEFINER helper used by RLS on every future
--      Pro table and by the Storage policies below.
--   2. A PRIVATE 'canvas-media' Storage bucket (the first use of Supabase Storage)
--      with RLS on storage.objects: any project member may read; only a Pro
--      board's members may write. Served via signed URLs.
--
-- Same hardening as the existing helpers (is_project_member / can_edit_project):
-- `security definer`, `set search_path = ''`, every reference schema-qualified.
-- Policies call the helper instead of sub-querying, so they stay flat (no RLS
-- re-entry). This migration does NOT touch or weaken any existing policy.

-- 1. project_is_pro() --------------------------------------------------------
-- Does the OWNER of this project have an active Pro plan? Resolves
-- projects.owner_id → profiles.plan, exactly like a free user's owned board
-- governs the member limit. Used in WITH CHECK on Pro tables and in the Storage
-- INSERT/UPDATE/DELETE policies. SECURITY DEFINER so it can read profiles.plan
-- (own-row RLS) and projects regardless of the caller, without re-entering their
-- RLS. NEVER trust the client for plan status — this is the enforcement point.
create or replace function public.project_is_pro(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.projects p
    join public.profiles pr on pr.id = p.owner_id
    where p.id = p_project_id
      and pr.plan = 'pro'
  );
$$;

comment on function public.project_is_pro(uuid) is
  'SECURITY DEFINER: is the OWNER of this project on the Pro plan? The real gate for Pro tables + Storage (prompts.md P0).';

grant execute on function public.project_is_pro(uuid) to authenticated;

-- 2. The canvas-media Storage bucket -----------------------------------------
-- PRIVATE (public = false): objects are only reachable via short-lived signed
-- URLs minted server-side (the SELECT policy below decides who may mint one).
-- Path convention is '<projectId>/<noteId>/<file>' — see lib/storage.ts.
--
-- file_size_limit is a hard server-side ceiling = the LARGEST per-type cap
-- (video, 100 MB). Storage enforces it natively across every upload transport.
-- The finer PER-TYPE caps (image 10 MB / audio 25 MB / video 100 MB) and the
-- MIME allow-list live in src/lib/proFeatures.ts and are enforced client-side in
-- lib/storage.ts BEFORE upload — a single bucket limit can't express per-type
-- byte caps, and metadata.size is not reliably present at policy-eval time for
-- resumable uploads. Keep this number in sync with MEDIA_CAPS.video.maxBytes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('canvas-media', 'canvas-media', false, 104857600, null)  -- 100 MiB
on conflict (id) do nothing;

-- 3. Storage RLS on storage.objects ------------------------------------------
-- (RLS is already enabled on storage.objects by Supabase.) The projectId is the
-- first path segment, parsed with split_part(name,'/',1)::uuid. Every policy is
-- guarded by bucket_id = 'canvas-media' first so the cast only runs on our own
-- objects (canvas-media is the project's only bucket). Idempotent drop+create
-- mirrors the repo convention.

-- SELECT: any MEMBER of the object's project may read it (→ mint a signed URL).
-- Read access intentionally does NOT require Pro, so media stays viewable if a
-- board's plan lapses; creating media is what requires Pro (below).
drop policy if exists "canvas-media: select if project member" on storage.objects;
create policy "canvas-media: select if project member"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'canvas-media'
    and public.is_project_member(split_part(name, '/', 1)::uuid)
  );

-- INSERT: only a member of a PRO board may upload. project_is_pro resolves the
-- board owner's plan, so a free owner's whole board is blocked even for paying
-- collaborators — the board owner's plan governs (same rule as the member limit).
-- (Edit-role enforcement happens at the canvas_notes layer in P3 via
-- can_edit_project; orphaned uploads are harmless and unreferenced.)
drop policy if exists "canvas-media: insert if pro member" on storage.objects;
create policy "canvas-media: insert if pro member"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'canvas-media'
    and public.is_project_member(split_part(name, '/', 1)::uuid)
    and public.project_is_pro(split_part(name, '/', 1)::uuid)
  );

-- UPDATE: same gate, on both the existing row (USING) and the new one (WITH CHECK).
drop policy if exists "canvas-media: update if pro member" on storage.objects;
create policy "canvas-media: update if pro member"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'canvas-media'
    and public.is_project_member(split_part(name, '/', 1)::uuid)
    and public.project_is_pro(split_part(name, '/', 1)::uuid)
  )
  with check (
    bucket_id = 'canvas-media'
    and public.is_project_member(split_part(name, '/', 1)::uuid)
    and public.project_is_pro(split_part(name, '/', 1)::uuid)
  );

-- DELETE: same gate.
drop policy if exists "canvas-media: delete if pro member" on storage.objects;
create policy "canvas-media: delete if pro member"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'canvas-media'
    and public.is_project_member(split_part(name, '/', 1)::uuid)
    and public.project_is_pro(split_part(name, '/', 1)::uuid)
  );
