-- Migration: goals (Task 24 — simple goals tracking, not enterprise OKRs)
-- See plan.md §5 (data model) and §6 (security model).
--
-- Deliberately flat: one goal, one progress bar, no Objective/Key-Result split,
-- no parent/child goal hierarchies, no quarterly-cycle tables. Overrides
-- reports/SIMPLICITY-GUARDRAIL.md's advisory flag by explicit product decision
-- (IMPROVEMENT-PLAN-2026-08.md Task 24) — the mitigation is scope ("goals with
-- a progress bar"), not a feature gate, so every project member can use this
-- the moment they open a project. Reuses the Phase 3 multi-tenant pattern
-- verbatim: every row is gated on membership of its project via
-- is_project_member(project_id). The frontend is untrusted; these database
-- rules are the real guarantee.

-- 1. Table ---------------------------------------------------------------

-- A goal shows one progress bar, driven either by a manually-set percentage or
-- by the completion of a single linked card's checklist (checked items / total
-- — see can_access_card()/checklist_items, 20260618160000_card_details.sql).
-- linked_card_id is ON DELETE SET NULL rather than CASCADE: deleting the card
-- a goal points at should not silently delete the goal itself — the goal stays
-- visible with "no checklist linked" until re-pointed or switched to manual.
create table if not exists public.goals (
  id             uuid             primary key default gen_random_uuid(),
  project_id     uuid             not null references public.projects (id) on delete cascade,
  owner_id       uuid             not null references auth.users (id)     on delete cascade,
  title          text             not null check (char_length(trim(title)) between 1 and 120),
  description    text                      check (description is null or char_length(description) <= 500),
  target_date    date,
  progress_type  text             not null default 'linked_checklist'
                                   check (progress_type in ('manual_percent', 'linked_checklist')),
  -- Only meaningful (and only ever set) when progress_type = 'manual_percent'.
  manual_percent integer                   check (manual_percent is null or manual_percent between 0 and 100),
  -- Only meaningful when progress_type = 'linked_checklist'; may be null (goal
  -- not yet pointed at a card, or its card was deleted — see ON DELETE above).
  linked_card_id uuid                      references public.cards (id) on delete set null,
  created_at     timestamptz      not null default now(),
  -- A manual-percent goal always carries its percentage; a linked-checklist
  -- goal never does (its progress is computed from checklist_items, not
  -- stored here). linked_card_id is intentionally NOT required by this check —
  -- it must stay nullable so ON DELETE SET NULL above can never violate it.
  constraint goals_progress_shape check (
    (progress_type = 'manual_percent' and manual_percent is not null)
    or
    (progress_type = 'linked_checklist' and manual_percent is null)
  )
);

comment on table public.goals is 'Simple goals with a single progress bar per project (plan.md §5, Task 24 — not enterprise OKRs: no Objective/Key-Result split, no hierarchy). Access gated by project membership via RLS.';

-- Lookups: goals by project (panel fetch) and by linked card (so a card delete
-- knows which goals to null out — handled by the FK itself, this index just
-- keeps that fast on large boards).
create index if not exists goals_project_id_idx    on public.goals (project_id);
create index if not exists goals_linked_card_id_idx on public.goals (linked_card_id);

-- 2. Row Level Security ----------------------------------------------------
-- Membership is the unit of access (plan.md §6): any member of a project may
-- read and write its goals — same as columns/cards/checklist_items. Role-based
-- limits (viewers read-only) are a UI-level affordance today (ProjectPage's
-- `canEdit`), not a DB one, matching every other content table in this schema.
alter table public.goals enable row level security;

drop policy if exists "Goals: select if member" on public.goals;
create policy "Goals: select if member"
  on public.goals
  for select
  to authenticated
  using (public.is_project_member(project_id));

drop policy if exists "Goals: insert if member" on public.goals;
create policy "Goals: insert if member"
  on public.goals
  for insert
  to authenticated
  with check (public.is_project_member(project_id));

drop policy if exists "Goals: update if member" on public.goals;
create policy "Goals: update if member"
  on public.goals
  for update
  to authenticated
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

drop policy if exists "Goals: delete if member" on public.goals;
create policy "Goals: delete if member"
  on public.goals
  for delete
  to authenticated
  using (public.is_project_member(project_id));
