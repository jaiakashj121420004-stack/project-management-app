-- Migration: file attachments on Kanban cards (card_attachments + card-attachments
-- Storage bucket). See plan.md §5 (data model) and §6 (security model).
--
-- Mirrors the note-media pattern (20260714180000_note_media.sql) for the
-- Storage side — a dedicated PRIVATE bucket keyed by the owning entity's id,
-- served exclusively through short-lived signed URLs — and the card_labels /
-- time_entries pattern for the table side: a card-scoped row, resolved to its
-- project via the existing can_access_card() / can_edit_card() SECURITY
-- DEFINER helpers (20260618160000_card_details.sql, 20260620160000_
-- collaboration.sql) so the policies stay flat and never re-enter another
-- table's RLS.
--
-- Access model (matches the task spec, not the looser checklist_items rule):
--   - READ  any project member (can_access_card) — same as checklist/labels.
--   - WRITE (upload) only an editor/owner (can_edit_card) — attachments are a
--     step up from checklist items, which any member may add.
--   - DELETE the uploader OR an editor/owner — so a member who uploaded a file
--     can always remove their own mistake, even if later demoted to viewer,
--     while an editor/owner can clean up anyone's attachment.
--
-- Size is capped both server-side (this migration, the real gate) and
-- client-side (src/features/board/cardAttachments.ts, UX only) — same
-- belt-and-suspenders split as canvas-media
-- (20260812010000_canvas_media_caps_and_quota.sql). Any MIME type is allowed
-- (attachments aren't restricted to image/audio/video like canvas media), so
-- only size is checked. Keep CARD_ATTACHMENT_MAX_BYTES here in sync with
-- CARD_ATTACHMENT_MAX_BYTES in src/features/board/cardAttachments.ts.

-- 1. Table ---------------------------------------------------------------

create table if not exists public.card_attachments (
  id           uuid        primary key default gen_random_uuid(),
  card_id      uuid        not null references public.cards (id) on delete cascade,
  uploader_id  uuid        not null references auth.users (id) on delete cascade,
  -- Path in the card-attachments bucket: '<cardId>/<uuid>.<ext>'.
  storage_path text        not null,
  file_name    text        not null check (char_length(trim(file_name)) between 1 and 255),
  mime_type    text        not null check (char_length(trim(mime_type)) between 1 and 255),
  size_bytes   bigint      not null check (size_bytes > 0 and size_bytes <= 26214400), -- 25 MB
  created_at   timestamptz not null default now()
);

comment on table public.card_attachments is 'File attachments on a Kanban card (plan.md §5). Read gated by card→project membership; write (upload) requires editor/owner; delete allowed for the uploader or an editor/owner. Backing bytes live in the private card-attachments Storage bucket.';

create unique index if not exists card_attachments_storage_path_key on public.card_attachments (storage_path);
create index if not exists card_attachments_card_id_idx on public.card_attachments (card_id);

-- 2. Row Level Security ----------------------------------------------------
alter table public.card_attachments enable row level security;

drop policy if exists "Card attachments: select if member" on public.card_attachments;
create policy "Card attachments: select if member"
  on public.card_attachments
  for select
  to authenticated
  using (public.can_access_card(card_id));

drop policy if exists "Card attachments: insert if editor" on public.card_attachments;
create policy "Card attachments: insert if editor"
  on public.card_attachments
  for insert
  to authenticated
  with check (public.can_edit_card(card_id) and uploader_id = auth.uid());

drop policy if exists "Card attachments: delete if uploader or editor" on public.card_attachments;
create policy "Card attachments: delete if uploader or editor"
  on public.card_attachments
  for delete
  to authenticated
  using (uploader_id = auth.uid() or public.can_edit_card(card_id));

-- No UPDATE policy: an attachment is uploaded or removed, never edited in
-- place (same as card_labels/time_entries' immutable-row precedent).

-- 3. The card-attachments Storage bucket ------------------------------------
-- PRIVATE (public = false); objects are reachable only via short-lived signed
-- URLs minted server-side (the SELECT policy below decides who may mint one).
-- Path convention '<cardId>/<uuid>.<ext>' mirrors note-media.
--
-- file_size_limit is a hard server-side ceiling matching the per-file cap
-- below — Storage enforces it natively across every upload transport, ahead
-- of the finer metadata check in the INSERT policy.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-attachments', 'card-attachments', false, 26214400, null) -- 25 MiB
on conflict (id) do nothing;

-- Size-cap check from the object's own metadata (same technique as
-- canvas_media_within_caps in 20260812010000_canvas_media_caps_and_quota.sql).
-- Fails CLOSED if size is ever missing from metadata.
create or replace function public.card_attachment_within_cap(p_metadata jsonb)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce((p_metadata->>'size')::bigint, 9223372036854775807) <= 26214400; -- 25 MB
$$;

comment on function public.card_attachment_within_cap(jsonb) is
  'SECURITY DEFINER: is this storage.objects.metadata within the 25 MB per-file card-attachment cap? Fails closed on missing size.';

-- SELECT: any member of the object's card''s project may read it (→ sign a URL).
drop policy if exists "Card attachments: read if member" on storage.objects;
create policy "Card attachments: read if member"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'card-attachments'
    and public.can_access_card(((storage.foldername(name))[1])::uuid)
  );

-- INSERT: card editors/owners only, and within the per-file size cap.
drop policy if exists "Card attachments: insert if editor" on storage.objects;
create policy "Card attachments: insert if editor"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'card-attachments'
    and public.can_edit_card(((storage.foldername(name))[1])::uuid)
    and public.card_attachment_within_cap(metadata)
  );

-- DELETE: the uploader (Storage's own `owner` column, stamped by the Storage
-- API at upload time) or a card editor/owner — same "uploader or editor"
-- shape as the card_attachments table policy above, kept in sync so a DB-row
-- delete and its backing object delete are always authorised together.
drop policy if exists "Card attachments: delete if uploader or editor" on storage.objects;
create policy "Card attachments: delete if uploader or editor"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'card-attachments'
    and (
      owner = auth.uid()
      or public.can_edit_card(((storage.foldername(name))[1])::uuid)
    )
  );
