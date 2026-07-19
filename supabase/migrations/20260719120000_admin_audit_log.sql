-- Admin audit log — trace what the app administrator does, since is_admin()
-- (and raw dashboard/service_role access) bypasses RLS by design (plan.md §6).
-- This doesn't stop dashboard SQL Editor browsing (that's a Postgres-level
-- concern, out of scope for app migrations) — it makes every admin ACTION
-- taken *through the app* traceable: who did what, to which row, and when.
--
-- All statements are idempotent (create table if not exists / create or
-- replace / drop trigger|policy if exists + create), safe to re-run.

-- =============================================================================
-- admin_audit_log — append-only, admin-readable, no client write path
-- =============================================================================
create table if not exists public.admin_audit_log (
  id          uuid        primary key default gen_random_uuid(),
  admin_id    uuid        not null references auth.users (id) on delete cascade,
  action      text        not null,
  target_table text       not null,
  target_id   text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

comment on table public.admin_audit_log is
  'Append-only log of admin actions taken through the app (CEO message writes, feedback-inbox reads). Written only via log_admin_action() / triggers; no client insert policy.';

create index if not exists admin_audit_log_created_at_idx
  on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

-- Only admins may read the log (of themselves or, since there's currently a
-- single admin principal, effectively the whole log). No insert/update/delete
-- policy exists for any client role — every write goes through the
-- SECURITY DEFINER function below, which re-checks is_admin() itself.
drop policy if exists "admin_audit_log: admin reads" on public.admin_audit_log;
create policy "admin_audit_log: admin reads"
  on public.admin_audit_log
  for select
  to authenticated
  using (public.is_admin());

revoke all on public.admin_audit_log from anon;
grant select on public.admin_audit_log to authenticated;

-- 1-arg helper: record an admin action. Raises if the caller isn't an admin,
-- so it can never be used to forge a log entry under someone else's identity.
create or replace function public.log_admin_action(
  p_action text,
  p_target_table text,
  p_target_id text default null,
  p_detail jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the app administrator may write to the audit log.';
  end if;

  insert into public.admin_audit_log (admin_id, action, target_table, target_id, detail)
  values (auth.uid(), p_action, p_target_table, p_target_id, p_detail);
end;
$$;

comment on function public.log_admin_action(text, text, text, jsonb) is
  'Append an admin_audit_log row for the calling admin. SECURITY DEFINER so it can write despite the log having no client insert policy; still gated by is_admin().';

grant execute on function public.log_admin_action(text, text, text, jsonb) to authenticated;

-- =============================================================================
-- Auto-log every CEO-message write (insert/update/delete already require
-- is_admin() via RLS, so any write reaching this trigger was an admin action).
-- =============================================================================
create or replace function public.audit_ceo_messages()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.log_admin_action(
    lower(TG_OP),
    'ceo_messages',
    coalesce(new.id, old.id)::text,
    case when TG_OP = 'DELETE' then to_jsonb(old) else to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists audit_ceo_messages on public.ceo_messages;
create trigger audit_ceo_messages
  after insert or update or delete on public.ceo_messages
  for each row
  execute function public.audit_ceo_messages();

-- =============================================================================
-- Audited feedback-inbox read. Replaces the direct "admin reads all" SELECT
-- policy: from now on, an admin reading everyone's feedback goes through this
-- RPC (so the read is logged), not a plain `.from('feedback').select()`. A
-- user's own submit/read-own access is untouched.
-- =============================================================================
drop policy if exists "feedback: admin reads all" on public.feedback;

create or replace function public.admin_list_feedback()
returns setof public.feedback
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only the app administrator may list all feedback.';
  end if;

  perform public.log_admin_action('read', 'feedback', null, null);

  return query
    select * from public.feedback order by created_at desc;
end;
$$;

comment on function public.admin_list_feedback() is
  'Admin-only: every feedback submission, newest first, with the read itself logged to admin_audit_log. Replaces the old direct-select RLS path (was un-audited).';

grant execute on function public.admin_list_feedback() to authenticated;
