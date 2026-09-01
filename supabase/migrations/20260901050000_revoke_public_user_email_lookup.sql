-- Security: prevent unauthenticated user-ID enumeration through the email lookup helper.
-- Sharing RPCs call this helper in SECURITY DEFINER owner context; direct callers
-- must be signed in.
revoke all on function public.user_id_for_email(text) from public, anon;
grant execute on function public.user_id_for_email(text) to authenticated;