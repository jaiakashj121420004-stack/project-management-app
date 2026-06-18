-- Migration: columns + cards (Phase 4 — Kanban board)
-- See plan.md §5 (data model) and §6 (security model).
--
-- These are the first per-project content tables. They reuse the Phase 3
-- multi-tenant pattern verbatim: every row is gated on membership of its
-- project via the is_project_member(project_id) SECURITY DEFINER helper, so the
-- policies stay flat and never re-enter project_members' own RLS. The frontend
-- is untrusted; these database rules are the real guarantee.

-- 1. Tables ------------------------------------------------------------------

-- A Kanban column (list) within a project. `position` is a fractional rank: new
-- columns slot between neighbours by taking the midpoint of their positions, so
-- a reorder writes a single row and never collides with another (see
-- src/features/board/ordering.ts). Stored as double precision; ordered ASC.
create table if not exists public.columns (
  id         uuid             primary key default gen_random_uuid(),
  project_id uuid             not null references public.projects (id) on delete cascade,
  name       text             not null check (char_length(trim(name)) between 1 and 60),
  position   double precision not null,
  created_at timestamptz      not null default now()
);

comment on table public.columns is 'Kanban columns within a project (plan.md §5). Access gated by project membership via RLS.';

-- A card (task) inside a column. due_date / assignee_id are nullable now; the
-- card detail UI fills title + description in Phase 4 and grows checklists,
-- due dates, labels, and assignment in Phase 5. `position` is the same
-- fractional rank as columns, scoped to the owning column.
create table if not exists public.cards (
  id          uuid             primary key default gen_random_uuid(),
  project_id  uuid             not null references public.projects (id) on delete cascade,
  column_id   uuid             not null references public.columns (id)  on delete cascade,
  title       text             not null check (char_length(trim(title)) between 1 and 200),
  description text                      check (description is null or char_length(description) <= 5000),
  due_date    date,
  assignee_id uuid                      references auth.users (id) on delete set null,
  position    double precision not null,
  created_at  timestamptz      not null default now()
);

comment on table public.cards is 'Kanban cards / tasks (plan.md §5). Access gated by project membership via RLS.';

-- Lookups are always "everything for this project" (board fetch) and "cards in
-- this column" (reorder). Index the foreign keys those scans hit.
create index if not exists columns_project_id_idx on public.columns (project_id);
create index if not exists cards_project_id_idx    on public.cards (project_id);
create index if not exists cards_column_id_idx      on public.cards (column_id);

-- 2. Seed default columns on new projects ------------------------------------
-- Every new project gets To Do / In Progress / Done so its board is usable
-- immediately. SECURITY DEFINER (search_path pinned, refs schema-qualified) so
-- the seed runs regardless of the creator's not-yet-settled membership — same
-- hardening as handle_new_project() in the projects migration. Positions are
-- spaced by 1000 to leave room for fractional inserts between them.
create or replace function public.seed_project_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.columns (project_id, name, position)
  values
    (new.id, 'To Do',       1000),
    (new.id, 'In Progress', 2000),
    (new.id, 'Done',        3000);
  return new;
end;
$$;

-- A separate AFTER INSERT trigger from on_project_created (membership). Both are
-- independent and SECURITY DEFINER, so trigger firing order does not matter.
drop trigger if exists on_project_created_seed_columns on public.projects;
create trigger on_project_created_seed_columns
  after insert on public.projects
  for each row execute function public.seed_project_columns();

-- Backfill: give any project that predates this migration the default columns,
-- so existing workspaces (e.g. ones created during Phase 3 verification) get a
-- board too. Skips projects that already have columns.
insert into public.columns (project_id, name, position)
select p.id, defaults.name, defaults.position
from public.projects p
cross join (
  values ('To Do', 1000.0), ('In Progress', 2000.0), ('Done', 3000.0)
) as defaults(name, position)
where not exists (
  select 1 from public.columns c where c.project_id = p.id
);

-- 3. Row Level Security ------------------------------------------------------
-- Membership is the unit of access (plan.md §6): any member of a project may
-- read and write its columns and cards. Role-based limits (viewers read-only)
-- arrive with the collaboration UI in Phase 8; until then every member has full
-- board access. The WITH CHECK on insert/update prevents a member from creating
-- or moving a row into a project they do not belong to.
alter table public.columns enable row level security;
alter table public.cards   enable row level security;

-- columns --------------------------------------------------------------------
drop policy if exists "Columns: select if member" on public.columns;
create policy "Columns: select if member"
  on public.columns
  for select
  to authenticated
  using (public.is_project_member(project_id));

drop policy if exists "Columns: insert if member" on public.columns;
create policy "Columns: insert if member"
  on public.columns
  for insert
  to authenticated
  with check (public.is_project_member(project_id));

drop policy if exists "Columns: update if member" on public.columns;
create policy "Columns: update if member"
  on public.columns
  for update
  to authenticated
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

drop policy if exists "Columns: delete if member" on public.columns;
create policy "Columns: delete if member"
  on public.columns
  for delete
  to authenticated
  using (public.is_project_member(project_id));

-- cards ----------------------------------------------------------------------
drop policy if exists "Cards: select if member" on public.cards;
create policy "Cards: select if member"
  on public.cards
  for select
  to authenticated
  using (public.is_project_member(project_id));

drop policy if exists "Cards: insert if member" on public.cards;
create policy "Cards: insert if member"
  on public.cards
  for insert
  to authenticated
  with check (public.is_project_member(project_id));

drop policy if exists "Cards: update if member" on public.cards;
create policy "Cards: update if member"
  on public.cards
  for update
  to authenticated
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

drop policy if exists "Cards: delete if member" on public.cards;
create policy "Cards: delete if member"
  on public.cards
  for delete
  to authenticated
  using (public.is_project_member(project_id));
