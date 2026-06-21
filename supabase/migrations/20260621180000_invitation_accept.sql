-- Migration: invitations require explicit accept/decline (no more auto-join).
--
-- Phase 8 auto-joined invitees (a signup trigger + an on-load redeem RPC). Per
-- product change: an invite now stays PENDING until the person accepts it, they
-- can decline it, and any member can leave a project. See plan.md §5-6.

-- 1. Stop auto-joining: drop the signup trigger so a brand-new user is no longer
--    auto-redeemed. (redeem_invitations_for / redeem_my_invitations stay defined
--    but are no longer called by the app.)
drop trigger if exists on_auth_user_redeem_invitations on auth.users;
drop function if exists public.handle_invitations_on_signup();

-- 2. List the caller's own pending invitations, with the project name. The
--    invitee isn't a member yet, so projects RLS would hide the name — resolve it
--    in a SECURITY DEFINER function instead. Read-only; matched on the caller's
--    email on file.
create or replace function public.my_pending_invitations()
returns table (
  id uuid,
  project_id uuid,
  project_name text,
  role text,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select i.id, i.project_id, p.name, i.role, i.created_at
  from public.invitations i
  join public.projects p on p.id = i.project_id
  where lower(i.email) = lower((select u.email from auth.users u where u.id = auth.uid()))
  order by i.created_at desc;
$$;

grant execute on function public.my_pending_invitations() to authenticated;

-- 3. Accept one invitation addressed to the caller: create the membership, then
--    consume the invite. SECURITY DEFINER so it can insert project_members for a
--    not-yet-member. Returns the project id (the UI navigates there).
create or replace function public.accept_invitation(p_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email   text;
  v_project uuid;
  v_role    text;
begin
  select email into v_email from auth.users where id = auth.uid();

  select i.project_id, i.role into v_project, v_role
  from public.invitations i
  where i.id = p_invitation_id
    and lower(i.email) = lower(coalesce(v_email, ''));

  if v_project is null then
    raise exception 'Invitation not found or not addressed to you.';
  end if;

  insert into public.project_members (project_id, user_id, role)
  values (v_project, auth.uid(), v_role)
  on conflict (project_id, user_id) do nothing;

  delete from public.invitations where id = p_invitation_id;
  return v_project;
end;
$$;

grant execute on function public.accept_invitation(uuid) to authenticated;

-- 4. Let the invitee DECLINE (delete) an invite addressed to their email.
--    Additive to the existing owner-only delete policy (permissive policies OR).
drop policy if exists "Invitations: decline by invitee" on public.invitations;
create policy "Invitations: decline by invitee"
  on public.invitations for delete to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- 5. Let a member LEAVE a project (delete their own membership row). The owner
--    can't leave — protect_project_owner_membership still blocks deleting the
--    owner row (ownership transfer is out of scope), so they're excluded in
--    practice. Additive to the existing owner-only delete policy.
drop policy if exists "Members: leave project" on public.project_members;
create policy "Members: leave project"
  on public.project_members for delete to authenticated
  using (user_id = auth.uid());
