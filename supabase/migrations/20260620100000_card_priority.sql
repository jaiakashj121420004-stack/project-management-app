-- Migration: card priority (P1, P2, P3, …)
-- See plan.md §5 (data model).
--
-- Priority is an open-ended positive integer rather than a fixed enum: P1 is the
-- most urgent, and there is no upper bound — a board with many tasks can use P10,
-- P11, and beyond. NULL means "no priority set". No RLS changes: priority is just
-- another column on `cards`, already gated by is_project_member(project_id).

alter table public.cards
  add column if not exists priority integer
  check (priority is null or priority >= 1);

comment on column public.cards.priority is
  'Task priority: 1 = highest (P1), increasing = lower urgency, NULL = unset. Open-ended (plan.md §5).';

-- Index so "order by priority" / priority filters stay cheap on large boards.
create index if not exists cards_priority_idx on public.cards (priority);
