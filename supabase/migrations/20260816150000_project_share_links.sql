-- Aurora — public read-only project share links.
--
-- Lets a project owner generate an unguessable, revocable link that renders a
-- stripped-down, read-only view of the board to anyone who has the URL — no
-- Aurora account required. Same shape as the calendar subscribe feed
-- (20260813020000_calendar_feed_token.sql): a random, unguessable token that
-- identifies WHAT to serve, checked server-side, never trusted from the
-- client. Two differences from that precedent, both deliberate:
--   (1) The token lives in its own table (`project_share_links`), not a column
--       on an existing row, because a *project* (unlike a user's profile) can
--       reasonably have this turned on/off/rotated by re-creating without
--       needing a dedicated "protect this column" trigger — ownership of the
--       whole row already gates every write (see RLS below).
--   (2) Create/revoke go through plain RLS-gated table writes, not an Edge
--       Function — there's no cross-user column-protection problem here (only
--       the owner can ever write a row for their own project), so the
--       `is_project_owner()` SECURITY DEFINER helper (already used by the
--       project_members policies) is reused directly as the RLS gate, exactly
--       the way `is_project_member()` gates columns/cards. The PUBLIC read
--       path (serving board data by token, no session) is still a dedicated
--       Edge Function — see `supabase/functions/project-share/index.ts` — for
--       the same reason `calendar-feed` is: it needs to run unauthenticated,
--       service-role, with its own rate limiting, and must never go through a
--       client-callable RPC that a signed-in session could otherwise reach.

-- 1. Table --------------------------------------------------------------------
create table if not exists public.project_share_links (
  id         uuid        primary key default gen_random_uuid(),
  project_id uuid        not null references public.projects (id) on delete cascade,
  -- Unguessable, unique, DB-generated — the client never invents or sees a
  -- token it didn't just create. Never rotated in place; revoke + create again
  -- issues a fresh one.
  token      uuid        not null default gen_random_uuid() unique,
  created_by uuid        not null references auth.users (id) on delete cascade default auth.uid(),
  revoked_at timestamptz null,
  created_at timestamptz not null default now()
);

comment on table public.project_share_links is
  'Public read-only board share links (token-scoped, unauthenticated read). Only the project owner may create/revoke; the token is never exposed except to the owner (RLS) — see 20260816150000_project_share_links.sql.';

-- At most one ACTIVE (non-revoked) link per project — creating a new one when
-- an active one already exists is a conflict at the DB level, not just a UI
-- convention, so a race between two tabs can't produce two live links.
create unique index if not exists project_share_links_active_project_idx
  on public.project_share_links (project_id)
  where revoked_at is null;

create index if not exists project_share_links_project_id_idx
  on public.project_share_links (project_id);

-- 2. Immutability trigger -------------------------------------------------------
-- Once created, only `revoked_at` may ever change (revoke). Prevents an owner
-- from silently repointing a previously-shared URL at a different project or
-- swapping in a chosen token — the only way to change what a link serves is to
-- revoke it and create a fresh one, so a previously-distributed URL either
-- keeps working exactly as it did or stops working, never quietly changes.
create or replace function public.protect_project_share_link_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.project_id is distinct from old.project_id
    or new.token is distinct from old.token
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Only revoking (revoked_at) is allowed on an existing share link.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_project_share_link_fields on public.project_share_links;
create trigger protect_project_share_link_fields
  before update on public.project_share_links
  for each row
  execute function public.protect_project_share_link_fields();

-- 3. Row Level Security ---------------------------------------------------------
-- Owner-only, full stop — reuses is_project_owner() (20260618120000_projects.sql)
-- exactly the way is_project_member() gates columns/cards, so this stays a flat,
-- non-recursive policy. No SELECT/INSERT/UPDATE policy for non-owners: a fellow
-- editor/viewer member of the project cannot see, create, or revoke a share
-- link, and the token is therefore never exposed to anyone but the owner
-- through the authenticated app — the ONLY other place it is ever read back is
-- the public `project-share` Edge Function, which looks it up with the service
-- role (bypassing RLS entirely, same as calendar-feed).
alter table public.project_share_links enable row level security;

drop policy if exists "Project share links: select if owner" on public.project_share_links;
create policy "Project share links: select if owner"
  on public.project_share_links
  for select
  to authenticated
  using (public.is_project_owner(project_id));

drop policy if exists "Project share links: insert if owner" on public.project_share_links;
create policy "Project share links: insert if owner"
  on public.project_share_links
  for insert
  to authenticated
  with check (public.is_project_owner(project_id) and created_by = auth.uid());

drop policy if exists "Project share links: revoke if owner" on public.project_share_links;
create policy "Project share links: revoke if owner"
  on public.project_share_links
  for update
  to authenticated
  using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));

-- No delete policy: revoke (UPDATE revoked_at) is the only teardown path, so a
-- link's row — and its audit trail (who created it, when, when it was revoked)
-- — is never removable, only deactivated.
