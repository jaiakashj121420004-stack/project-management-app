-- Migration: make recurring to-do-list seeding atomic (fixes a real bug: a
-- recurring list ("To learn", "Trade Metrics", ...) that generates for a new
-- day with zero items, permanently, because the list row and its items were
-- inserted as separate client-side calls (TodosPage.tsx's seeding effect).
--
-- Root cause: `insertTodoList` created the day's list (stamping
-- `source_recurrence_id`) and THEN a loop of `insertTodoItem` calls populated
-- it. If anything interrupted the loop (a dropped connection, a refresh, a
-- transient RLS/network hiccup) after the list existed but before its items
-- landed, the list was left empty — and stayed that way forever, because the
-- seeding effect's de-dupe only checks "does a list already exist for this
-- recurrence today" (`source_recurrence_id`), not "does it have its items."
-- So it never retried. (memory.md, 2026-09-01 — reported by user: "To learn"
-- and "Trade Metrics" showed up empty on a new day despite being set to
-- repeat, while the original day still had all their items.)
--
-- Fix: do the list insert + all item inserts in ONE function call, so
-- Postgres wraps them in a single transaction — either the whole day's
-- recurring list shows up complete, or (on any failure) nothing is created at
-- all and the client's existing de-dupe check naturally retries it on the
-- next page load. No more silently-orphaned empty lists.
--
-- SECURITY INVOKER (the default — no `security definer` here) so this runs as
-- the calling user: normal RLS policies on todo_lists/todo_items still apply,
-- same as if the client had issued the inserts itself.
create or replace function public.seed_recurring_todo_list(
  p_list_date       date,
  p_name            text,
  p_position        double precision,
  p_recurrence_id   uuid,
  p_items           text[]
)
returns public.todo_lists
language plpgsql
as $$
declare
  v_list public.todo_lists;
  v_item text;
  v_item_position double precision := 1000;
begin
  insert into public.todo_lists (list_date, name, position, source_recurrence_id)
  values (p_list_date, p_name, p_position, p_recurrence_id)
  returning * into v_list;

  foreach v_item in array p_items loop
    insert into public.todo_items (list_id, text, position)
    values (v_list.id, v_item, v_item_position);
    v_item_position := v_item_position + 1000;
  end loop;

  return v_list;
end;
$$;

comment on function public.seed_recurring_todo_list(date, text, double precision, uuid, text[]) is
  'Atomically creates a recurring to-do list plus its seeded items for one day (list_date). Used by the client instead of a separate insertTodoList + insertTodoItem loop so a mid-seed failure can never leave a permanently-empty list behind (memory.md, 2026-09-01).';

grant execute on function public.seed_recurring_todo_list(date, text, double precision, uuid, text[]) to authenticated;
