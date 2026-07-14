-- Emoji icons for standalone notes + Library folders (Nvexis polish).
--
-- A single nullable text column on each table holds one emoji (or null = fall
-- back to the default lucide icon). No RLS change is needed: the column lives on
-- rows already governed by each table's existing policies, so a user can only
-- read/write the icon of a note/folder they can already read/write.

alter table public.notes add column if not exists icon text;
alter table public.folders add column if not exists icon text;
