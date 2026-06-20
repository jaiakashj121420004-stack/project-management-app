-- Migration: daily to-do lists (personal, per-day, independent of projects)
-- See plan.md §5 (data model) and §6 (security model).
--
-- A personal planner: for any calendar day a user keeps several named lists
-- (e.g. "Personal", "Work"), each with its own checklist of items. These are NOT
-- project content — they belong to a single user and are private to them, so RLS
-- is the simple "own rows" pattern (like profiles), not project membership.

-- 1. Tables ------------------------------------------------------------------

-- A named to-do list pinned to one calendar day. user_id defaults to the caller
-- so inserts don't have to send it; ordered within a day by `position`.
create table if not exists public.todo_lists (
  id         uuid             primary key default gen_random_uuid(),
  user_id    uuid             not null default auth.uid() references auth.users (id) on delete cascade,
  list_date  date             not null,
  name       text             not null check (char_length(trim(name)) between 1 and 60),
  position   double precision not null,
  created_at timestamptz      not null default now()
);

comment on table public.todo_lists is 'Personal daily to-do lists (plan.md §5). Private to their owner via RLS.';

create index if not exists todo_lists_user_date_idx on public.todo_lists (user_id, list_date);

-- An item within a list. Hangs off a list (which carries user_id); ordered ASC.
create table if not exists public.todo_items (
  id         uuid             primary key default gen_random_uuid(),
  list_id    uuid             not null references public.todo_lists (id) on delete cascade,
  text       text             not null check (char_length(trim(text)) between 1 and 500),
  is_done    boolean          not null default false,
  position   double precision not null,
  created_at timestamptz      not null default now()
);

comment on table public.todo_items is 'Items within a daily to-do list (plan.md §5). Private via the list''s owner (RLS).';

create index if not exists todo_items_list_id_idx on public.todo_items (list_id);

-- 2. SECURITY DEFINER ownership helper ---------------------------------------
-- todo_items don't carry user_id; they reference a list. Resolve the list's
-- owner inside a SECURITY DEFINER function (runs as the table owner, reads
-- todo_lists directly) so the items' policies stay flat — same pattern as
-- can_access_card() in the card-details migration.
create or replace function public.owns_todo_list(p_list_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.todo_lists l
    where l.id = p_list_id
      and l.user_id = auth.uid()
  );
$$;

comment on function public.owns_todo_list(uuid) is
  'SECURITY DEFINER check: does the current user own this to-do list? Used by todo_items RLS (plan.md §6).';

-- 3. Row Level Security ------------------------------------------------------
alter table public.todo_lists enable row level security;
alter table public.todo_items enable row level security;

-- todo_lists: a user sees and manages only their own lists.
drop policy if exists "Todo lists: select own" on public.todo_lists;
create policy "Todo lists: select own"
  on public.todo_lists for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Todo lists: insert own" on public.todo_lists;
create policy "Todo lists: insert own"
  on public.todo_lists for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Todo lists: update own" on public.todo_lists;
create policy "Todo lists: update own"
  on public.todo_lists for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Todo lists: delete own" on public.todo_lists;
create policy "Todo lists: delete own"
  on public.todo_lists for delete to authenticated
  using (user_id = auth.uid());

-- todo_items: gated on ownership of the parent list.
drop policy if exists "Todo items: select if owner" on public.todo_items;
create policy "Todo items: select if owner"
  on public.todo_items for select to authenticated
  using (public.owns_todo_list(list_id));

drop policy if exists "Todo items: insert if owner" on public.todo_items;
create policy "Todo items: insert if owner"
  on public.todo_items for insert to authenticated
  with check (public.owns_todo_list(list_id));

drop policy if exists "Todo items: update if owner" on public.todo_items;
create policy "Todo items: update if owner"
  on public.todo_items for update to authenticated
  using (public.owns_todo_list(list_id))
  with check (public.owns_todo_list(list_id));

drop policy if exists "Todo items: delete if owner" on public.todo_items;
create policy "Todo items: delete if owner"
  on public.todo_items for delete to authenticated
  using (public.owns_todo_list(list_id));
