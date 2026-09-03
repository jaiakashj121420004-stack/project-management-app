-- ===========================================================================
-- Pro P3.7 — Canvas live multiplayer: secure the Yjs broadcast channel.
-- ===========================================================================
-- The collaborative canvas (features/canvas/collab) syncs one Y.Doc per note
-- over a Supabase Realtime *broadcast* channel named `canvas:<noteId>`, joined
-- as a PRIVATE channel (config.private = true). Private channels authorize
-- every send/receive against RLS on realtime.messages.
--
-- Supabase owns realtime.messages in hosted projects. This migration therefore
-- applies the policies only when the executing role owns the managed table. If
-- it does not, the migration skips with a notice and the managed table's
-- existing fail-closed RLS remains in force; an owner-level deployment must
-- install these policies before private canvas realtime is enabled.
-- ===========================================================================

do $$
declare
  messages_owner name;
begin
  select tableowner into messages_owner
    from pg_tables
   where schemaname = 'realtime'
     and tablename = 'messages';

  if messages_owner is null then
    raise notice 'Skipping canvas realtime policies: realtime.messages is unavailable';
    return;
  end if;

  if current_user <> messages_owner
     and not pg_has_role(current_user, messages_owner, 'member') then
    raise notice 'Skipping canvas realtime policies: realtime.messages is owned by %', messages_owner;
    return;
  end if;

  execute 'alter table realtime.messages enable row level security';
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
end $$;
