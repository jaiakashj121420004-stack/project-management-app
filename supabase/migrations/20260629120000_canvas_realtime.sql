-- ===========================================================================
-- Pro P3.7 — Canvas live multiplayer: secure the Yjs broadcast channel.
-- ===========================================================================
-- The collaborative canvas (features/canvas/collab) syncs one Y.Doc per note
-- over a Supabase Realtime *broadcast* channel named `canvas:<noteId>`, joined
-- as a PRIVATE channel (`config.private = true`). Private channels authorize
-- every send/receive against RLS on `realtime.messages`, so the channel itself
-- — not just the persisted `canvas_notes.doc_state` — is gated by who may see /
-- edit the canvas. Without this, any authenticated user who guessed a noteId
-- could subscribe to another board's live edits.
--
-- Authorization reuses the existing canvas access helpers (SECURITY DEFINER,
-- defined in 20260622200000_canvas_standalone.sql), so the channel inherits the
-- exact same "owner / project member / canvas_members" rules as the table:
--   * RECEIVE (select) — can_access_canvas: any viewer of the canvas.
--   * SEND   (insert)  — can_edit_canvas:  only editors (Pro editors, by the
--                         table's own write RLS) may broadcast updates.
--
-- These policies only affect PRIVATE channels. The app's other channels
-- (presence:project:*, the per-user notifications channel) are PUBLIC and skip
-- realtime.messages authorization entirely, so they are unaffected.
--
-- The topic for a canvas channel is `canvas:<uuid>`; `realtime.topic()` returns
-- it inside the policy. A CASE guards the uuid cast so it only runs for our
-- topics (CASE short-circuits in Postgres), never erroring on other channels.
-- ===========================================================================

-- RLS is already enabled on realtime.messages in Supabase projects; assert it.
alter table if exists realtime.messages enable row level security;

-- Receive: a viewer of the canvas may read broadcast + presence messages on its
-- channel. Covers the Yjs update/sync handshake AND awareness (cursors).
drop policy if exists "Canvas realtime: receive if accessible" on realtime.messages;
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
  );

-- Send: only an editor of the canvas may broadcast Yjs updates / awareness. A
-- viewer (RLS can_access but not can_edit) receives live edits but can't emit —
-- mirroring the table's read-only-for-viewers write RLS, defence in depth.
drop policy if exists "Canvas realtime: send if editor" on realtime.messages;
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
  );
