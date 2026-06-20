-- Migration: collaboration — invitations, roles, realtime (Phase 8)
-- See plan.md §5 (data model) and §6 (security model).
--
-- This phase turns the app multi-user. It (1) lets a project owner invite people
-- by email and resolves those invitations into project_members rows, (2) makes
-- the previously membership-only write access ROLE-AWARE — owners/editors may
-- modify content, viewers are read-only — enforced in RLS (not just the UI), and
-- (3) opts the project's content tables into Supabase Realtime so members see
-- each other's changes live. The frontend stays untrusted; these database rules
-- are the real guarantee.

-- 1. Invitations -------------------------------------------------------------
-- An invitation is keyed by EMAIL, because the invitee may not have an account
-- yet. When they sign up (or, if already registered, the next time the app calls
-- redeem_my_invitations()), the invitation is consumed into a project_members
-- row with the stored role. Only 'editor'/'viewer' are invitable — 'owner' is
-- the project creator alone (projects.owner_id) and is never handed out here.
create table if not exists public.invitations (
  id         uuid        primary key default gen_random_uuid(),
  project_id uuid        not null references public.projects (id) on delete cascade,
  email      text        not null check (char_length(email) between 3 and 255 and position('@' in email) > 1),
  role       text        not null default 'editor' check (role in ('editor', 'viewer')),
  invited_by uuid                 references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.invitations is 'Pending project invitations keyed by email; consumed into project_members on signup/accept (plan.md §5–6).';

-- One pending invitation per (project, email), case-insensitive — re-inviting the
-- same address just updates the existing row's role (see api.ts upsert).
create unique index if not exists invitations_project_email_key
  on public.invitations (project_id, lower(email));

-- Redemption looks invitations up by the invitee's (lower-cased) email.
create index if not exists invitations_email_idx on public.invitations (lower(email));

-- 2. Role helpers ------------------------------------------------------------
-- can_edit_project(): the current user may MODIFY this project's content (owner
-- or editor). Viewers fail this, so their writes are rejected by RLS. Same
-- SECURITY DEFINER hardening as the Phase 3 helpers (search_path pinned, every
-- reference schema-qualified) so the policy never re-enters project_members RLS.
create or replace function public.can_edit_project(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.project_members m
    where m.project_id = p_project_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'editor')
  );
$$;

comment on function public.can_edit_project(uuid) is
  'SECURITY DEFINER: may the current user modify this project (owner/editor)? Used by content write RLS (plan.md §6).';

-- can_edit_card(): the edit equivalent of can_access_card — resolve the card's
-- project once, then require edit rights. Used by the card-child write policies
-- (checklist_items, card_labels) so they stay flat and never sub-query cards.
create or replace function public.can_edit_card(p_card_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.cards c
    where c.id = p_card_id
      and public.can_edit_project(c.project_id)
  );
$$;

comment on function public.can_edit_card(uuid) is
  'SECURITY DEFINER: may the current user modify this card''s project? Used by checklist_items/card_labels write RLS (plan.md §6).';

-- shares_a_project_with(): do the current user and another user co-belong to any
-- project? Lets a member read co-members' profiles (names + avatars) for the
-- members panel — without this, profiles RLS is own-row only and the panel would
-- show ids. Wrapped in a definer fn so the profiles policy doesn't re-enter
-- project_members RLS.
create or replace function public.shares_a_project_with(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.project_members me
    join public.project_members them on them.project_id = me.project_id
    where me.user_id = auth.uid()
      and them.user_id = p_user_id
  );
$$;

comment on function public.shares_a_project_with(uuid) is
  'SECURITY DEFINER: does the current user co-belong to any project with this user? Lets members read co-members'' profiles (plan.md §6).';

-- 3. Invitation redemption ---------------------------------------------------
-- Resolve every pending invitation for (p_user_id, p_email) into a membership,
-- then consume the invitation. DELETE…RETURNING feeds the INSERT in one
-- statement (an atomic "move"); ON CONFLICT DO NOTHING means an already-member is
-- left untouched (no role downgrade) while the invitation is still cleared.
-- SECURITY DEFINER so it writes project_members regardless of the invitee's
-- (not-yet-a-member) RLS. Returns the number of NEW memberships created.
create or replace function public.redeem_invitations_for(p_user_id uuid, p_email text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_email is null or p_user_id is null then
    return 0;
  end if;

  with moved as (
    delete from public.invitations i
    where lower(i.email) = lower(p_email)
    returning i.project_id, i.role
  ),
  added as (
    insert into public.project_members (project_id, user_id, role)
    select m.project_id, p_user_id, m.role
    from moved m
    on conflict (project_id, user_id) do nothing
    returning 1
  )
  select count(*)::integer into v_count from added;

  return coalesce(v_count, 0);
end;
$$;

comment on function public.redeem_invitations_for(uuid, text) is
  'SECURITY DEFINER: consume pending invitations for a user/email into memberships. Returns count of new memberships.';

-- Redeem the CURRENT user's invitations (matched on their auth email). Called by
-- the client on app load so already-registered invitees join without re-signup.
create or replace function public.redeem_my_invitations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = auth.uid();
  return public.redeem_invitations_for(auth.uid(), v_email);
end;
$$;

comment on function public.redeem_my_invitations() is
  'SECURITY DEFINER RPC: redeem the calling user''s pending invitations into memberships.';

grant execute on function public.redeem_my_invitations() to authenticated;

-- Auto-redeem at sign-up: a brand-new user instantly joins any project they were
-- invited to, so they land on it the first time they log in. A second AFTER
-- INSERT trigger on auth.users alongside handle_new_user(); both are independent
-- and SECURITY DEFINER, so firing order is irrelevant.
create or replace function public.handle_invitations_on_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.redeem_invitations_for(new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_redeem_invitations on auth.users;
create trigger on_auth_user_redeem_invitations
  after insert on auth.users
  for each row execute function public.handle_invitations_on_signup();

-- 4. Protect the owner's membership ------------------------------------------
-- The owner's project_members row (role 'owner') is what grants the creator board
-- access, so it must never be removed or demoted, and 'owner' must never be
-- granted to anyone else (ownership = projects.owner_id, transfer is out of
-- scope). This guards both direct API calls and the new owner-managed role
-- updates. SECURITY DEFINER so it can read projects.owner_id under any caller.
create or replace function public.protect_project_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select p.owner_id into v_owner
  from public.projects p
  where p.id = coalesce(new.project_id, old.project_id);

  -- Project gone → this is a cascade delete of the whole project; allow it.
  if v_owner is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if old.user_id = v_owner then
      raise exception 'The project owner''s membership cannot be removed.';
    end if;
    return old;
  end if;

  -- INSERT / UPDATE
  if new.user_id = v_owner and new.role <> 'owner' then
    raise exception 'The project owner must keep the owner role.';
  end if;
  if new.role = 'owner' and new.user_id <> v_owner then
    raise exception 'Only the project owner may hold the owner role.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_owner_membership on public.project_members;
create trigger protect_owner_membership
  before insert or update or delete on public.project_members
  for each row execute function public.protect_project_owner_membership();

-- 5. Row Level Security ------------------------------------------------------

-- profiles: let members read co-members' profiles (for avatars/names in the
-- members panel + presence). Additive — the existing own-row select policy
-- still applies; permissive policies are OR'd together.
drop policy if exists "Profiles: select co-members" on public.profiles;
create policy "Profiles: select co-members"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id or public.shares_a_project_with(id));

-- invitations -----------------------------------------------------------------
alter table public.invitations enable row level security;

-- A member sees their project's pending invites (panel); an invitee sees invites
-- addressed to their own email (so a future "you've been invited" view works).
drop policy if exists "Invitations: select if member or invitee" on public.invitations;
create policy "Invitations: select if member or invitee"
  on public.invitations
  for select
  to authenticated
  using (
    public.is_project_member(project_id)
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- Only the owner may invite / change a pending invite's role / revoke it.
drop policy if exists "Invitations: insert by owner" on public.invitations;
create policy "Invitations: insert by owner"
  on public.invitations
  for insert
  to authenticated
  with check (public.is_project_owner(project_id) and invited_by = auth.uid());

drop policy if exists "Invitations: update by owner" on public.invitations;
create policy "Invitations: update by owner"
  on public.invitations
  for update
  to authenticated
  using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));

drop policy if exists "Invitations: delete by owner" on public.invitations;
create policy "Invitations: delete by owner"
  on public.invitations
  for delete
  to authenticated
  using (public.is_project_owner(project_id));

-- project_members: owners may now change a member's role (editor ↔ viewer). The
-- owner-row protection trigger above prevents demoting/removing the owner or
-- granting 'owner'. (insert/delete owner-only policies already exist; select too.)
drop policy if exists "Members: update role by owner" on public.project_members;
create policy "Members: update role by owner"
  on public.project_members
  for update
  to authenticated
  using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));

-- 6. Make content writes role-aware ------------------------------------------
-- SELECT stays membership-gated (viewers can read everything). INSERT/UPDATE/
-- DELETE now require edit rights (owner/editor) via can_edit_project / can_edit_
-- card. This is the only change to the Phase 4–7 content RLS: read = member,
-- write = editor+. Recreate just the write policies on each table.

-- columns ---------------------------------------------------------------------
drop policy if exists "Columns: insert if member" on public.columns;
create policy "Columns: insert if editor"
  on public.columns for insert to authenticated
  with check (public.can_edit_project(project_id));

drop policy if exists "Columns: update if member" on public.columns;
create policy "Columns: update if editor"
  on public.columns for update to authenticated
  using (public.can_edit_project(project_id))
  with check (public.can_edit_project(project_id));

drop policy if exists "Columns: delete if member" on public.columns;
create policy "Columns: delete if editor"
  on public.columns for delete to authenticated
  using (public.can_edit_project(project_id));

-- cards -----------------------------------------------------------------------
drop policy if exists "Cards: insert if member" on public.cards;
create policy "Cards: insert if editor"
  on public.cards for insert to authenticated
  with check (public.can_edit_project(project_id));

drop policy if exists "Cards: update if member" on public.cards;
create policy "Cards: update if editor"
  on public.cards for update to authenticated
  using (public.can_edit_project(project_id))
  with check (public.can_edit_project(project_id));

drop policy if exists "Cards: delete if member" on public.cards;
create policy "Cards: delete if editor"
  on public.cards for delete to authenticated
  using (public.can_edit_project(project_id));

-- checklist_items -------------------------------------------------------------
drop policy if exists "Checklist: insert if member" on public.checklist_items;
create policy "Checklist: insert if editor"
  on public.checklist_items for insert to authenticated
  with check (public.can_edit_card(card_id));

drop policy if exists "Checklist: update if member" on public.checklist_items;
create policy "Checklist: update if editor"
  on public.checklist_items for update to authenticated
  using (public.can_edit_card(card_id))
  with check (public.can_edit_card(card_id));

drop policy if exists "Checklist: delete if member" on public.checklist_items;
create policy "Checklist: delete if editor"
  on public.checklist_items for delete to authenticated
  using (public.can_edit_card(card_id));

-- labels ----------------------------------------------------------------------
drop policy if exists "Labels: insert if member" on public.labels;
create policy "Labels: insert if editor"
  on public.labels for insert to authenticated
  with check (public.can_edit_project(project_id));

drop policy if exists "Labels: update if member" on public.labels;
create policy "Labels: update if editor"
  on public.labels for update to authenticated
  using (public.can_edit_project(project_id))
  with check (public.can_edit_project(project_id));

drop policy if exists "Labels: delete if member" on public.labels;
create policy "Labels: delete if editor"
  on public.labels for delete to authenticated
  using (public.can_edit_project(project_id));

-- card_labels -----------------------------------------------------------------
drop policy if exists "Card labels: insert if member" on public.card_labels;
create policy "Card labels: insert if editor"
  on public.card_labels for insert to authenticated
  with check (public.can_edit_card(card_id));

drop policy if exists "Card labels: delete if member" on public.card_labels;
create policy "Card labels: delete if editor"
  on public.card_labels for delete to authenticated
  using (public.can_edit_card(card_id));

-- notes -----------------------------------------------------------------------
drop policy if exists "Notes: insert if member" on public.notes;
create policy "Notes: insert if editor"
  on public.notes for insert to authenticated
  with check (public.can_edit_project(project_id));

drop policy if exists "Notes: update if member" on public.notes;
create policy "Notes: update if editor"
  on public.notes for update to authenticated
  using (public.can_edit_project(project_id))
  with check (public.can_edit_project(project_id));

drop policy if exists "Notes: delete if member" on public.notes;
create policy "Notes: delete if editor"
  on public.notes for delete to authenticated
  using (public.can_edit_project(project_id));

-- 7. Realtime ----------------------------------------------------------------
-- Opt the project's content tables (plus project_members, so role changes /
-- removals stream live) into the supabase_realtime publication. Realtime applies
-- the same RLS as a normal read, so a member only receives changes for rows they
-- may SELECT — changes never leak across projects. REPLICA IDENTITY FULL puts the
-- whole old row in DELETE/UPDATE events so the client's project_id filters match
-- on deletes too. Guarded + idempotent so re-running the migration is safe.
alter table public.columns         replica identity full;
alter table public.cards           replica identity full;
alter table public.checklist_items replica identity full;
alter table public.labels          replica identity full;
alter table public.card_labels     replica identity full;
alter table public.notes           replica identity full;
alter table public.project_members replica identity full;

do $$
declare
  t text;
  tables text[] := array[
    'columns', 'cards', 'checklist_items', 'labels', 'card_labels', 'notes', 'project_members'
  ];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime publication not found; skipping realtime opt-in.';
    return;
  end if;

  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
