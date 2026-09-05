-- ===========================================================================
-- Pro P3.7 — Canvas live multiplayer: fix the ownership pre-check that was
-- silently skipping the realtime.messages policies on this project.
-- ===========================================================================
-- 20260629120000_canvas_realtime.sql guarded its DDL behind a pre-check: it
-- only ran `alter table realtime.messages enable row level security` and the
-- two `create policy` statements when the executing role (`current_user`)
-- either owned `realtime.messages` or was a member of the owning role
-- (`supabase_realtime_admin` on this project). That check failed here, so the
-- migration logged a notice and skipped — leaving `realtime.messages` with
-- RLS enabled (Supabase enables it by default) but NO policies at all, i.e.
-- fail-closed: nobody, including legitimate project members, could join a
-- `canvas:<noteId>` private channel. Safe, but the collaborative canvas
-- feature was effectively dead on this project.
--
-- Root cause of the false negative: table *ownership* is not actually what's
-- required here. `alter table ... enable row level security` does need
-- ownership (and predictably still fails with insufficient_privilege on this
-- project — role `postgres` is not a member of `supabase_realtime_admin`).
-- But RLS was already ON, so that statement was never actually necessary, and
-- `create policy` on a table with RLS already enabled does NOT require
-- ownership in this project's configuration — verified live (a probe policy
-- was created and dropped during the 2026-09-03 pentest, and the fix below was
-- applied and confirmed working against the isolated staging project before
-- being committed here). The ownership pre-check was over-broad: it used the
-- ALTER statement's requirement as a proxy for whether the CREATE POLICY
-- statements would also fail, and that proxy was wrong.
--
-- Fix: stop pre-checking ownership. Attempt the ALTER and each CREATE POLICY
-- statement directly; each is individually wrapped so an insufficient_privilege
-- error is caught and logged rather than raised. This keeps the migration safe
-- to run on a project where these operations genuinely aren't possible (it just
-- logs a notice per statement and moves on, same fail-closed end state as
-- before), while no longer skipping them wholesale on a project like this one
-- where CREATE POLICY actually succeeds.
-- ===========================================================================

do $$
begin
  execute 'alter table realtime.messages enable row level security';
exception when insufficient_privilege then
  raise notice 'Skipping ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY (insufficient privilege) — assuming the platform already has RLS enabled on this table.';
end $$;

do $$
begin
  execute 'drop policy if exists "Canvas realtime: receive if accessible" on realtime.messages';
  execute $policy$
    create policy "Canvas realtime: receive if accessible"
      on realtime.messages
      for select
      to authenticated
      using (
        realtime.messages.extension in ('broadcast', 'presence')
        and case
          when starts_with(realtime.topic(), 'canvas:')
            then public.can_access_canvas(
              nullif(split_part(realtime.topic(), ':', 2), '')::uuid
            )
          else false
        end
      )
  $policy$;
exception when insufficient_privilege then
  raise notice 'Skipping "Canvas realtime: receive if accessible" policy (insufficient privilege) — canvas realtime receive-authorization remains unavailable on this project.';
end $$;

do $$
begin
  execute 'drop policy if exists "Canvas realtime: send if editor" on realtime.messages';
  execute $policy$
    create policy "Canvas realtime: send if editor"
      on realtime.messages
      for insert
      to authenticated
      with check (
        realtime.messages.extension in ('broadcast', 'presence')
        and case
          when starts_with(realtime.topic(), 'canvas:')
            then public.can_edit_canvas(
              nullif(split_part(realtime.topic(), ':', 2), '')::uuid
            )
          else false
        end
      )
  $policy$;
exception when insufficient_privilege then
  raise notice 'Skipping "Canvas realtime: send if editor" policy (insufficient privilege) — canvas realtime send-authorization remains unavailable on this project.';
end $$;
