-- Migration: collaboration_pro — comments, mentions, reactions, review, activity, notifications (Pro)
-- See plan.md §5 (data model) and §6 (security).
--
-- This is the Pro collaboration layer. Every feature here is BOTH Pro-gated and
-- realtime. Pro-gating follows the same two-layer rule as the rest of Pro
-- (prompts.md → "The Pro-gating principle"): the UI is UX only; the DATABASE is
-- the real gate. project_is_pro(board owner's plan) decides who may CREATE
-- comments/reactions, so a free board is blocked even via the raw API.
--
-- What it adds:
--   1. comments          — threaded discussion on a card (canvas later), Pro to post.
--   2. comment_mentions   — @mentions resolved by the client; a trigger notifies.
--   3. reactions          — emoji on a comment or a card.
--   4. cards.review_*     — a request-review / approve / request-changes flow.
--   5. activity_log       — append-only project feed, written ONLY by triggers.
--   6. notifications      — own-row inbox; the Topbar bell. Written ONLY by triggers.
--   7. realtime           — the streamed tables join supabase_realtime (REPLICA
--                           IDENTITY FULL), exactly like Phase 8.
--   8. email RPCs         — service-role-only, so the existing reminders cron can
--                           email unseen notifications (reuses the Resend path).
--
-- Hardening mirrors the existing helpers (is_project_member / project_is_pro):
-- every helper is `security definer`, `set search_path = ''`, fully schema-
-- qualified, so policies call a flat function instead of sub-querying (no RLS
-- re-entry). This migration does NOT touch or weaken any existing policy.

-- =============================================================================
-- 1. comments
-- =============================================================================
-- A comment targets EXACTLY ONE of a card or a canvas note (canvas notes arrive
-- in Pro P3 — the column is a plain uuid now, no FK to a table that doesn't yet
-- exist; the app only uses card_id today). project_id is denormalised onto the
-- row so RLS is a flat is_project_member(project_id) with no join; a BEFORE
-- INSERT trigger derives it from the card so the client can't desync it. Threads
-- are a self-FK (parent_id); a reply notifies the parent's author (trigger §6).
create table if not exists public.comments (
  id             uuid        primary key default gen_random_uuid(),
  project_id     uuid        not null references public.projects (id) on delete cascade,
  card_id        uuid                 references public.cards (id) on delete cascade,
  canvas_note_id uuid,  -- FK added with canvas_notes in Pro P3; nullable until then.
  author_id      uuid        not null references auth.users (id) on delete cascade,
  body           text        not null check (char_length(body) between 1 and 5000),
  parent_id      uuid                 references public.comments (id) on delete cascade,
  created_at     timestamptz not null default now(),
  edited_at      timestamptz,
  -- Exactly one target is set.
  constraint comments_one_target check (
    (card_id is not null and canvas_note_id is null)
    or (card_id is null and canvas_note_id is not null)
  )
);

comment on table public.comments is
  'Threaded discussion on a card/canvas note. Pro-gated INSERT (plan.md §5–6).';

create index if not exists comments_card_id_idx   on public.comments (card_id);
create index if not exists comments_project_id_idx on public.comments (project_id);
create index if not exists comments_parent_id_idx  on public.comments (parent_id);

-- Derive/validate project_id from the target card so a member of project A can't
-- attach a comment (project_id = A) to a card in project B. Runs SECURITY DEFINER
-- so the card lookup is independent of the caller's RLS.
create or replace function public.comments_set_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.card_id is not null then
    select c.project_id into new.project_id from public.cards c where c.id = new.card_id;
  end if;
  return new;
end;
$$;

drop trigger if exists comments_set_project on public.comments;
create trigger comments_set_project
  before insert on public.comments
  for each row execute function public.comments_set_project();

-- comment_project_id / comment_author_id: flat resolvers for the policies on
-- comment_mentions + reactions (avoid re-entering comments RLS in a subquery).
create or replace function public.comment_project_id(p_comment_id uuid)
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select c.project_id from public.comments c where c.id = p_comment_id;
$$;

create or replace function public.comment_author_id(p_comment_id uuid)
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select c.author_id from public.comments c where c.id = p_comment_id;
$$;

grant execute on function public.comment_project_id(uuid) to authenticated;
grant execute on function public.comment_author_id(uuid)  to authenticated;

alter table public.comments enable row level security;

-- SELECT: any member of the comment's project may read it.
drop policy if exists "Comments: select if member" on public.comments;
create policy "Comments: select if member"
  on public.comments for select to authenticated
  using (public.is_project_member(project_id));

-- INSERT: a member may post their OWN comment on a Pro board. Membership + Pro
-- are resolved from the TARGET CARD (can_access_card / card_project_is_pro), not
-- the client-supplied project_id — so a spoofed project_id can't slip a comment
-- past the gate regardless of trigger/RLS evaluation order. This is the real Pro
-- gate: a free board is rejected here even via the raw API. (The canvas-note
-- branch is added with canvas_notes in Pro P3; today every comment has a card.)
drop policy if exists "Comments: insert if pro member" on public.comments;
create policy "Comments: insert if pro member"
  on public.comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and card_id is not null
    and public.can_access_card(card_id)
    and public.card_project_is_pro(card_id)
  );

-- UPDATE / DELETE: the author may edit/delete their own comment; owners/editors
-- may moderate any. We do NOT re-require Pro (mirrors card_reminders: cleanup
-- survives a lapsed plan; only creating needs Pro).
drop policy if exists "Comments: update if author or editor" on public.comments;
create policy "Comments: update if author or editor"
  on public.comments for update to authenticated
  using (author_id = auth.uid() or public.can_edit_project(project_id))
  with check (author_id = auth.uid() or public.can_edit_project(project_id));

drop policy if exists "Comments: delete if author or editor" on public.comments;
create policy "Comments: delete if author or editor"
  on public.comments for delete to authenticated
  using (author_id = auth.uid() or public.can_edit_project(project_id));

-- =============================================================================
-- 2. comment_mentions
-- =============================================================================
-- @mentions resolved client-side from the project roster (the composer knows the
-- members), inserted alongside the comment. An AFTER INSERT trigger turns each
-- into a notification (§6). Read = member of the comment's project; insert =
-- only the comment's own author may attach mentions to it.
create table if not exists public.comment_mentions (
  comment_id        uuid not null references public.comments (id) on delete cascade,
  mentioned_user_id uuid not null references auth.users (id) on delete cascade,
  primary key (comment_id, mentioned_user_id)
);

comment on table public.comment_mentions is
  'Users @mentioned in a comment; an AFTER INSERT trigger notifies each (plan.md §5).';

alter table public.comment_mentions enable row level security;

drop policy if exists "Mentions: select if member" on public.comment_mentions;
create policy "Mentions: select if member"
  on public.comment_mentions for select to authenticated
  using (public.is_project_member(public.comment_project_id(comment_id)));

drop policy if exists "Mentions: insert if comment author" on public.comment_mentions;
create policy "Mentions: insert if comment author"
  on public.comment_mentions for insert to authenticated
  with check (public.comment_author_id(comment_id) = auth.uid());

drop policy if exists "Mentions: delete if comment author" on public.comment_mentions;
create policy "Mentions: delete if comment author"
  on public.comment_mentions for delete to authenticated
  using (public.comment_author_id(comment_id) = auth.uid());

-- =============================================================================
-- 3. reactions
-- =============================================================================
-- Emoji reactions on a comment or a card. Polymorphic (target_type, target_id);
-- one row per (target, user, emoji). target_project_id() resolves the target to
-- a project so the policies stay flat and member/Pro-gated.
create table if not exists public.reactions (
  id          uuid        primary key default gen_random_uuid(),
  target_type text        not null check (target_type in ('comment', 'card')),
  target_id   uuid        not null,
  user_id     uuid        not null references auth.users (id) on delete cascade,
  emoji       text        not null check (char_length(emoji) between 1 and 16),
  created_at  timestamptz not null default now(),
  unique (target_type, target_id, user_id, emoji)
);

comment on table public.reactions is
  'Emoji reactions on a comment or card; Pro-gated INSERT (plan.md §5).';

create index if not exists reactions_target_idx on public.reactions (target_type, target_id);

-- Resolve a reaction target → its project id. comment → comments.project_id;
-- card → cards.project_id. SECURITY DEFINER so the lookup bypasses RLS.
create or replace function public.target_project_id(p_target_type text, p_target_id uuid)
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select case p_target_type
    when 'comment' then (select c.project_id from public.comments c where c.id = p_target_id)
    when 'card'    then (select c.project_id from public.cards    c where c.id = p_target_id)
    else null
  end;
$$;

grant execute on function public.target_project_id(text, uuid) to authenticated;

alter table public.reactions enable row level security;

-- SELECT: any member of the target's project.
drop policy if exists "Reactions: select if member" on public.reactions;
create policy "Reactions: select if member"
  on public.reactions for select to authenticated
  using (public.is_project_member(public.target_project_id(target_type, target_id)));

-- INSERT: your own reaction, on a Pro board you belong to.
drop policy if exists "Reactions: insert if pro member" on public.reactions;
create policy "Reactions: insert if pro member"
  on public.reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_project_member(public.target_project_id(target_type, target_id))
    and public.project_is_pro(public.target_project_id(target_type, target_id))
  );

-- DELETE: remove your own reaction (un-react). No Pro re-check on cleanup.
drop policy if exists "Reactions: delete own" on public.reactions;
create policy "Reactions: delete own"
  on public.reactions for delete to authenticated
  using (user_id = auth.uid());

-- =============================================================================
-- 4. cards review flow
-- =============================================================================
-- A lightweight review state machine on the card itself: none → in_review
-- (request, picks a reviewer) → approved | changes_requested. Writes go through
-- the EXISTING cards UPDATE policy (owner/editor), so no new write policy is
-- needed; a trigger (§6) logs activity + notifies on each transition.
alter table public.cards
  add column if not exists review_status text not null default 'none'
    check (review_status in ('none', 'in_review', 'approved', 'changes_requested')),
  add column if not exists review_assignee_id uuid references auth.users (id) on delete set null,
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null,
  add column if not exists reviewed_at timestamptz;

-- =============================================================================
-- 5. activity_log
-- =============================================================================
-- Append-only project feed. Read = member; there is intentionally NO insert
-- policy, so authenticated clients can never write it — only the SECURITY
-- DEFINER triggers below (which run as the function owner and bypass RLS) do.
create table if not exists public.activity_log (
  id          uuid        primary key default gen_random_uuid(),
  project_id  uuid        not null references public.projects (id) on delete cascade,
  actor_id    uuid                 references auth.users (id) on delete set null,
  verb        text        not null,
  target_type text        not null,
  target_id   uuid,
  meta        jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

comment on table public.activity_log is
  'Append-only project activity; written ONLY by SECURITY DEFINER triggers (plan.md §5–6).';

create index if not exists activity_log_project_idx on public.activity_log (project_id, created_at desc);
create index if not exists activity_log_card_idx
  on public.activity_log ((meta ->> 'card_id'));

alter table public.activity_log enable row level security;

drop policy if exists "Activity: select if member" on public.activity_log;
create policy "Activity: select if member"
  on public.activity_log for select to authenticated
  using (public.is_project_member(project_id));

-- =============================================================================
-- 6. notifications
-- =============================================================================
-- Own-row inbox powering the Topbar bell. Read/update your own rows (update only
-- ever flips read_at). NO insert policy → only the trigger functions create them.
-- payload carries everything the dropdown AND the email need (project/card name,
-- actor name, snippet) so neither has to re-join. emailed_at dedupes the email
-- pass (§8).
create table if not exists public.notifications (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  kind       text        not null check (kind in (
                 'mention', 'reply', 'review_request', 'review_approved', 'review_changes')),
  payload    jsonb       not null default '{}'::jsonb,
  read_at    timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.notifications is
  'Own-row notification inbox (the Topbar bell); written ONLY by triggers (plan.md §5–6).';

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "Notifications: select own" on public.notifications;
create policy "Notifications: select own"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

-- Update only your own rows (used to mark read). with_check keeps user_id pinned.
drop policy if exists "Notifications: update own" on public.notifications;
create policy "Notifications: update own"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- A small constructor the triggers share: insert a notification unless the
-- recipient is the actor (don't notify yourself). SECURITY DEFINER → bypasses the
-- (insert-policy-less) notifications RLS.
create or replace function public.notify(
  p_user_id uuid, p_actor_id uuid, p_kind text, p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or p_user_id = p_actor_id then
    return;
  end if;
  insert into public.notifications (user_id, kind, payload)
  values (p_user_id, p_kind, coalesce(p_payload, '{}'::jsonb));
end;
$$;

-- ---- Triggers that write activity_log + notifications ----------------------

-- comments AFTER INSERT: log "commented" + (for a reply) notify the parent's
-- author. Gathers the actor/card/project names into the activity meta + the
-- notification payload so the feed, dropdown, and email render without re-joins.
create or replace function public.comments_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_name text;
  v_card_title text;
  v_project    text;
  v_parent     uuid;
  v_snippet    text;
  v_payload    jsonb;
begin
  select pr.display_name into v_actor_name from public.profiles pr where pr.id = new.author_id;
  select c.title        into v_card_title from public.cards c     where c.id = new.card_id;
  select p.name         into v_project    from public.projects p  where p.id = new.project_id;
  v_snippet := left(new.body, 140);

  insert into public.activity_log (project_id, actor_id, verb, target_type, target_id, meta)
  values (
    new.project_id, new.author_id, 'commented', 'comment', new.id,
    jsonb_build_object(
      'card_id', new.card_id, 'comment_id', new.id,
      'actor_name', v_actor_name, 'card_title', v_card_title, 'snippet', v_snippet
    )
  );

  if new.parent_id is not null then
    select c.author_id into v_parent from public.comments c where c.id = new.parent_id;
    v_payload := jsonb_build_object(
      'comment_id', new.id, 'card_id', new.card_id, 'project_id', new.project_id,
      'actor_id', new.author_id, 'actor_name', v_actor_name,
      'card_title', v_card_title, 'project_name', v_project, 'snippet', v_snippet
    );
    perform public.notify(v_parent, new.author_id, 'reply', v_payload);
  end if;

  return new;
end;
$$;

drop trigger if exists comments_after_insert on public.comments;
create trigger comments_after_insert
  after insert on public.comments
  for each row execute function public.comments_after_insert();

-- comment_mentions AFTER INSERT: notify the mentioned user.
create or replace function public.comment_mentions_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author     uuid;
  v_card_id    uuid;
  v_project_id uuid;
  v_actor_name text;
  v_card_title text;
  v_project    text;
  v_snippet    text;
begin
  select c.author_id, c.card_id, c.project_id, left(c.body, 140)
    into v_author, v_card_id, v_project_id, v_snippet
    from public.comments c where c.id = new.comment_id;

  select pr.display_name into v_actor_name from public.profiles pr where pr.id = v_author;
  select c.title        into v_card_title from public.cards c     where c.id = v_card_id;
  select p.name         into v_project    from public.projects p  where p.id = v_project_id;

  perform public.notify(
    new.mentioned_user_id, v_author, 'mention',
    jsonb_build_object(
      'comment_id', new.comment_id, 'card_id', v_card_id, 'project_id', v_project_id,
      'actor_id', v_author, 'actor_name', v_actor_name,
      'card_title', v_card_title, 'project_name', v_project, 'snippet', v_snippet
    )
  );
  return new;
end;
$$;

drop trigger if exists comment_mentions_after_insert on public.comment_mentions;
create trigger comment_mentions_after_insert
  after insert on public.comment_mentions
  for each row execute function public.comment_mentions_after_insert();

-- cards AFTER UPDATE OF review_status: log the transition + notify. On a request
-- the reviewer is told; on approve/changes the card's assignee is told.
create or replace function public.cards_review_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor      uuid := auth.uid();
  v_actor_name text;
  v_project    text;
  v_verb       text;
  v_kind       text;
  v_recipient  uuid;
  v_payload    jsonb;
begin
  if new.review_status is not distinct from old.review_status then
    return new;
  end if;

  select pr.display_name into v_actor_name from public.profiles pr where pr.id = v_actor;
  select p.name         into v_project    from public.projects p  where p.id = new.project_id;

  if new.review_status = 'in_review' then
    v_verb := 'requested_review'; v_kind := 'review_request'; v_recipient := new.review_assignee_id;
  elsif new.review_status = 'approved' then
    v_verb := 'approved_review'; v_kind := 'review_approved'; v_recipient := new.assignee_id;
  elsif new.review_status = 'changes_requested' then
    v_verb := 'requested_changes'; v_kind := 'review_changes'; v_recipient := new.assignee_id;
  else
    -- back to 'none' (review cleared) — log only, nobody to notify.
    v_verb := 'cleared_review'; v_kind := null; v_recipient := null;
  end if;

  insert into public.activity_log (project_id, actor_id, verb, target_type, target_id, meta)
  values (
    new.project_id, v_actor, v_verb, 'card', new.id,
    jsonb_build_object('card_id', new.id, 'actor_name', v_actor_name, 'card_title', new.title)
  );

  if v_kind is not null then
    v_payload := jsonb_build_object(
      'card_id', new.id, 'project_id', new.project_id,
      'actor_id', v_actor, 'actor_name', v_actor_name,
      'card_title', new.title, 'project_name', v_project
    );
    perform public.notify(v_recipient, v_actor, v_kind, v_payload);
  end if;

  return new;
end;
$$;

drop trigger if exists cards_review_after_update on public.cards;
create trigger cards_review_after_update
  after update of review_status on public.cards
  for each row execute function public.cards_review_after_update();

-- =============================================================================
-- 7. Realtime
-- =============================================================================
-- Stream the new collaboration tables, like Phase 8. Realtime applies the same
-- RLS as a read, so a member only receives events for rows they may SELECT —
-- nothing leaks across projects. REPLICA IDENTITY FULL puts the whole old row in
-- DELETE/UPDATE events so client-side filters match on deletes too. notifications
-- streams so the bell updates live for its own user. Guarded + idempotent.
alter table public.comments         replica identity full;
alter table public.comment_mentions replica identity full;
alter table public.reactions        replica identity full;
alter table public.activity_log     replica identity full;
alter table public.notifications    replica identity full;

do $$
declare
  t text;
  tables text[] := array['comments', 'comment_mentions', 'reactions', 'activity_log', 'notifications'];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime publication not found; skipping realtime opt-in.';
    return;
  end if;

  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- =============================================================================
-- 8. Notification emails (service-role only — reuses the reminders cron/Resend)
-- =============================================================================
-- The existing send-due-reminders Edge Function gets a third pass that emails
-- recently-created, not-yet-emailed notifications, then marks them. No new
-- secret, no new schedule — same CRON_SECRET + RESEND_API_KEY, same 10-min cron.
-- These RPCs are service-role ONLY (the browser uses the notifications table
-- directly under own-row RLS), so revoke from every browser role.
create or replace function public.notification_email_candidates(p_max_age_minutes integer default 1440)
returns table (
  id           uuid,
  user_id      uuid,
  kind         text,
  payload      jsonb,
  email        text,
  display_name text
)
language sql
security definer
set search_path = ''
as $$
  select n.id, n.user_id, n.kind, n.payload, u.email, pr.display_name
  from public.notifications n
  join auth.users u       on u.id = n.user_id
  join public.profiles pr on pr.id = n.user_id
  where n.emailed_at is null
    and u.email is not null
    -- Respect the user's existing email opt-in (shared with due-date reminders).
    and pr.reminder_emails_enabled
    and n.created_at > now() - make_interval(mins => coalesce(p_max_age_minutes, 1440))
  order by n.created_at;
$$;

create or replace function public.mark_notifications_emailed(p_ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications set emailed_at = now() where id = any(p_ids);
$$;

revoke all on function public.notification_email_candidates(integer) from public, anon, authenticated;
revoke all on function public.mark_notifications_emailed(uuid[])     from public, anon, authenticated;
grant execute on function public.notification_email_candidates(integer) to service_role;
grant execute on function public.mark_notifications_emailed(uuid[])     to service_role;
