-- Migration: lock down over-exposed SECURITY DEFINER RPCs (Remediation Phase 1 — H1, H2, L1).
-- See SECURITY-REVIEW-2026-07-15.md findings H1, H2, L1 and SECURITY-FIX-PLAN.md §Phase 1.
--
-- Root cause: Postgres grants EXECUTE to PUBLIC by default, and PostgREST exposes
-- every public-schema function as /rest/v1/rpc/<name>. Several SECURITY DEFINER
-- helpers that are only meant to run *inside* triggers / other definer functions /
-- RLS policies were left callable directly with the anon key.
--
-- This migration ONLY changes grants — no function body is touched. A SECURITY
-- DEFINER function runs as its OWNER, and EXECUTE is checked against the OWNER
-- when the function is called from inside another definer function or a trigger.
-- So revoking EXECUTE from public/anon/authenticated does NOT break internal
-- (owner-context) callers. It DOES break a function that is called directly in an
-- RLS policy expression, because policy predicates are evaluated as the querying
-- role (authenticated) and the EXECUTE check is against that role — verified on a
-- real Postgres instance. That distinction is why the L1 helpers below keep their
-- `authenticated` grant (their policies call them as authenticated) and only lose
-- the blanket PUBLIC + anon exposure.
--
-- Every statement is a REVOKE, which is idempotent: revoking a privilege that is
-- not held is a no-op and never errors, so this file is safe to re-run.

-- =============================================================================
-- H1 — redeem_invitations_for(uuid, text)  [High: anon project takeover]
-- =============================================================================
-- Consumes any pending invitation for an email into a membership for p_user_id.
-- Callable by anon, an attacker could redeem someone else's invite into their own
-- account. It is NOT used by any RLS policy. Its only callers are:
--   • redeem_my_invitations()          — SECURITY DEFINER RPC (the client uses THIS)
--   • handle_invitations_on_signup()   — SECURITY DEFINER trigger on auth.users
-- Both run as the owner, which keeps EXECUTE, so the revoke does not break them.
revoke all on function public.redeem_invitations_for(uuid, text) from public, anon, authenticated;

-- =============================================================================
-- H2 — notify(uuid, uuid, text, jsonb)  [Medium-High: forged notifications/email]
-- =============================================================================
-- Inserts into notifications (a table with no INSERT policy — trigger-only writes).
-- Callable by anon, any caller could forge a notification for any user id with an
-- attacker-controlled payload, which the reminder cron then emails to the victim.
-- It is NOT used by any RLS policy. Its only callers are the three SECURITY DEFINER
-- notification triggers (comment reply / mention / share) in
-- 20260622160000_collaboration_pro.sql, all owner-context, so the revoke is safe.
revoke all on function public.notify(uuid, uuid, text, jsonb) from public, anon, authenticated;

-- =============================================================================
-- L1 — pro-status / id "oracle" helpers  [Low: authed info leak]
-- =============================================================================
-- These SECURITY DEFINER helpers answer a boolean/id for ANY row id with no
-- caller-access check. They are used INSIDE `to authenticated` RLS policies
-- (canvas_notes / comment_mentions / reactions), which evaluate as the querying
-- authenticated user — so they MUST keep their `authenticated` EXECUTE grant or
-- the policies fail with 42501 "permission denied for function" (verified on a
-- real Postgres). We therefore only strip the blanket PUBLIC default grant and
-- the anon grant: anon never evaluates these `to authenticated` policies and the
-- client never calls these four directly, so removing anon/PUBLIC closes the
-- unauthenticated /rpc/ oracle without breaking policy evaluation.
--
-- NOTE (residual): an authenticated user can still probe these via a direct /rpc/
-- call for an arbitrary id. Fully closing that (a Low-severity leak) needs a
-- caller-access guard in the function BODY, which is deliberately out of scope for
-- this grants-only change — track it as a follow-up if desired.
--
-- KEPT AS-IS: project_is_pro(uuid) is called directly from the client
--   (src/features/collaboration/useProjectIsPro.ts → supabase.rpc('project_is_pro'))
--   and inside Storage policies, so all its grants are left untouched.

revoke all on function public.user_is_pro(uuid)             from public, anon;
revoke all on function public.comment_project_id(uuid)      from public, anon;
revoke all on function public.comment_author_id(uuid)       from public, anon;
revoke all on function public.target_project_id(text, uuid) from public, anon;
