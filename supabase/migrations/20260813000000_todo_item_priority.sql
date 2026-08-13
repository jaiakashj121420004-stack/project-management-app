-- Migration: to-do item priority (P1 first, same open-ended convention as
-- card priority — see 20260620120000_todos.sql for the base tables and
-- lib/priority.ts for the shared tier/color convention this reuses as-is).
-- Free feature (card priority already is; no reason to gate a plain sort key).

alter table public.todo_items
  add column if not exists priority integer null;

alter table public.todo_items drop constraint if exists todo_items_priority_check;
alter table public.todo_items add constraint todo_items_priority_check
  check (priority is null or priority >= 1);

-- Sort within a list by priority first (NULLs — unset — sort last), then the
-- existing manual `position` as the tiebreaker within a tier.
create index if not exists todo_items_list_priority_idx
  on public.todo_items (list_id, priority, position);

comment on column public.todo_items.priority is
  'Open-ended priority, 1 = P1 (most urgent), NULL = unset. Mirrors cards.priority.';
