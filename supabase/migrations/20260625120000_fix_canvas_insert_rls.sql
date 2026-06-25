-- Migration: fix canvas_notes write RLS (canvas creation returned 403 / 42501)
--
-- Root cause (confirmed live on 2026-06-25):
--   Creating a canvas failed with Postgres error 42501
--   "new row violates row-level security policy for table canvas_notes",
--   even though the signed-in user is a Pro board OWNER:
--     • project_is_pro(project_id)  -> true   (verified via the RPC the gate uses)
--     • can_edit_project(project_id) -> true   (the user has an 'owner' members row)
--   Both conditions the INSERT policy checks were satisfied, yet the insert was
--   denied. That only happens when the canvas_notes INSERT policy is MISSING or
--   incorrect in the live DB: the standalone-canvas migration
--   (20260622200000_canvas_standalone.sql) applied its owner_id column + SELECT
--   policy (SELECT works) but its write-policy step did not fully land (dropped
--   the old "Canvas: insert if pro editor" without recreating the new one / it
--   was later altered in the SQL editor). With no valid INSERT policy, RLS
--   default-denies every insert, so the optimistic editor opened then rolled
--   back -> the "opens for half a second and closes again" symptom.
--
-- This migration re-asserts the correct write policies from 20260622200000
-- verbatim. It is idempotent (drop-if-exists + create) and references only
-- helpers that already exist in the DB (project_is_pro, can_edit_project,
-- can_edit_canvas, canvas_is_pro, is_canvas_owner, user_is_pro). Safe to run on
-- top of a healthy DB too — it just rewrites the policies to the intended state.
--
-- After applying, confirm with:
--   select cmd, polname from pg_policies where tablename = 'canvas_notes';
-- You should see one row each for SELECT / INSERT / UPDATE / DELETE.

-- Re-assert column shape too, in case those steps also didn't land. Both are
-- idempotent no-ops on a correctly-migrated DB.
alter table public.canvas_notes alter column owner_id set default auth.uid();
alter table public.canvas_notes alter column project_id drop not null;

-- INSERT: a Pro project editor (project canvas) OR a Pro owner (personal canvas).
-- The board owner's plan governs a project canvas; the user's own plan governs a
-- personal canvas. owner_id defaults to auth.uid() server-side.
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

-- UPDATE: the existing row must be editable (USING); the result must still be on
-- a Pro plan (WITH CHECK), so autosave stops if a plan lapses.
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

-- DELETE: a project editor (project canvas) OR the owner (personal). Cleanup
-- survives a lapsed plan, mirroring the canvas-media Storage policies.
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
