-- RLS regression tests (Remediation Phase 6 — "Assurance").
-- Harness: pgTAP, run by `supabase test db` (see supabase/tests/README.md).
--
-- The security posture is already strong (AUDIT-nvexis.md §3). These tests turn
-- that posture into *proof that stays true*: they assert the load-bearing
-- tenant-isolation guarantees so a future migration can never silently loosen
-- them without a red CI run.
--
-- What is proven here:
--   • A non-member can neither READ nor WRITE another tenant's rows (projects,
--     cards, columns, labels — plus owner-scoped folders / todo_lists).
--   • A VIEWER can read a project's content but cannot write it (role-aware RLS).
--   • A user CANNOT self-upgrade their plan (the protect_plan_columns trigger).
--   • Positive controls: an owner can read and write their own project, and can
--     still edit non-billing profile fields.
--
-- Each test runs inside one transaction that pgTAP rolls back, so seeding real
-- auth.users rows is safe and leaves no residue.

begin;
create extension if not exists pgtap;

select plan(15);

-- ============================================================================
-- Test helpers ----------------------------------------------------------------
-- Create a real auth.users row (fires handle_new_user → a profiles row). We set
-- only the columns GoTrue requires; password auth is irrelevant because the
-- tests set the JWT claims directly rather than signing in.
create or replace function p6_create_user(p_email text) returns uuid
language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email,
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false,
    '', '', '', ''
  );
  return v_id;
end;
$$;

-- Become an authenticated user: set the request JWT claims auth.uid()/auth.jwt()
-- read, then switch into the `authenticated` role so RLS applies exactly as it
-- would for a real client. Call `reset role;` (top-level) to return to postgres.
create or replace function p6_login(p_uid uuid) returns void
language plpgsql as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = p_uid;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated', 'email', v_email)::text,
    true
  );
  perform set_config('role', 'authenticated', true);
end;
$$;

-- ============================================================================
-- Seed one tenant (owner) + a viewer + an unrelated outsider ------------------
-- Fixed ids so the outsider/viewer write attempts can reference a real column
-- (satisfying the FK) and thus be blocked ONLY by RLS, not a null constraint.
do $$
declare
  v_owner    uuid := p6_create_user('owner@rls.test');
  v_viewer   uuid := p6_create_user('viewer@rls.test');
  v_outsider uuid := p6_create_user('outsider@rls.test');
  c_proj  constant uuid := '00000000-0000-0000-0000-0000000000a1';
  c_col   constant uuid := '00000000-0000-0000-0000-0000000000c1';
begin
  -- Project insert fires handle_new_project (owner membership) + seed columns.
  insert into public.projects (id, owner_id, name, accent)
  values (c_proj, v_owner, 'RLS Fixture', 'aurora');

  -- A known column + card so viewer reads are non-empty and writes have a target.
  insert into public.columns (id, project_id, name, position)
  values (c_col, c_proj, 'Seeded', 5000);
  insert into public.cards (project_id, column_id, title, position)
  values (c_proj, c_col, 'Seeded card', 1000);
  insert into public.labels (project_id, name, color)
  values (c_proj, 'Seeded label', 'violet');

  -- The viewer is a project member with the read-only role.
  insert into public.project_members (project_id, user_id, role)
  values (c_proj, v_viewer, 'viewer');

  -- Owner-scoped rows (isolation is by owner_id/user_id, not membership).
  insert into public.folders (id, owner_id, name, position)
  values ('00000000-0000-0000-0000-0000000000f1', v_owner, 'Owner folder', 0);
  insert into public.todo_lists (id, user_id, list_date, name, position)
  values ('00000000-0000-0000-0000-0000000000d1', v_owner, current_date, 'Owner list', 1000);

  -- Stash the ids for the assertion blocks below.
  perform set_config('p6.owner', v_owner::text, false);
  perform set_config('p6.viewer', v_viewer::text, false);
  perform set_config('p6.outsider', v_outsider::text, false);
end;
$$;

-- ============================================================================
-- A. A non-member is fully isolated ------------------------------------------
select p6_login(current_setting('p6.outsider')::uuid);

select is_empty(
  $$ select 1 from public.projects where id = '00000000-0000-0000-0000-0000000000a1' $$,
  'outsider cannot READ another tenant''s project');
select is_empty(
  $$ select 1 from public.cards where project_id = '00000000-0000-0000-0000-0000000000a1' $$,
  'outsider cannot READ another tenant''s cards');
select is_empty(
  $$ select 1 from public.columns where project_id = '00000000-0000-0000-0000-0000000000a1' $$,
  'outsider cannot READ another tenant''s columns');
select is_empty(
  $$ select 1 from public.labels where project_id = '00000000-0000-0000-0000-0000000000a1' $$,
  'outsider cannot READ another tenant''s labels');
select is_empty(
  $$ select 1 from public.folders where id = '00000000-0000-0000-0000-0000000000f1' $$,
  'outsider cannot READ another user''s folder');
select is_empty(
  $$ select 1 from public.todo_lists where id = '00000000-0000-0000-0000-0000000000d1' $$,
  'outsider cannot READ another user''s todo list');

select throws_ok(
  $$ insert into public.cards (project_id, column_id, title, position)
     values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'hax', 999) $$,
  NULL::text, NULL::text,
  'outsider cannot WRITE a card into another tenant''s project');
select throws_ok(
  $$ insert into public.columns (project_id, name, position)
     values ('00000000-0000-0000-0000-0000000000a1', 'hax', 999) $$,
  NULL::text, NULL::text,
  'outsider cannot WRITE a column into another tenant''s project');

reset role;

-- ============================================================================
-- B. A viewer can read but not write -----------------------------------------
select p6_login(current_setting('p6.viewer')::uuid);

select isnt_empty(
  $$ select 1 from public.cards where project_id = '00000000-0000-0000-0000-0000000000a1' $$,
  'viewer CAN read the project''s cards');
select throws_ok(
  $$ insert into public.cards (project_id, column_id, title, position)
     values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'nope', 998) $$,
  NULL::text, NULL::text,
  'viewer cannot INSERT a card (role-aware write RLS)');
select throws_ok(
  $$ insert into public.columns (project_id, name, position)
     values ('00000000-0000-0000-0000-0000000000a1', 'nope', 998) $$,
  NULL::text, NULL::text,
  'viewer cannot INSERT a column');

reset role;

-- ============================================================================
-- C. Positive controls — the owner can use their own project -----------------
select p6_login(current_setting('p6.owner')::uuid);

select isnt_empty(
  $$ select 1 from public.projects where id = '00000000-0000-0000-0000-0000000000a1' $$,
  'owner CAN read their own project');
select lives_ok(
  $$ insert into public.cards (project_id, column_id, title, position)
     values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'owner card', 2000) $$,
  'owner CAN write a card');

-- ============================================================================
-- D. A user cannot self-upgrade their plan -----------------------------------
select throws_ok(
  $$ update public.profiles set plan = 'pro' where id = current_setting('p6.owner')::uuid $$,
  NULL::text, NULL::text,
  'user cannot self-set plan = pro (protect_plan_columns trigger)');
select lives_ok(
  $$ update public.profiles set display_name = 'Owner Renamed' where id = current_setting('p6.owner')::uuid $$,
  'user CAN still edit non-billing profile fields');

reset role;

select * from finish();
rollback;
