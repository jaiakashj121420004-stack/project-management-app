-- Phase 9 — due-date reminders.
--
-- Adds per-user reminder preferences, a per-card "already reminded" marker, and
-- two SECURITY DEFINER RPCs that the reminders Edge Function calls (service_role
-- only) to find cards due soon and mark them notified. The Edge Function +
-- pg_cron schedule + secrets are documented in supabase/README.md. See plan.md
-- §6 (security) and prompt.md → Phase 9.

-- 1. Per-user reminder preferences. profiles already has own-row RLS (a user may
--    read/update only their own row), so users opt themselves in and choose how
--    many days ahead to be reminded.
alter table public.profiles
  add column if not exists reminder_emails_enabled boolean not null default false,
  add column if not exists reminder_lead_days integer not null default 1
    check (reminder_lead_days between 0 and 14);

-- 2. Dedupe marker: the due_date we last emailed a reminder for. When a card's
--    due_date changes this no longer matches, so the card becomes eligible
--    again. NULL = never reminded. The Edge Function (service_role) sets it via
--    mark_reminders_sent(); the column isn't writable from the browser anyway
--    (cards writes require owner/editor and never touch this column).
alter table public.cards
  add column if not exists reminder_sent_for date;

-- 3. Candidates for a reminder run: cards due within each assignee's lead window
--    whose assignee has opted in and hasn't yet been reminded for this due_date.
--    SECURITY DEFINER so it can read auth.users (for the email) and bypass RLS;
--    EXECUTE is granted to service_role only (the Edge Function), never the
--    browser, so no client can enumerate other users' emails.
create or replace function public.due_reminder_candidates(p_lead_days integer default null)
returns table (
  card_id uuid,
  title text,
  due_date date,
  project_id uuid,
  project_name text,
  assignee_id uuid,
  email text,
  display_name text
)
language sql
security definer
set search_path = ''
as $$
  select
    c.id, c.title, c.due_date, c.project_id, p.name,
    c.assignee_id, u.email, pr.display_name
  from public.cards c
  join public.projects p  on p.id = c.project_id
  join auth.users u       on u.id = c.assignee_id
  join public.profiles pr on pr.id = c.assignee_id
  where c.due_date is not null
    and c.assignee_id is not null
    and pr.reminder_emails_enabled = true
    and u.email is not null
    and c.due_date >= current_date
    and c.due_date <= current_date + coalesce(p_lead_days, pr.reminder_lead_days)
    and c.reminder_sent_for is distinct from c.due_date
  order by u.email, c.due_date;
$$;

-- 4. Mark the given cards as reminded for their current due_date.
create or replace function public.mark_reminders_sent(p_card_ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.cards
  set reminder_sent_for = due_date
  where id = any(p_card_ids);
$$;

-- Both RPCs are server-only: revoke from browser roles, grant to service_role.
revoke all on function public.due_reminder_candidates(integer) from public, anon, authenticated;
revoke all on function public.mark_reminders_sent(uuid[]) from public, anon, authenticated;
grant execute on function public.due_reminder_candidates(integer) to service_role;
grant execute on function public.mark_reminders_sent(uuid[]) to service_role;
