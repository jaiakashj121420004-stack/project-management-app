-- Migration: checklist_items + labels + card_labels (Phase 5 — Card details)
-- See plan.md §5 (data model) and §6 (security model).
--
-- These enrich a card with a to-do checklist, project-scoped labels, and the
-- card↔label join. They reuse the multi-tenant pattern verbatim: every row is
-- gated on membership of its owning project. `labels` carries project_id, so it
-- gates on is_project_member(project_id) directly; checklist_items and
-- card_labels hang off a card, so they gate through a new SECURITY DEFINER
-- helper can_access_card(card_id) that resolves the card's project once and
-- keeps the policies flat (no sub-query into another RLS'd table). The frontend
-- is untrusted; these database rules are the real guarantee.

-- 1. Tables ------------------------------------------------------------------

-- A to-do item inside a card (plan.md §5). `position` is the same fractional
-- rank used by columns/cards: an item moved between two neighbours takes the
-- midpoint of their positions, so a reorder writes one row and never collides
-- (see src/features/board/ordering.ts). Ordered ASC within a card.
create table if not exists public.checklist_items (
  id         uuid             primary key default gen_random_uuid(),
  card_id    uuid             not null references public.cards (id) on delete cascade,
  text       text             not null check (char_length(trim(text)) between 1 and 500),
  is_done    boolean          not null default false,
  position   double precision not null,
  created_at timestamptz      not null default now()
);

comment on table public.checklist_items is 'To-do items within a card (plan.md §5). Access gated by the card''s project membership via RLS.';

-- A reusable, project-scoped tag. `color` names one of the label palette colors
-- (src/lib/labelColors.ts), constrained by a CHECK the same way projects.accent
-- is — the DB validates the set, the UI maps the name to a hex. Names are unique
-- per project (case-sensitive) so the same tag isn't created twice.
create table if not exists public.labels (
  id         uuid        primary key default gen_random_uuid(),
  project_id uuid        not null references public.projects (id) on delete cascade,
  name       text        not null check (char_length(trim(name)) between 1 and 40),
  color      text        not null check (color in ('violet', 'cyan', 'emerald', 'amber', 'rose', 'pink', 'indigo', 'slate')),
  created_at timestamptz not null default now()
);

comment on table public.labels is 'Project-scoped tags for cards (plan.md §5). Access gated by project membership via RLS.';

create unique index if not exists labels_project_name_key on public.labels (project_id, name);

-- The many-to-many join between cards and labels. Composite PK means a label is
-- attached to a card at most once.
create table if not exists public.card_labels (
  card_id  uuid not null references public.cards (id)  on delete cascade,
  label_id uuid not null references public.labels (id) on delete cascade,
  primary key (card_id, label_id)
);

comment on table public.card_labels is 'Card↔label attachments (plan.md §5). Access gated by the card''s project membership via RLS.';

-- Lookups: checklist by card (modal + card-face progress), card_labels by card
-- (board fetch) and by label (cascade + label-filter). card_id leads the
-- card_labels PK so it is already covered; index label_id separately.
create index if not exists checklist_items_card_id_idx on public.checklist_items (card_id);
create index if not exists card_labels_label_id_idx     on public.card_labels (label_id);

-- 2. SECURITY DEFINER card-access helper -------------------------------------
-- checklist_items and card_labels don't carry project_id; they reference a card.
-- Rather than have their policies sub-query public.cards (which would re-enter
-- cards' own RLS), we resolve the card's project inside a SECURITY DEFINER
-- function — its body runs as the table owner, reads public.cards directly, and
-- then reuses is_project_member(). Same hardening as the Phase 3 helpers:
-- search_path pinned to '' and every reference schema-qualified.
create or replace function public.can_access_card(p_card_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.cards c
    where c.id = p_card_id
      and public.is_project_member(c.project_id)
  );
$$;

comment on function public.can_access_card(uuid) is
  'SECURITY DEFINER check: may the current user access this card''s project? Used by checklist_items/card_labels RLS to stay flat (plan.md §6).';

-- 3. Row Level Security ------------------------------------------------------
-- Membership is the unit of access (plan.md §6): any member of a project may
-- read and write its labels, its cards' checklist items, and their label
-- attachments. Role-based limits (viewers read-only) arrive with collaboration
-- in Phase 8. WITH CHECK on insert/update prevents writing rows into a project
-- (or onto a card) the caller can't access.
alter table public.checklist_items enable row level security;
alter table public.labels          enable row level security;
alter table public.card_labels     enable row level security;

-- checklist_items ------------------------------------------------------------
drop policy if exists "Checklist: select if member" on public.checklist_items;
create policy "Checklist: select if member"
  on public.checklist_items
  for select
  to authenticated
  using (public.can_access_card(card_id));

drop policy if exists "Checklist: insert if member" on public.checklist_items;
create policy "Checklist: insert if member"
  on public.checklist_items
  for insert
  to authenticated
  with check (public.can_access_card(card_id));

drop policy if exists "Checklist: update if member" on public.checklist_items;
create policy "Checklist: update if member"
  on public.checklist_items
  for update
  to authenticated
  using (public.can_access_card(card_id))
  with check (public.can_access_card(card_id));

drop policy if exists "Checklist: delete if member" on public.checklist_items;
create policy "Checklist: delete if member"
  on public.checklist_items
  for delete
  to authenticated
  using (public.can_access_card(card_id));

-- labels ---------------------------------------------------------------------
drop policy if exists "Labels: select if member" on public.labels;
create policy "Labels: select if member"
  on public.labels
  for select
  to authenticated
  using (public.is_project_member(project_id));

drop policy if exists "Labels: insert if member" on public.labels;
create policy "Labels: insert if member"
  on public.labels
  for insert
  to authenticated
  with check (public.is_project_member(project_id));

drop policy if exists "Labels: update if member" on public.labels;
create policy "Labels: update if member"
  on public.labels
  for update
  to authenticated
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

drop policy if exists "Labels: delete if member" on public.labels;
create policy "Labels: delete if member"
  on public.labels
  for delete
  to authenticated
  using (public.is_project_member(project_id));

-- card_labels ----------------------------------------------------------------
drop policy if exists "Card labels: select if member" on public.card_labels;
create policy "Card labels: select if member"
  on public.card_labels
  for select
  to authenticated
  using (public.can_access_card(card_id));

drop policy if exists "Card labels: insert if member" on public.card_labels;
create policy "Card labels: insert if member"
  on public.card_labels
  for insert
  to authenticated
  with check (public.can_access_card(card_id));

drop policy if exists "Card labels: delete if member" on public.card_labels;
create policy "Card labels: delete if member"
  on public.card_labels
  for delete
  to authenticated
  using (public.can_access_card(card_id));

-- No UPDATE policy on card_labels: a (card_id, label_id) attachment is created
-- or removed, never edited in place.
