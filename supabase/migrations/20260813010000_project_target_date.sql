-- Migration: project target date (a project-level milestone, distinct from a
-- card's due_date) so a project can show up on the Calendar the way cards
-- already do. Free feature — same reasoning as card due dates.

alter table public.projects
  add column if not exists target_date date null;

comment on column public.projects.target_date is
  'Optional project-level milestone date, shown on the Calendar. Distinct from any card due_date.';

create index if not exists projects_target_date_idx on public.projects (target_date) where target_date is not null;
