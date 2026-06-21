-- Phase 10.1 — bigger free limits, in-app feedback, and a CEO message.
--   (1) Free plan now allows 10 project boards and 3 members per board.
--   (2) `feedback`     — any signed-in user submits; only the admin reads all.
--   (3) `ceo_messages` — the admin posts; everyone reads the latest.
-- The admin is a fixed email, checked by is_admin() (keep in sync with
-- src/lib/admin.ts). RLS is the real gate; the frontend only hides admin UI.

-- Admin identity -----------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'jaiakashj121420004@gmail.com';
$$;

grant execute on function public.is_admin() to authenticated;

-- (1a) Raise the free project cap 3 -> 10 (recreate the trigger function). ---
create or replace function public.enforce_project_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
  v_count integer;
begin
  select coalesce(p.plan, 'free') into v_plan
    from public.profiles p where p.id = new.owner_id;
  if coalesce(v_plan, 'free') = 'free' then
    select count(*) into v_count
      from public.projects pr where pr.owner_id = new.owner_id;
    if v_count >= 10 then
      raise exception 'PROJECT_LIMIT_REACHED'
        using hint = 'The Free plan is limited to 10 project boards. Upgrade to Pro for unlimited.';
    end if;
  end if;
  return new;
end;
$$;

-- (1b) Free plan: at most 3 members per board (the board OWNER's plan governs).
create or replace function public.enforce_member_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_plan text;
  v_count integer;
begin
  select owner_id into v_owner from public.projects where id = new.project_id;
  if v_owner is null then
    return new; -- project row already gone (cascade delete) — nothing to limit
  end if;
  select coalesce(p.plan, 'free') into v_plan
    from public.profiles p where p.id = v_owner;
  if coalesce(v_plan, 'free') = 'free' then
    select count(*) into v_count
      from public.project_members where project_id = new.project_id;
    if v_count >= 3 then
      raise exception 'MEMBER_LIMIT_REACHED'
        using hint = 'The Free plan allows 3 members per board. Upgrade to Pro for unlimited collaborators.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_member_limit on public.project_members;
create trigger enforce_member_limit
  before insert on public.project_members
  for each row
  execute function public.enforce_member_limit();

-- (2) Feedback / feature recommendations -----------------------------------
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'feedback' check (kind in ('feedback', 'feature')),
  message text not null check (char_length(message) between 1 and 4000),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Any signed-in user may submit their own feedback...
create policy "feedback: submit own" on public.feedback
  for insert to authenticated with check (user_id = auth.uid());
-- ...and read back their own submissions...
create policy "feedback: read own" on public.feedback
  for select to authenticated using (user_id = auth.uid());
-- ...but only the admin can read everyone's.
create policy "feedback: admin reads all" on public.feedback
  for select to authenticated using (public.is_admin());

-- (3) CEO message — a single broadcast the admin maintains -----------------
create table if not exists public.ceo_messages (
  id uuid primary key default gen_random_uuid(),
  message text not null check (char_length(message) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ceo_messages enable row level security;

-- Everyone signed in reads the latest message; only the admin writes.
create policy "ceo: everyone reads" on public.ceo_messages
  for select to authenticated using (true);
create policy "ceo: admin inserts" on public.ceo_messages
  for insert to authenticated with check (public.is_admin());
create policy "ceo: admin updates" on public.ceo_messages
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "ceo: admin deletes" on public.ceo_messages
  for delete to authenticated using (public.is_admin());

-- Keep updated_at fresh on every edit (the admin updates this row in place).
create or replace function public.touch_ceo_messages_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_ceo_messages_updated_at on public.ceo_messages;
create trigger touch_ceo_messages_updated_at
  before update on public.ceo_messages
  for each row
  execute function public.touch_ceo_messages_updated_at();
