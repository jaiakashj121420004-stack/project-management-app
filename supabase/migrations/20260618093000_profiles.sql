-- Migration: profiles (Phase 2 — Auth)
-- See plan.md §5 (data model) and §6 (security model).
--
-- A `profiles` row is 1:1 with `auth.users`. It is created automatically by a
-- trigger when a new auth user signs up, and is protected by Row Level Security
-- so a user can read and update ONLY their own profile. The frontend is treated
-- as untrusted; these database rules are the real guarantee.

-- 1. Table -------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid        primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

comment on table public.profiles is 'User profile, 1:1 with auth.users (plan.md §5).';

-- 2. Auto-create a profile on sign-up ----------------------------------------
-- SECURITY DEFINER so the function can insert into public.profiles regardless of
-- the (un-privileged) caller. `search_path` is pinned to empty and every object
-- is schema-qualified to prevent search-path hijacking — Supabase's documented
-- best practice for definer functions.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    -- Prefer a name supplied at sign-up / by the OAuth provider; fall back to
    -- the email's local part so there is always something to show.
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Row Level Security ------------------------------------------------------
alter table public.profiles enable row level security;

-- A user may read only their own profile.
drop policy if exists "Profiles: select own" on public.profiles;
create policy "Profiles: select own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- A user may update only their own profile (id/created_at are effectively fixed
-- by the with-check clause and column-level intent).
drop policy if exists "Profiles: update own" on public.profiles;
create policy "Profiles: update own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No INSERT/DELETE policies: inserts are performed only by the SECURITY DEFINER
-- trigger above, and rows are removed via the auth.users cascade. The anon role
-- has no access at all.
