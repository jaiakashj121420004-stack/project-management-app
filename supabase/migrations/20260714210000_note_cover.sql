-- Cover image for standalone notes (Notion-style banner).
--
-- Stores a private note-media storage path (same `note-media` bucket + RLS as
-- inline note images, 20260714180000). Null = no cover. No RLS change needed —
-- the column lives on a row already governed by the notes policies.

alter table public.notes add column if not exists cover text;
