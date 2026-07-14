-- Migration: sharing hardening — close the account-enumeration oracle (Remediation Phase 6).
-- See AUDIT-nvexis.md §3 finding #1 and REMEDIATION-PLAN.md §Phase 6.
--
-- Before: `user_id_for_email(text)` was granted to every authenticated user and
-- returned the UUID for ANY email, and share_canvas/share_note raised a distinct
-- "No Nvexis user with that email" error when the address had no account. Either
-- one lets an authed attacker confirm which emails have registered — an
-- enumeration oracle.
--
-- After:
--   (1) EXECUTE on user_id_for_email is revoked from `authenticated`, so the
--       lookup can no longer be called directly from the client. The function is
--       kept (owned by the definer role) only so the two share RPCs can resolve
--       an email server-side; a SECURITY DEFINER caller runs as the owner, which
--       still holds EXECUTE, so the RPCs keep working after the revoke.
--   (2) The email→user lookup is INLINED into share_canvas/share_note and the
--       "no such user" branch no longer raises. Whether or not the email matched,
--       the RPC returns the SAME generic result (void) — the caller can't tell a
--       real account from an unknown address. Genuine authorisation failures
--       (not the owner, bad role) still raise, because those don't leak account
--       existence and the owner needs the feedback.
--
-- Idempotent: create-or-replace + an explicit revoke that is safe to re-run.

-- ============================================================================
-- 1. Lock down the raw lookup -------------------------------------------------
-- Revoke direct EXECUTE from clients. (The function body is unchanged; it stays
-- SECURITY DEFINER so the share RPCs below can still use it internally, though
-- they now inline the same query and no longer depend on it.)
revoke execute on function public.user_id_for_email(text) from authenticated;
-- Belt-and-suspenders: PUBLIC never had it, but make the intent explicit.
revoke execute on function public.user_id_for_email(text) from public;

-- ============================================================================
-- 2. Canvas sharing RPC — inline lookup, generic result -----------------------
-- Owner-gated. Resolves the email inline; if it doesn't match a registered user
-- (or is the caller's own address) the RPC is a no-op and returns the same void
-- result as a successful share, so it never reveals whether the email exists.
-- Postgres won't let CREATE OR REPLACE change a function's return type (uuid →
-- void), so drop the old signature first.
drop function if exists public.share_canvas(uuid, text, text);
create function public.share_canvas(p_canvas_id uuid, p_email text, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  -- Authorisation failures may raise: they don't leak account existence and the
  -- owner needs to know the share was rejected.
  if not public.is_canvas_owner(p_canvas_id) then
    raise exception 'Only the canvas owner can share it';
  end if;
  if p_role not in ('editor', 'viewer') then
    raise exception 'Role must be editor or viewer';
  end if;

  -- Inline email→user lookup (no separate client-callable oracle).
  select u.id into v_user
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;

  -- Unknown email, or the owner's own address → silently do nothing. The caller
  -- gets the SAME response as a real share, so account existence never leaks.
  if v_user is null or v_user = auth.uid() then
    return;
  end if;

  insert into public.canvas_members (canvas_id, user_id, role)
  values (p_canvas_id, v_user, p_role)
  on conflict (canvas_id, user_id) do update set role = excluded.role;
end;
$$;

grant execute on function public.share_canvas(uuid, text, text) to authenticated;

-- ============================================================================
-- 3. Note sharing RPC — inline lookup, generic result -------------------------
-- Drop first for the same return-type reason as share_canvas above.
drop function if exists public.share_note(uuid, text, text);
create function public.share_note(p_note_id uuid, p_email text, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not public.is_note_owner(p_note_id) then
    raise exception 'Only the note owner can share it';
  end if;
  if p_role not in ('editor', 'viewer') then
    raise exception 'Role must be editor or viewer';
  end if;

  select u.id into v_user
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;

  if v_user is null or v_user = auth.uid() then
    return;
  end if;

  insert into public.note_members (note_id, user_id, role)
  values (p_note_id, v_user, p_role)
  on conflict (note_id, user_id) do update set role = excluded.role;
end;
$$;

grant execute on function public.share_note(uuid, text, text) to authenticated;
