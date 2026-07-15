-- Migration: isolate billing/reminder PII from co-members (Remediation Phase 2 — M1).
-- See SECURITY-REVIEW-2026-07-15.md finding M1 and SECURITY-FIX-PLAN.md §Phase 2.
--
-- Problem: RLS is row-level, so the additive "Profiles: select co-members" policy
-- (20260620160000_collaboration.sql) exposed the ENTIRE profiles row to anyone who
-- shares a project — including dodo_customer_id, dodo_subscription_id, plan,
-- plan_status, reminder_emails_enabled, reminder_lead_days. The members panel only
-- ever needs id, display_name, avatar_url.
--
-- Approach chosen: (b) keep the columns on `profiles`, drop the whole-row co-member
-- SELECT policy so the base table is OWN-ROW-ONLY again, and serve co-member display
-- data through a SECURITY DEFINER function that returns ONLY the three safe columns.
--
-- Why (b) and not (a) "move billing columns to a new table": every Pro/billing/
-- reminder code path reads these columns from `profiles` as the OWNER inside
-- SECURITY DEFINER functions (current_plan, project_is_pro, user_is_pro, the
-- reminders cron) or the service-role Dodo webhook — none of which are affected by a
-- row-level policy change. Splitting the table would force rewriting all of those
-- plus a data backfill and the protect_plan_columns trigger, right before charging
-- real money. (b) touches one policy, adds one function, and changes one frontend
-- query — the minimal, lowest-risk fix. Grants/scoping only; no data moves.
--
-- Every statement is idempotent (drop policy if exists / create or replace / revoke)
-- so this file is safe to re-run.

-- 1. Base table back to OWN-ROW-ONLY --------------------------------------------
-- Remove the additive whole-row co-member read. "Profiles: select own"
-- (auth.uid() = id) and "Profiles: update own" from 20260618093000 remain, so a
-- user still reads/writes only their own row (incl. their own plan + reminder prefs).
drop policy if exists "Profiles: select co-members" on public.profiles;

-- 2. Safe co-member display data via a SECURITY DEFINER function -----------------
-- Returns ONLY id, display_name, avatar_url, and ONLY for ids the caller is allowed
-- to see: their own row, or a user they co-belong to a project with. This preserves
-- the exact visibility of the old policy (auth.uid() = id OR shares_a_project_with)
-- while withholding every billing/reminder column. SECURITY DEFINER so the lookup
-- can read profiles despite the now own-row-only base policy; search_path pinned and
-- every reference schema-qualified per the repo's definer-function convention.
create or replace function public.co_member_profiles(p_ids uuid[])
returns table (id uuid, display_name text, avatar_url text)
language sql
security definer
set search_path = ''
stable
as $$
  select p.id, p.display_name, p.avatar_url
  from public.profiles p
  where p.id = any(p_ids)
    and (p.id = auth.uid() or public.shares_a_project_with(p.id));
$$;

comment on function public.co_member_profiles(uuid[]) is
  'SECURITY DEFINER: display data (id, display_name, avatar_url ONLY) for the given user ids that the caller may see (self or a project co-member). Replaces the whole-row "Profiles: select co-members" policy so billing/reminder PII is never exposed to co-members (M1).';

-- Callable only by logged-in users (the members panel). No PUBLIC/anon default.
revoke all on function public.co_member_profiles(uuid[]) from public, anon;
grant execute on function public.co_member_profiles(uuid[]) to authenticated;
