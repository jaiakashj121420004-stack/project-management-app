-- Migration: notes rich block content (Nvexis Phase 3 — Notion-style block editor)
-- See NVEXIS-UPGRADE-PLAN.md §5.
--
-- Phase 3 moves notes off plain markdown onto the shared Tiptap block editor.
-- A note now stores its document as Tiptap JSON in `content_json` (the source of
-- truth), while the existing `content` text column becomes a plain-text mirror
-- (for previews, search, and markdown export). This is additive and backward-safe:
--   * content_json NULL  → a legacy note not yet opened in the block editor; the
--     app seeds the editor by parsing the markdown `content`, and writes
--     content_json on first save.
--   * content_json SET   → the block editor is the source; `content` holds the
--     flattened plain text of the same document.
-- No RLS change (same rows, same policies as 20260713120000).

alter table public.notes
  add column if not exists content_json jsonb;

comment on column public.notes.content_json is
  'Tiptap block-editor document (Phase 3 source of truth). NULL = a legacy markdown note not yet opened in the block editor; `content` is then the source + becomes the plain-text search mirror after first save.';
