-- Migration: fix notes RLS read-back (notes 403 → notes now open/create)
--
-- The Phase 4 sharing migration set the notes SELECT policy to `can_access_note(id)`
-- — a STABLE SECURITY DEFINER function that RE-QUERIES public.notes. On an
-- `insert … returning` / `update … returning` the read-back is gated by that
-- SELECT policy, and the re-query doesn't see the just-written (uncommitted) row →
-- 403 Forbidden. (Same failure the canvas hit in 20260625140000.)
--
-- Fix: the SELECT/UPDATE policies check the row's OWN columns INLINE (owner_id /
-- project_id / id), so the read-back of a new row succeeds. Membership checks use
-- SECURITY DEFINER helpers that DON'T re-query notes (so no re-query race and no
-- note_members RLS recursion). Same security, working read-back.

-- Membership helpers (SECURITY DEFINER → bypass note_members RLS; never touch notes).
create or replace function public.is_note_member(p_note_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.note_members m
    where m.note_id = p_note_id and m.user_id = auth.uid()
  );
$$;
grant execute on function public.is_note_member(uuid) to authenticated;

create or replace function public.is_note_editor(p_note_id uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.note_members m
    where m.note_id = p_note_id and m.user_id = auth.uid() and m.role = 'editor'
  );
$$;
grant execute on function public.is_note_editor(uuid) to authenticated;

-- SELECT: inline owner check (works for the insert/update read-back) + project
-- membership + note membership.
drop policy if exists "Notes: select if accessible" on public.notes;
create policy "Notes: select if accessible"
  on public.notes for select to authenticated
  using (
    owner_id = auth.uid()
    or (project_id is not null and public.is_project_member(project_id))
    or public.is_note_member(id)
  );

-- UPDATE: same inline shape (owner / project editor / note editor).
drop policy if exists "Notes: update if editor2" on public.notes;
create policy "Notes: update if editor2"
  on public.notes for update to authenticated
  using (
    owner_id = auth.uid()
    or (project_id is not null and public.can_edit_project(project_id))
    or public.is_note_editor(id)
  )
  with check (
    owner_id = auth.uid()
    or (project_id is not null and public.can_edit_project(project_id))
    or public.is_note_editor(id)
  );
