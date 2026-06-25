-- Migration: fix canvas creation failing with RLS 42501 on the insert read-back
--
-- THE REAL ROOT CAUSE (found 2026-06-25 after a long hunt):
--   Creating a canvas failed with Postgres 42501
--   "new row violates row-level security policy for table canvas_notes",
--   even though: the user is a Pro board owner, the INSERT policy's conditions
--   (can_edit_project + project_is_pro) both evaluate true, and a plain SQL
--   INSERT as that same user SUCCEEDS.
--
--   The tell: setting the INSERT policy to `with check (true)` STILL returned
--   42501 — a `true` check cannot be violated, so the INSERT policy was never
--   the blocker. The app creates a canvas with `.insert(...).select()`, which
--   PostgREST runs as `INSERT ... RETURNING *`. The RETURNING read-back is gated
--   by the SELECT policy, and that policy called `can_access_canvas(id)` — a
--   STABLE SECURITY DEFINER function that RE-QUERIES public.canvas_notes for the
--   id. During an INSERT ... RETURNING, that re-query does not reliably see the
--   just-inserted (not-yet-committed) row under the statement's snapshot, so
--   `can_access_canvas` returned false → the read-back failed → 42501. A plain
--   INSERT (no RETURNING) never triggers the SELECT policy, which is why every
--   direct/SQL test passed and only the app failed.
--
-- THE FIX: make the canvas_notes SELECT policy check the row's OWN columns
--   inline (owner_id / project_id / id) instead of re-querying canvas_notes via
--   can_access_canvas(). The access logic is identical (owner OR project member
--   OR canvas member) and just as secure — it simply never re-reads the table
--   being inserted, so the read-back of a brand-new row succeeds. is_project_member
--   / the canvas_members lookup query OTHER tables, so they are unaffected.
--
-- Note: INSERT/UPDATE/DELETE keep using can_edit_*/project_is_pro — those act on
-- already-committed rows (or don't read canvas_notes), so they don't hit this.

drop policy if exists "Canvas: select if accessible" on public.canvas_notes;
create policy "Canvas: select if accessible"
  on public.canvas_notes
  for select
  to authenticated
  using (
    owner_id = auth.uid()
    or (project_id is not null and public.is_project_member(project_id))
    or exists (
      select 1 from public.canvas_members m
      where m.canvas_id = id and m.user_id = auth.uid()
    )
  );
