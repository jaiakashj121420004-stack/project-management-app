-- Migration: stream canvas_members changes over Realtime (sharing UI live-update fix)
--
-- `note_members` was added to the `supabase_realtime` publication in the Phase 4
-- sharing migration (20260714120000_sharing.sql §5), but its mirror table
-- `canvas_members` (created earlier, 20260622200000_canvas_standalone.sql) was
-- never added — so a canvas collaborator's role change (editor ↔ viewer) never
-- reached an open client via `postgres_changes`, only a manual refetch would see
-- it. This closes that gap so canvas sharing gets the same live behaviour notes
-- already had. REPLICA IDENTITY FULL so DELETE events carry canvas_id/user_id
-- for client-side filters (same reasoning as note_members).
--
-- Idempotent: safe to re-run.

alter table public.canvas_members replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'canvas_members'
  ) then
    alter publication supabase_realtime add table public.canvas_members;
  end if;
end $$;
