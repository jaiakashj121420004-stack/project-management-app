-- Migration: note media storage (images in notes — free)
--
-- Standalone notes have no project, so canvas-media (project-keyed) doesn't fit.
-- A dedicated PRIVATE `note-media` bucket holds note images, keyed by note id:
-- path = `<noteId>/<uuid>.<ext>`. Access mirrors the note itself via the existing
-- can_access_note / can_edit_note helpers, so an image is exactly as private (or
-- shared) as its note. Served through short-lived signed URLs (never public).

insert into storage.buckets (id, name, public)
values ('note-media', 'note-media', false)
on conflict (id) do nothing;

-- Read: anyone who can access the note (owner / project member / shared member).
drop policy if exists "Note media: read" on storage.objects;
create policy "Note media: read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'note-media'
    and public.can_access_note(((storage.foldername(name))[1])::uuid)
  );

-- Insert: note editors only.
drop policy if exists "Note media: insert" on storage.objects;
create policy "Note media: insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'note-media'
    and public.can_edit_note(((storage.foldername(name))[1])::uuid)
  );

-- Delete: note editors only.
drop policy if exists "Note media: delete" on storage.objects;
create policy "Note media: delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'note-media'
    and public.can_edit_note(((storage.foldername(name))[1])::uuid)
  );
